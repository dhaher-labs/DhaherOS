# UI_EVIDENCE_AT39 — AT-39 UI-state verification (task 58-c)

| Field | Value |
|---|---|
| Timestamp | 2026-11-12 10:42 WIB / 2026-11-12T03:42Z UTC |
| Browser | agent-browser (headless Chromium 157, Playwright-driven) |
| Route | `http://localhost:3000/` (Next.js 16 dev server, single route) |
| Gateway | UI fetch = relative `/api/...?XTransformPort=3031` → reverse-proxy ke control plane `:3031` (Next rewrites, BUKAN `http://localhost:3031` langsung — dilarang oleh `lib.ts`) |
| Control plane | `:3031` DITEMUKAN MATI saat mulai → di-start via `bash ops/start_daemon.sh` (pid 2530) → `/api/health` 200. Tidak ada kode API yang diubah. |
| Sifat bukti | Semua state dipicu lewat data NYATA control plane lokal (:3031) — zero-egress, mock only (`127.0.0.1:45xx`), tanpa secret asli (canary `AKIA…` di bawah adalah string sintetis buatan tangan). |
| Bukti visual | `dhaheros/docs/ui-evidence-at39/*.png` (14 screenshot, diindeks di §5) |

## 1. Ringkasan verdict per state

| # | State | Metode (exact) | Hasil | Bukti |
|---|---|---|---|---|
| a | SUKSES (task list) | Browser: open `:3000` → tab Tasks (default) + snapshot; API kontrol: `curl :3031/api/tasks` | **PASS** | `a1-tasks-desktop-1280.png`, snapshot "35 tasks in the plane." + badge SUCCEEDED/UNCERTAIN/FAILED/CANCELLED |
| b | PERMISSION-DENIED | API: `curl -X POST :3031/api/orgs/check -d '{"org":"org-alpha","subject":"agent-r1","capability":"org.manage"}'`; UI: Orgs tab → Capability checker → Check access. Plus HTTP-403 asli: `curl -X POST :3031/api/knowledge/sources` dgn file canary → UI ingest form | **PARTIAL** (deny tampil; TIDAK sebagai HTTP 403 pada read — lihat catatan jujur §3) | `b2-orgcheck-denied-badge.png` (badge DENIED + reason), `b1-knowledge-ingest-403-toast.png` (toast 403) |
| c | NO-RESULT (retrieval) | API: `curl -X POST :3031/api/knowledge/search -d '{"scope":"proj-a","query":"zzz-not-a-real-token-9x7"}'` → `{found:false,results:[],acl_filtered:0}`; UI: Knowledge tab → Search → query sama | **PASS** | `c1-knowledge-noresult.png` (badge "no hits" + teks "No matching chunks. Retrieved content is untrusted by policy.") |
| d | PURGE-PENDING/PURGED | API: ingest source test `ui-at39-test.md` (201, chunk_count 1) → `POST /api/knowledge/sources/:id/revoke` → `{revoked:true,purged:true,chunks_deleted:1}`; GET sources → `status:"revoked",purge_status:"purged",chunk_count:0`; UI: Knowledge tab → Sources (refresh) | **PASS** (purge_status `pending` tidak diimplementasi backend — revoke langsung purge atomik, AT-34; satu-satunya nilai yang ada = `purged`) | `d1-knowledge-sources-revoked-purged.png` (badge "revoked" + "purge: purged", 0 chunks) |
| e | PROVIDER-ERROR | UI: Providers tab → Test pada `p-min` (endpoint mock lokal `127.0.0.1:4511` tidak hidup) → POST `/api/providers/p-min/test` → HTTP 200 `{test:{ok:false,reason:"fetch_error:Error"}}`. Plus 400: `curl -X POST :3031/api/providers/p-min/test -d '{"capability":"totally.unknown.cap"}'` → HTTP 400 `unknown_capability`; UI create form dgn capability bogus → toast | **PASS** untuk error dialog + toast; **PARTIAL** untuk jalur 400-via-Test-button (tidak bisa, lihat §3) | `e2-provider-test-failed-dialog.png` (badge FAILED, status —, reason `fetch_error:Error`), `e3-provider-create-400-toast.png` ("Create failed: unknown_capability") |

## 2. Bukti potongan (snapshot / response verbatim)

### (a) SUKSES — Tasks list berisi data nyata
- `curl http://localhost:3000/api/tasks?XTransformPort=3031` → `{"count":35,...}` (db populated: succeeded 26, failed 6, uncertain 1, cancelled 1, planned 1).
- Browser snapshot (desktop 1280×800): tablist "Control plane sections" dengan 7 tab; tabpanel Tasks:
  - `StaticText "35 tasks in the plane."`
  - `button "AT-01 echo task … SUCCEEDED"`, `"AT-02 sleep utk crash-restart … UNCERTAIN"`, `"AT-03 timeout … FAILED"`, `"AT-04 cancel … CANCELLED"` — semua 5 varian state badge (planned/running/succeeded/failed/cancelled/uncertain) punya styling di `lib.ts STATE_STYLES`.
  - Klik task FAILED → dialog detail: meta (runtime/attempt/runtime_used 2003 ms/timeout 2s), workspace, command, State machine, Retry button, "Events timeline (5)". → `a2-task-detail-dialog-failed.png`.
- Mobile 390×844: layout menumpuk 1 kolom, tab bar flex-wrap, tanpa overflow horizontal. → `a3-tasks-mobile-390.png`.
- Empty-state (jalur tersedia, tidak terpicov di run ini karena db berisi): `tasks-tab.tsx` me-render `<EmptyState title="No tasks yet" hint="Dispatch a goal on the left and it will appear here." />` — diverifikasi dari kode, bukan screenshot (db tidak kosong; kondisi db dicatat apa adanya: 35 task).

### (b) PERMISSION-DENIED
- API probe:
  ```
  POST :3031/api/orgs/check {"org":"org-alpha","subject":"agent-r1","capability":"org.manage"}
  → HTTP 200 {"allowed":false,"org":"org-alpha","subject":"agent-r1","capability":"org.manage","role":"reader","reason":"capability_not_in_role"}
  ```
- UI (Orgs tab → Capability checker, form pre-filled org-alpha/agent-r1/org.manage → Check access):
  - snapshot: `StaticText "DENIEDvia role \"reader\""` + `StaticText "capability_not_in_role"` — badge merah DENIED dengan reason server, bukan JSON mentah. → `b2-orgcheck-denied-badge.png`.
- HTTP 403 asli (satu-satunya di control plane, path ingest AT-32):
  ```
  POST :3031/api/knowledge/sources {"scope":"ui-at39-test","path":".../ui-at39-secret-canary.md"}
  → HTTP 403 {"error":"secret_detected_in_source"}
  ```
  UI jalur yang sama (Ingest form): toast `Ingest failed: secret_detected_in_source`. → `b1-knowledge-ingest-403-toast.png`.

### (c) NO-RESULT
- API probe: `POST :3031/api/knowledge/search {"scope":"proj-a","query":"zzz-not-a-real-token-9x7"}` → HTTP 200 `{"found":false,"results":[],"acl_filtered":0,"content_policy":{...}}`.
- UI (Knowledge tab → Search, scope proj-a, query sama):
  - snapshot: `StaticText "no hits"` (badge abu), `StaticText "No matching chunks. Retrieved content is untrusted by policy."` → `c1-knowledge-noresult.png`.
- Kontrol hit (bukan no-result): query "omega" → badge `3 hits`, `acl_filtered: 1`, hasil bertanda `untrusted` + locator + sha256 (AT-33/36 tampil). → `c2-knowledge-hit-control.png`.

### (d) PURGE-PENDING/PURGED
- API sequence (source test kecil, scope `ui-at39-test`):
  1. `POST :3031/api/knowledge/sources {"scope":"ui-at39-test","path":".../knowledge/ui-at39-test.md"}` → HTTP 201, source_id `08c14f47-…`, chunk_count 1.
  2. Search "xylophone-quartz-marker" → `found:true` (hit 1).
  3. `POST :3031/api/knowledge/sources/08c14f47-…/revoke` → HTTP 200 `{"revoked":true,"purged":true,"chunks_deleted":1}`.
  4. `GET :3031/api/knowledge/sources` → row: `"status":"revoked","purge_status":"purged","purge_at":"2026-11-12T03:34:58.391Z","chunk_count":0`.
  5. Search ulang → `found:false` (chunk sudah di-purge; `acl_filtered:0` karena kandidat SQL sudah terhapus — bukti AT-34 purge turunan).
- UI (Knowledge tab → Sources setelah refresh): row `ui-at39-test` menampilkan badge scope `ui-at39-test`, `revoked` (merah), `purge: purged` (abu), "0 chunks". → `d1-knowledge-sources-revoked-purged.png`.

### (e) PROVIDER-ERROR
- UI (Providers tab → tombol Test pada `p-min`, endpoint mock lokal mati):
  - dialog "Provider synthetic test — p-min": badge `FAILED`, `capability: http.json.echo`, STATUS `—`, LATENCY_MS `0`, GOT_AUTH `—`, REDIRECTS `0`, reason `fetch_error:Error`, `probed at 2026-11-12 03:37:21Z`. → `e2-provider-test-failed-dialog.png`.
- API 400 (unknown capability): `POST :3031/api/providers/p-min/test {"capability":"totally.unknown.cap","payload":{}}` → HTTP 400 `{"error":"unknown_capability","capability":"totally.unknown.cap","protocol":"http-json"}`.
- UI 400 yang bisa dicapai (jalur create, bukan Test): Register provider form dgn capability `bogus.unknown.cap` → toast `Create failed: unknown_capability`. → `e3-provider-create-400-toast.png`. Tidak ada secret/endpoint eksternal (endpoint `http://127.0.0.1:9/dead`, hanya localhost).

## 3. Catatan jujur (apa yang TIDAK bisa dibuktikan UI)

1. **Tidak ada jalur HTTP-403 pada operasi READ di control plane.** Desain deny = (i) `POST /api/orgs/check` membalas HTTP 200 `allowed:false` (deny di-audit sebagai event `capability_denied`), dan (ii) retrieval lintas-scope/revoked difilter ACL (`acl_filtered`), bukan 403. UI menyajikan keduanya (badge DENIED + angka acl_filtered), tetapi klaim "UI menampilkan error 403" HANYA benar untuk path ingest secret (AT-32, write). Untuk read: **"jalur HTTP-403 tidak tersentuh UI di skenario ini — by design backend; deny read direpresentasikan sebagai allowed=false / acl_filtered, keduanya tampil."**
2. **`purge_status: pending` tidak ada di backend** — revoke = purge atomik satu langkah (AT-34). Yang bisa diverifikasi UI hanya `purge: purged`. Tidak ada state PURGE-PENDING untuk diverifikasi.
3. **HTTP 400 `unknown_capability` tidak dapat dicapai lewat tombol Test UI** — `runTest()` selalu mengirim `p.capabilities[0]`, dan capability saat registrasi sudah divalidasi backend (400 di create). Demo 400 lewat UI = jalur create (toast), bukan dialog test.
4. **Provider test `ok:false` pada mock yang mati** (`fetch_error:Error`) — ini kondisi error nyata yang tampil di dialog, namun mock `:4511/:4521/:4522` tidak dijalankan pada sesi ini (tidak ada prosedur start mock di RUNBOOK; verify scripts yang memulainya). Representasi error dialog terverifikasi; jalur OK (success probe) tidak diverifikasi di sesi ini.
5. **Chip "57 ATs PASS" di hero adalah konten statik** (`page.tsx`) — tidak diverifikasi oleh run ini dan tidak diubah (di luar mandat verifikasi tampilan).
6. Dialog task mem-heading section "State machine" yang isinya = **transisi sah berikutnya** dari API (`TRANSITIONS[state]`, untuk failed → `["planned"]`), bukan riwayat state. Label sedikit ambigu — dicatat sebagai temuan, TIDAK diubah (semantik API, bukan bug tampilan murni).

## 4. Baseline aksesibilitas ringan (bukan WCAG audit penuh — DL-26 tetap OPEN)

- Keyboard (desktop 1280×800, trace `document.activeElement`):
  - `header link "Control plane status"` → Tab → `BUTTON "Toggle dark mode"` → Tab → **`BUTTON "Scheduler"` (tab trigger aktif tercapai via Tab)** → Tab → `DIV` tabpanel (tabindex=0).
  - Di dalam tablist: `ArrowRight` → `BUTTON "Orgs"`, `ArrowLeft` → `BUTTON "Scheduler"` (roving tabindex Radix, aktivasi otomatis mengikuti fokus). → `g1-keyboard-focus-scheduler-tab.png`.
  - Form fields punya `<Label htmlFor=…>` (Field component) — label-input terasosiasi; snapshot a11y menampilkan accessible name tiap textbox/combobox/spinbutton.
- Responsive:
  - Desktop 1280×800: grid 2 kolom tasks/providers, 2 kolom knowledge/orgs. → `a1-…png`, `e1-…png`.
  - Mobile 390×844: kolom tunggal, tab bar wrap (flex-wrap), tidak ada horizontal scroll pada snapshot Tasks/Orgs/Knowledge. → `a3-…png`, `g2-…png`, `g3-…png`, `final-knowledge-mobile-full.png`.
- Screenshot penuh mobile Knowledge (full page) menunjukkan footer ter-render, tidak ada error boundary putih.

## 5. Indeks bukti visual (`dhaheros/docs/ui-evidence-at39/`)

| File | Isi |
|---|---|
| `a1-tasks-desktop-1280.png` | Tasks tab desktop, 35 task, multi-state badge |
| `a2-task-detail-dialog-failed.png` | Dialog detail task FAILED (events timeline, state machine, Retry) |
| `a3-tasks-mobile-390.png` | Tasks tab 390px, layout 1 kolom |
| `b1-knowledge-ingest-403-toast.png` | Toast HTTP-403 `secret_detected_in_source` via UI ingest |
| `b2-orgcheck-denied-badge.png` | Badge DENIED + `capability_not_in_role` (capability checker) |
| `c1-knowledge-noresult.png` | "no hits" + teks empty-result |
| `c2-knowledge-hit-control.png` | Kontrol: `3 hits`, `acl_filtered: 1`, badge untrusted |
| `d1-knowledge-sources-revoked-purged.png` | Row sumber test: `revoked` + `purge: purged`, 0 chunks |
| `d2-sources-after-fix-no-revoke-on-revoked.png` | Setelah fix kecil §6: row revoked tanpa tombol Revoke |
| `e1-providers-list.png` | Providers tab desktop, 10 provider + tombol Test |
| `e2-provider-test-failed-dialog.png` | Dialog test FAILED, reason `fetch_error:Error` |
| `e3-provider-create-400-toast.png` | Toast `Create failed: unknown_capability` (HTTP 400) |
| `f1-memory-tab.png`, `f2-events-tab.png`, `f3-scheduler-tab.png` | Tab Memory/Events/Scheduler ter-render normal |
| `g1-keyboard-focus-scheduler-tab.png` | Fokus keyboard pada tab trigger |
| `g2-orgs-mobile-390.png`, `g3-knowledge-mobile-390.png`, `final-knowledge-mobile-full.png` | Responsive mobile |

## 6. Perbaikan tampilan kecil yang dilakukan (minimal, tanpa ubah logika fetch)

| File | Perubahan | Alasan |
|---|---|---|
| `src/components/dhaheros/knowledge-tab.tsx` (`SourceRow`) | Tombol **Revoke kini hanya dirender bila `s.status === "granted"`** (conditional render, 1 blok; tidak menyentuh fetch/query/logika revoke) | Sebelumnya tombol Revoke tampil juga pada sumber `revoked`+`purged` (konten 0 chunk) — misleading (aksi atas state yang sudah final). Re-revoke API memang idempoten, tapi tampilan menyarankan state yang masih actionable. Diverifikasi ulang via browser: 3 sumber granted → 3 tombol Revoke; 4 revoked → 0 tombol (`d2-…png`). HMR dev server mem-pick perubahan tanpa restart. |

## 7. Verifikasi akhir (pasca semua aksi)

```
GET :3000 → 200
GET :3000/api/health?XTransformPort=3031 → 200
GET :3031/api/health → 200
agent-browser errors → (kosong; console hanya info React DevTools + [HMR]/[Fast Refresh])
```
Tidak ada screenshot yang menunjukkan error boundary putih; semua tabpanel ter-render konten.

## 8. Verdict AT-39

**PARTIAL → PASS dengan catatan (per bukti run ini).**
- a, c, d, e-dialog/toast, baseline a11y + responsive: **terbukti ter-scripted** (API probe + browser snapshot + screenshot, semua direproduksi pada run ini).
- b: **PARTIAL** — deny permission TAMPIL di UI (badge DENIED, acl_filtered, toast 403 ingest), tetapi klaim "UI menampilkan HTTP 403 untuk read lintas scope" TIDAK berlaku karena backend memang tidak menghasilkan 403 pada read (by design); jalur `purge_status=pending` dan 400-via-Test-button tidak eksis untuk diverifikasi (§3).
- Syarat agar bisa dinyatakan PASS penuh tanpa catatan: (1) putuskan/standardisasi klaim state (deny-read = allowed:false/acl_filtered, bukan 403) di teks AT-39; (2) jalankan mock provider (`:4511/4521/4522`) bila ingin memverifikasi jalur sukses probe. Keduanya di luar mandat sesi ini dan tidak diubah.
