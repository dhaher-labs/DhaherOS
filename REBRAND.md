# REBRAND — BlackHornet → DhaherOS

Kronologi resmi perubahan identitas proyek.

## 1. BlackHornet v7.0.0 — baseline

- Tag `v7.0.0` → commit `93f745edd2d9883f9a2e54f4feaddcb15b63289c`
  ("BlackHornet v7.0.0 — clean rebuild").
- `main` terakhir sebelum rebrand: `fbce17dba9ca6c17c59dd4166aa14aca835015b3`
  (docs: rebuild README_id/README_zh as faithful v7.0.0 translations).
- Distrobusi paket: `blackhornet-colony` 7.0.0.

## 2. Pivot DL-37 — 2026-11-06

- BlackHornet menjadi **runtime layer** di dalam **DhaherOS control-plane**.
- Bukti eksekusi: `/home/z/my-project/dhaheros` run-33 — **57/57 AT PASS**.
- Sejak titik ini, arah pengembangan dikendalikan oleh mandat Dhaher-Labs (DL-37).

## 3. Rebrand penuh — 2026-11-11

- Mandat pemilik 2026-11-11: *"rebrand blackhornet lokal full menjadi DhaherOS
  dan lanjutkan pengembangan"*.
- Cakupan rebrand (identitas & user-facing):
  - README (EN/ID/ZH): judul, badge v8.0.0, deskripsi, bagian **Credits & Heritage**.
  - CHANGELOG.md: entri v8.0.0.
  - Metadata paket: `blackhornet-colony` 7.0.0 → **`dhaheros` 8.0.0** (pyproject.toml).
  - `.github/workflows`: nama pipeline → DhaherOS.
  - Banner/teks installer & deploy (`install.sh`, `deploy.sh`, `hermes.sh`,
    `scripts/*`, `deploy/*`, `swarm-config/*`, `sovereign.py`).
  - String user-facing & docstring di `src/`, `tests/`, `rust/`.
  - Nilai runtime default & path: `/run/blackhornet/*.sock` → `/run/dhaheros/*.sock`,
    `BLACKHORNET_HOME` → `DHAHEROS_HOME`, dsb (konsisten in-repo).
  - Rename berkas: `deploy/blackhornet-hive.service` → `deploy/dhaheros-hive.service`,
    `scripts/blackhornet-cli.py` → `scripts/dhaheros-cli.py`,
    `scripts/blackhornet_watchdog.py` → `scripts/dhaheros_watchdog.py`,
    `tests/test_blackhornet_units.py` → `tests/test_dhaheros_units.py`,
    `src/plugins/memory/blackhornet_memory/` → `src/plugins/memory/dhaheros_memory/`.
- Verifikasi: `python -m pytest -q` → **0 failed** (552 passed, 29 skipped);
  `ruff check src/ --select E,F,W --ignore E501` → All checks passed.
- Pengecualian yang dijaga (tidak direname):
  - Identifier internal `bh_*` / `bh-*` (`src/bh_types`, crate Rust `bh-rtd`,
    `bh-bridge-uds`, `bh-mcp-bridge`, CLI `bh-colony`/`bh-omega`,
    env `BH_RUNTIME`) — heritage internal, rename berisiko pecah.
  - `src/omega/autopath.py` — modul orphan path-discovery, identifier internal dipertahankan.
  - Dokumen historis: `docs/13-changelog/`, `docs/12-tasks/plans/`, `docs/11-adr/`,
    `docs/02-arch/LEGACY_INVENTORY.md`, entri lama `CHANGELOG.md` — catatan sejarah.
  - `install.sh` array `ECOSYSTEM_REPOS` tetap memuat `"blackhornet"` — nama repo
    eksternal yang di-clone (mengikuti nama remote sampai rename remote Track 56-c).
- Fingerprint commit rebrand: _lihat hash commit yang membawa file ini_.
- Tag rilis pertama dengan nama baru: **`v8.0.0`** —
  "DhaherOS v8.0.0 — first release under new name (continuation of BlackHornet v7.0.0)".
