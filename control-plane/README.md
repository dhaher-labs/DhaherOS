# DhaherOS Control Plane (TypeScript prototype — Phase 0)

Implementasi control plane (task orchestration, executor, knowledge/RAG, memory lifecycle, org/capability, workflow, provider contracts, scheduler, worker/gateway/daemon) sesuai DhaherOS_Plan.md v1.6 §8/§10/§13.

- **Bahasa**: TypeScript (Bun + SQLite) — prototype Tahap 0; keputusan bahasa final (Rust vs TS) = **G-BSTACK OPEN** (menunggu pemilik, lihat plan §16).
- **Bukti**: `docs/EVIDENCE.md` — verify_at.sh **75 PASS / 0 FAIL** (2026-11-12, run-58): 63 AT inti + Fase 10 gap closure (AT-22 backup/restore, AT-24 budget race, AT-10/13 injection, AT-18 trace, §9 entities, AT-45 degraded, AT-23 grace, AT-16 cache-invalidate).
- **Peta AT**: `docs/AT_MAP.md` (ID lokal ↔ AT plan, collision di dokumentasikan jujur).
- **Zero-egress**: hanya 127.0.0.1/localhost; secret REFERENCE server-side; provider remote = DL-34 OPEN.
- Menjalankan: `bun src/index.ts` (:3031) — RUNBOOK: `docs/RUNBOOK.md`; verify: `bash verify_at.sh` (butuh bun+node+python3+curl).
- Source of truth live: sandbox `/home/z/my-project/dhaheros/` (mirror di repo ini untuk publikasi).
