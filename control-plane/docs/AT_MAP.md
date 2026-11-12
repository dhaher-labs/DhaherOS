# AT_MAP.md — Peta Acceptance Test Lokal ↔ Plan DhaherOS

**Dibuat:** 2026-11-12 (Fase 10 / run-58b, mandat pemilik "realisasikan DhaherOS_Plan.md v1.5 + V2 v1.6 secara keseluruhan")
**Plan kanonik:** `DhaherOS_Plan.md` v1.6 (md5 `92a1c36a07d4d61b43ced1de4ecf2be4`, sinkron dgn `upload/V2DhaherOS_Plan.md`)
**Sumber lama:** `verify_at.sh` (63 AT lama + blok Fase 10), `docs/EVIDENCE.md`

> **Catatan penting (collision):** beberapa ID lokal (`AT-13/14/19/20/42/43/44/45/46/47`) digunakan dulu oleh
> verify_at.sh dengan **semantik berbeda** dari AT bernomor sama di plan. Tabel ini memetakan semantik sebenarnya
> agar klaim "AT-x PASS" tidak pernah ambigu. AT Fase 10 sengaja memakai ID baru yang TIDAK bertabrakan.

## 1. Blok identik (semantik lokal = plan)

| ID lokal | AT plan | Cakupan | Status |
|---|---|---|---|
| AT-01..AT-09, AT-11, AT-12 | AT-01..AT-09/11/12 | task model, state machine, persistensi, secret-scan, cancel/timeout/retry, budget | PASS (63/63 lama) |
| AT-21 | AT-21 (sebagian) | flow steps/artefak/diff (kill-switch & override = ruang operator, lihat §3) | PASS (cakupan flow) |
| AT-32, AT-33, AT-34, AT-35, AT-36 | AT-32..AT-36 | knowledge ingest/ACL 2-titik/purge/sitasi/untrusted | PASS |
| AT-41 | AT-41 | adapter runtime berversi (bun/node/python3) | PASS |

## 2. Blok collision (ID lokal ≠ plan; ekivalen plan dicantumkan)

| ID lokal | Semantik LOKAL | Ekivalen di PLAN | Status |
|---|---|---|---|
| AT-13, AT-14 (lokal) | retry idempotent + reconcile uncertain + budget cap | plan AT-04/05 (retry/reconcile) + AT-07 (budget) | PASS |
| AT-15, AT-16, AT-17, AT-18 (lokal) | budget per-task/global, audit query | plan AT-07/08 | PASS |
| AT-19, AT-20 (lokal) | flow komposisi via control plane | plan AT-02/03 (executor flow) | PASS |
| AT-42, AT-43 (lokal) | org capability deny/allow + least privilege | plan §13 Tahap 5 gate (bukan plan AT-42/43 = API parity/tool sandbox) | PASS |
| AT-44 (lokal) | workflow policy binding pre-check per step | plan §13 Tahap 5 (workflow) | PASS |
| AT-45, AT-46, AT-47 (lokal) | provider registry kontrak + origin pinning | plan AT-28/29/30/31 (provider & credential) | PASS |
| AT-BH-01..05 | runtime layer blackhornet (11 seats) | DL-37 pivot §13 Tahap 3 | PASS |
| AT-PR-01..06 | provider contracts openai/anthropic + memory | plan AT-28..31 + §9 memory | PASS |
| AT-MEM-01..06 | memory lifecycle label/provenance/revoke | plan §9 memory | PASS |
| AT-OS-01..07 | operasi otonom: runbook/stop-safely/scheduler/kill-switch | plan §13 Tahap 8 | PASS |
| AT-SC-01..07 | scheduler dedup/budget/kill-switch/org-gated | plan §13 Tahap 8 | PASS |
| AT-GW-01..03 | gateway zero-egress + token ref + rate-limit | plan §8 daemon/gateway | PASS |
| AT-WK-01..03 | worker claim/heartbeat/report + seats | plan §8 worker/seats | PASS |
| AT-DM-01 | daemon beat/restart/kill-switch (manual) | plan §8 daemon | PASS |

## 3. Blok Fase 10 (ID baru, gap closure per audit 2026-11-12)

| ID lokal | AT plan ekivalen | Cakupan | Status |
|---|---|---|---|
| AT-BK-01 | **AT-22** (§12, DL-29) | backup snapshot db+artifacts+knowledge via `ops/backup.sh` (VACUUM INTO, mtime-safe) | PASS |
| AT-BK-02 | **AT-22** (§12, DL-29) | restore TERISOLASI ke scratch (:3037), konsistensi relasional task/event, tanpa menyentuh data live | PASS |
| AT-RC-01 | **AT-24** (§12) | race budget global: dua create paralel dgn sisa budget 1 → tepat 1 created, 1 budget_exhausted (reservasi atomik) | PASS |
| AT-ADV-01 | **AT-10** (§12) | task args berisi prompt-injection → tidak memperoleh privilege baru, 0 event capability tambahan | PASS |
| AT-ADV-02 | **AT-13** (§12) | knowledge doc berisi instruksi berbahaya → tetap untrusted, tidak memicu tool/grant baru | PASS |
| AT-TR-01 | **AT-18** (§12, DL-21) | trace_id/attempt_id korelasi task↔events↔artifacts + secret-scrub tetap (AT-09 grep 0) | PASS |
| AT-ENT-01 | §9 entities | task_dependencies: parent terminal sebelum child jalan; cycle/self/unknown ditolak ter-audit | PASS |
| AT-ENT-02 | §9 entities | decision_records append-only; tanpa rationale ditolak; tanpa rute mutasi; cross-scope read ditolak | PASS |
| AT-ENT-03 | §9 entities | evaluation_runs rekam hasil suite; validasi input; cross-scope read ditolak | PASS |
| AT-DE-01 | **AT-45** (§12) | degraded state: health menunjukkan degraded / event health_degraded saat beat gagal (scratch :3038) | PASS |
| AT-GR-01 | **AT-23** (§12) | knob grace `DHOS_STOP_GRACE_MS` di stop_daemon (default 1500 = perilaku lama persis); tanpa orphan | PASS |
| AT-CC-01 | **AT-16** (perluasan) | cache retrieval in-memory invalidate saat revoke/ingest; ACL tetap dua-titik (AT-33 tidak dilanggar) | PASS |

## 4. Sengaja TIDAK diimplement (owner-gated / conditional — jangan dikerjakan otomatis)

| Item | Alasan |
|---|---|
| AT-15 approval system (plan) | DL-13/35 OPEN — butuh keputusan pemilik (approval matrix) |
| AT-19/20 plan (MCP + OAuth) | DL-22 OPEN — kandidat reuse `rust/bh-mcp-bridge` repo A saat diputuskan |
| AT-26 WCAG 2.2 AA penuh | DL-26 OPEN; baseline keyboard/responsive sudah dicatat `docs/UI_EVIDENCE_AT39.md` §4 |
| AT-27 SBOM penuh | DL-27 OPEN; light inventory dilakukan: `docs/DEPENDENCY_INVENTORY.md` (2 repo) |
| AT-37 external-context disclosure | A5/DL-34 OPEN (zero-egress) — jalur UI disiapkan saat egress diputuskan |
| AT-44 plan (provider/task cache) | DL-36 OPEN; prasyarat ACL re-check sudah ditutup AT-CC-01 |
| AT-46/47/48 (P24) | "usulan bersyarat" di plan — bukan kewajiban MVP |
| Notification & Approval Center | DL-13 OPEN |
| A2A delegation | DL-20 OPEN (bukan MVP) |

## 5. Kejujuran bukti

- Klaim PASS di tabel ini hanya valid bila `bash verify_at.sh` terakhir exit 0 — lihat `docs/EVIDENCE.md`
  entry run Fase 10 (58-b) untuk total PASS/FAIL + timestamp UTC.
- AT-39 (UI state) diverifikasi scripted via browser: `docs/UI_EVIDENCE_AT39.md` (+20 screenshot) — verdict
  PASS dgn catatan (deny direpresentasikan `allowed=false`/`acl_filtered`, bukan HTTP 403 read — by design backend).
