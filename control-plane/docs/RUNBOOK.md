# RUNBOOK — DhaherOS Control Plane (Fase 8 slice-1, run-9)

Operasi otonom "iris aman": semua prosedur di sini bersifat lokal, zero-eksternal,
tanpa secret di argumen/log. Sumber kebenaran: `src/paths.ts` (konstanta), `src/db.ts`
(state machine + recovery), `src/index.ts` (REST API).

## 1. Ringkasan sistem

| Komponen | Nilai |
|---|---|
| Service | `bun src/index.ts` (control plane REST, Bun.serve) |
| Port | **3031** (hardcoded, `src/paths.ts`) |
| Database | `data/dhaheros.db` (SQLite, WAL; hardcoded via `DATA_DIR`) |
| Workspace | `workspaces/` (deny-by-default, command luar workspace ditolak) |
| Artefak | `artifacts/<task_id>/` |
| Log service | stdout (redirect ke `logs/service-<tujuan>.log`) |
| Versi | lihat `docs/EVIDENCE.md` (verify run terbaru) |

State machine: `planned → running → succeeded | failed | cancelled | uncertain`;
`uncertain → planned` HANYA via reconcile (re-run idempoten).

## 2. Konfigurasi (env var)

| Var | Default | Arti |
|---|---|---|
| `DHOS_GLOBAL_BUDGET_SEC` | 7200 | Cap budget runtime kumulatif GLOBAL (AT-12); create task ditolak bila terpakai ≥ cap |
| — (per task) | `timeout_sec` ≤ 600, `budget_sec` ≤ 86400 | Stop cap per task/per attempt, budget kumulatif per task |

`FAKE_SECRET` hanya dipakai verify (AT-09 grep-leak); nilai secret asli TIDAK pernah
masuk API/event/log/artefak (registry menyimpan NAMA referensi saja).

## 3. Start

```bash
cd /home/z/my-project/dhaheros
setsid nohup bun src/index.ts >> logs/service.log 2>&1 &
# tunggu siap (maks ~20 dtk):
curl -sf http://127.0.0.1:3031/api/health
```

Saat boot otomatis: (a) recovery `running → uncertain` untuk task yang tertinggal
(event `recovery` per task); (b) event `service_boot` (port, pid, jumlah recovered).
**Tidak ada sukses palsu** — task yang mati mendadak menjadi `uncertain`, bukan succeeded.

## 4. Health check (ringan, zero-eksternal)

```bash
curl -sf -m 5 http://127.0.0.1:3031/api/health          # 200 = hidup
pgrep -f "bun src/index.ts"                              # proses ada
python3 - <<'PY'   # state DB ringkas
import sqlite3; db=sqlite3.connect('data/dhaheros.db')
print(db.execute("select state,count(*) from tasks group by state").fetchall())
PY
```

Kegagalan `curl` + `pgrep` kosong → jalankan **Start** (§3). `pgrep` ada tapi curl gagal
> 60 dtk → tail log, jangan restart berulang (lihat §10).

## 5. Stop-safely (prosedur wajib sebelum stop)

Tidak ada SIGTERM handler di service — stop langsung membiarkan task `running`
tanpa penyelesaian. Urutan aman:

```bash
BASE=http://127.0.0.1:3031
# 1) cancel semua task running (state → cancelled, event task_cancelled)
for id in $(curl -s $BASE/api/tasks | python3 -c 'import sys,json
 for t in json.load(sys.stdin)["tasks"]:
  if t["state"]=="running": print(t["id"])'); do
  curl -s -X POST $BASE/api/tasks/$id/cancel; echo
done
# 2) pastikan state bersih (tidak ada running/planned menunggu)
curl -s $BASE/api/tasks | python3 -c 'import sys,json
 s=[t["state"] for t in json.load(sys.stdin)["tasks"]]
 print("bersih" if not ({"running","planned"} & set(s)) else "MASIH ADA:", s)'
# 3) stop service (TERM cukup; bun exit bersih)
pkill -TERM -f "bun src/index.ts"; sleep 1
curl -s -m 2 $BASE/api/health || echo "service stop"
```

Catatan: `cancelled` hanya sah dari `planned/running`; task `uncertain` dibiarkan
untuk diputuskan lewat reconcile (§6) — jangan di-force.

## 6. Restart & recovery

Restart = Start (§3) dengan DB yang SAMA. Yang terjadi otomatis:
1. Task yang tertinggal `running` → `uncertain` + event `recovery`.
2. `service_boot` mencatat `recovered_running_to_uncertain: N`.

Penyelesaian task `uncertain`:
- **Idempoten** (punya `idempotency_key`): `POST /api/tasks/:id/reconcile` →
  attempt+1, state → `planned`, re-run otomatis (satu-satunya rekonsiliasi otomatis sah).
- **Non-idempoten**: ditolak `reconcile_denied/non_idempotent_needs_human` →
  tetap `uncertain`, butuh keputusan manusia (TIDAK ada sukses palsu).
- Budget habis: `reconcile_denied/budget_exhausted` (AT-12).

## 7. Budget (AT-12)

- **Per attempt**: `timeout_sec` (default 60, maks 600) — timer mid-run → `failed/budget_exhausted`.
- **Per task**: `budget_sec` kumulatif (`runtime_used_ms` di tabel tasks), maks 86400.
- **Global**: `DHOS_GLOBAL_BUDGET_SEC` (default 7200); terpakai dilacak di tabel
  `globals`; create task baru ditolak `global_budget_exhausted` bila ≥ cap.
- Reset global budget (operasi sadar, mis. rotasi periode): stop service →
  `sqlite3`/bun script hapus baris `runtime_used_ms` di tabel `globals` → start.
  Dokumentasikan keputusan reset di log operasi.

## 7b. Scheduler internal (Fase 8 slice-2, run-10)

Trigger interval TANPA cron eksternal — tick 1 dtk, satu run per window interval
(dedup key `sched-<id>-<bucket>`). Trigger memanggil POST /api/tasks control plane
(127.0.0.1, zero-egress) → SEMUA gate berlaku (capability_context Fase 5, budget
AT-12, workspace deny-by-default). Urutan gate per trigger: **kill switch → izin
org → create task**; setiap skip/deny ter-audit (`scheduler_skipped` + alasan).

```bash
BASE=http://127.0.0.1:3031
# buat schedule (workspace WAJIB sudah ada; capability di whitelist; interval ≥ 2s uji / ≥60s produksi)
curl -s -X POST $BASE/api/schedules -H 'content-type: application/json' -d '{
  "name":"harian-ekspor","workspace":"/home/z/my-project/dhaheros/workspaces/ws-ekspor",
  "command":"bun flow.ts flow.json . out","interval_sec":86400,
  "owner_org":"org-alpha","owner_subject":"agent-a1","capability":"flow.run",
  "timeout_sec":120,"budget_sec":300}'
curl -s $BASE/api/schedules                 # daftar + trigger_count + next_run_at
curl -s $BASE/api/scheduler/status          # {enabled, schedules, active, total_triggers}
# KILL SWITCH global (stop semua trigger baru, schedules tetap tersimpan; ter-audit):
curl -s -X POST $BASE/api/scheduler/kill-switch -H 'content-type: application/json' -d '{"enabled":false}'
curl -s -X POST $BASE/api/scheduler/kill-switch -H 'content-type: application/json' -d '{"enabled":true}'
curl -s -X DELETE $BASE/api/schedules/<id>  # hapus permanen (event schedule_deleted)
```

Prosedur insiden: matikan scheduler = kill switch `enabled:false` (efek seketika,
tanpa restart). Restart service aman: schedules persist (SQLite), catch-up maksimal
1 run per window, tanpa duplikat (idempotency key per window).

## 7c. Worker protocol — kerjasama agent otonom (Fase 9 slice-1a, run-37)

Task mode `execution:"worker"` TETAP `planned` (tidak auto-run) sampai seorang
worker mengklaimnya. Worker mengidentifikasi diri via **seat** (registry
`runtimes/blackhornet/seats.json` — nama seat ↔ 1 capability) dan
**capability_context** `{org, subject, capability}` yang divalidasi gate org.ts
yang SAMA dengan POST /api/tasks (Fase 5). Siapkan dulu: org + member yang
role-nya memuat capability seat (contoh di AT-WK: org `fase9-workers`, member
`w-exec` role `seat-exec` = `[flow.run]` untuk seat `executor`).

Kontrak endpoint (semua JSON, pola rute index.ts):

```bash
BASE=http://127.0.0.1:3031
# 1) buat task mode worker (task tetap planned)
curl -s -X POST $BASE/api/tasks -H 'content-type: application/json' -d '{
  "goal":"...","workspace":"/home/z/my-project/dhaheros/workspaces/ws-x",
  "command":"echo halo > out.txt","timeout_sec":60,"execution":"worker",
  "capability_context":{"org":"fase9-workers","subject":"w-exec","capability":"flow.run"}}'
# 2) claim (hanya dari state planned) → 200, state→running, event worker_claimed,
#    tasks.worker_id tersimpan. Deny → 403 + event worker_denied (tanpa transisi).
curl -s -X POST $BASE/api/tasks/<id>/claim -H 'content-type: application/json' -d '{
  "worker_id":"w-1","seat":"executor",
  "capability_context":{"org":"fase9-workers","subject":"w-exec","capability":"flow.run"}}'
# 3) heartbeat (hanya worker pemilik claim, state running) → event worker_heartbeat
#    + update kolom tasks.last_heartbeat
curl -s -X POST $BASE/api/tasks/<id>/heartbeat -H 'content-type: application/json' \
  -d '{"worker_id":"w-1"}'
# 4) report → transisi running→succeeded (exit 0) / failed (selainnya); event
#    worker_reported. artifacts: nama sederhana → artifacts/<task_id>/ (pola executor);
#    path wajib di dalam workspace task (deny-by-default paths.ts → 403 tanpa transisi).
curl -s -X POST $BASE/api/tasks/<id>/report -H 'content-type: application/json' -d '{
  "worker_id":"w-1","exit_code":0,"notes":"selesai","artifacts":["stdout.txt"]}'
```

Aturan state (AT-WK-01..03): claim saat state ≠ planned → 409
`transition_denied`; report ganda → 409; report/heartbeat bukan dari pemilik
claim → 403. Poll task: `GET /api/tasks?state=planned`.

CLI worker (loop poll bila tanpa `--once`; eksekusi memakai pola executor.ts:
wrapper exec-redirect ke `artifacts/<task_id>/`, env child bersih PATH/HOME,
setsid, timeout → SIGKILL group, meta.json; heartbeat tiap `--heartbeat` dtk
selama running):

```bash
cd /home/z/my-project/dhaheros
bun src/worker.ts --server http://127.0.0.1:3031 --seat executor --worker-id w-1 \
  --org fase9-workers --subject w-exec --once --poll 2 --heartbeat 5
```

Sisa scope item-47: SELESAI — gateway (1b) + daemon (1c) di bawah.

### 7c.1 Gateway zero-egress (slice-1b, run-38) — src/gateway.ts

Proxy 127.0.0.1:3032 → control plane 127.0.0.1:3031 (bind 127.0.0.1 ONLY; upstream
wajib loopback — selain itu gateway MENOLAK start). Semua `/api/*` di-forward
(method+body, response di-stream, status asli; header host + token dibuang);
path lain → 404. Auth: header `x-dhos-gateway-token` dibandingkan (timingSafeEqual)
dengan NILAI secret `gateway_token` di tabel secrets (REFERENCE — provision REUSE
API control plane `POST /api/secrets {"name":"gateway_token","value":...}` → audit
event `secret_set`; nilai TIDAK pernah di log/event/response gateway). Tanpa/salah
token → 401 + event `gateway_denied`; token belum diprovision → semua 401
(deny-by-default). Rate-limit per-IP token bucket: default 60 req/mnt burst 60
(env `DHOS_GATEWAY_RATE_PER_MIN` / `DHOS_GATEWAY_BURST`, atau flag
`--rate-per-min`/`--burst`) → 429 + event `gateway_rate_limited` (upstream tak
tersentuh). Audit event gateway ditulis ke tabel events yang sama
(`via:"gateway"`, task_id NULL). Liveness: `GET /gateway/health` (tanpa token).

```bash
cd /home/z/my-project/dhaheros
# provision token (sekali; via control plane langsung, lokal):
curl -s -X POST http://127.0.0.1:3031/api/secrets -H 'content-type: application/json' \
  -d '{"name":"gateway_token","value":"<nilai-rahasia>"}'        # 201 {name, stored:true}
# jalankan gateway (uji: --duration SEC; produksi: tanpa --duration = jalan terus):
bun src/gateway.ts --port 3032 --target http://127.0.0.1:3031 --duration 300
# pakai lewat gateway (token di header):
curl -s -H "x-dhos-gateway-token: <nilai-rahasia>" http://127.0.0.1:3032/api/events?limit=1
```

### 7c.2 Daemon mode (slice-1c, run-38) — ops/start_daemon.sh + ops/stop_daemon.sh

Supervisor control plane: `start_daemon.sh` me-rm `ops/.daemon.stop` (start sah =
kill-switch dicabut), detach via setsid nohup (pidfile `ops/.daemon.pid`), memulai /
meng-adopt control plane :3031 (anti spawn dobel), lalu health loop tiap 30 dtk
(env `DHOS_DAEMON_INTERVAL`) — beat `GET /api/events?limit=1` di-append ke
`ops/daemon_health.log` (ts + code). Health gagal 3× berturut → RESTART control
plane (kill lama + fuser fallback + setsid ulang; baris RESTART di log). Kill-switch:
`ops/.daemon.stop` ada → supervisor exit BERSIH tanpa resurrect (rm pidfile).
`stop_daemon.sh`: touch `.daemon.stop` → kill supervisor → kill CP anak → fuser
fallback → verifikasi :3031 bebas (exit 1 bila masih hidup).

```bash
cd /home/z/my-project/dhaheros
bash ops/start_daemon.sh          # start + health loop (idempotent)
tail -f ops/daemon_health.log     # beat code=200 tiap interval
bash ops/stop_daemon.sh           # stop wajib (port bebas terverifikasi)
```

Integrasi: `ops/stop_safely.sh` dan `verify_at.sh` touch `ops/.daemon.stop` paling
awal — daemon tidak pernah resurrect :3031 selama skenario stop / fresh-db verify.
Bukti AT-DM-01 (skenario ops manual, di luar 63 AT): start → beat code=200 → kill -9
CP → 3× FAIL → RESTART → health pulih → stop_daemon → :3031 bebas + pidfile bersih
(log: `ops/daemon_health.log` run-38).

## 8. Verify ulang (bukti acceptance)

```bash
cd /home/z/my-project/dhaheros
bash verify_at.sh          # fresh DB otomatis (rm data/dhaheros.db*), start service,
                           # AT-01..AT-47, kill service, tulis docs/EVIDENCE.md
bash ops/stop_safely.sh    # skenario end-to-end stop-safely + recovery (AT-OS-01..07)
```

Keduanya exit non-zero bila ada FAIL. Hasil wajib dikutip ke `docs/EVIDENCE.md`
dan baris baru di Eval log (Task ID 51).

## 9. Rotasi log & artefak

- **Log service** (stdout): gunakan copytruncate agar pid tak berubah:
  ```bash
  cp logs/service.log logs/service-$(date +%Y%m%d).log && : > logs/service.log
  ```
- **Retention**: simpan ≤ 14 rotasi terakhir. Log lama JANGAN dihapus sebelum
  periode evaluasi berjalan (Eval log mengutip bukti darinya).
- **DB event log**: append-only — TIDAK boleh dipangkas/di-edit (audit). Jika ukuran
  tumbuh, arsipkan seluruh file DB (copy saat service stop), jangan DELETE.
- **Artifacts** per task (`artifacts/<task_id>/`): arsipkan + kompres task ≥ 30 hari;
  metadata `meta.json` wajib ikut (provenance).

## 10. Troubleshooting

| Gejala | Sebab umum | Tindakan |
|---|---|---|
| Port 3031 terpakai | instance lama masih hidup | `pgrep -f "bun src/index.ts"` → pilih: TERM instance lama (setelah §5) atau pakai instance itu |
| curl hang, pgrep ada | DB lock (WAL) / dead-loop | tail log terakhir; stop via TERM; cek `data/dhaheros.db-shm` usang; start ulang |
| Create task 409 budget | global budget habis | cek `GET /api/events/summary`; reset sadar (§7) |
| Task stuck `running` setelah crash | normal | restart → otomatis `uncertain` → reconcile (§6) |
| Task stuck `uncertain` non-idempoten | by design | keputusan manusia; catat di Eval log, jangan dipaksa |

## 11. Referensi API (ringkas)

| Method+Path | Fungsi |
|---|---|
| GET `/api/health` | health check |
| POST/GET `/api/tasks` | create (idempotency_key, timeout, budget, runtime, capability_context) / list |
| GET `/api/tasks/:id` | detail + state |
| POST `/api/tasks/:id/cancel` | cancel running/planned |
| POST `/api/tasks/:id/retry` | retry task gagal (attempt+1) |
| POST `/api/tasks/:id/reconcile` | uncertain → planned + re-run (wajib idempotency_key) |
| GET `/api/events?from&to`, `/api/events/summary` | audit query |
| POST/GET `/api/orgs`, POST `/api/orgs/check` | organisasi & capability |
| POST/GET `/api/workflows`, POST `/api/workflows/:id/run` | template & run workflow (gate policy) |
| POST/GET `/api/policy/bindings` | binding policy per org+scope |
| POST/GET `/api/providers`, POST `/api/providers/:id/test` | registry provider (kontrak http-json, endpoint lokal) |
| POST/GET `/api/secrets` | simpan NAMA referensi (nilai tak pernah di-return) |
| POST/GET `/api/knowledge/sources`, POST `/api/knowledge/search` | RAG slice (ACL, provenance) |
| POST `/api/knowledge/sources/:id/revoke` | revoke sumber |
