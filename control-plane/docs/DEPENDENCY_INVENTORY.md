# DEPENDENCY_INVENTORY — DhaherOS control plane (repo B, JS/Bun)

**AT-27 (light inventory, format-neutral — SBOM final menunggu DL-27)**

- **Tanggal pencatatan:** 2026-11-12, ~10:38 WIB (Asia/Jakarta) — sandbox `dhaheros-sandbox`
- **Dibuat oleh:** task 58-a (docs-sync), mandate pemilik 2026-11-12
- **Sifat:** inventory ringan (light) berbasis output perintah yang benar-benar dijalankan di sandbox ini; format netral. SBOM final (CycloneDX/SPDX) menunggu task DL-27.
- **Lingkup:** `/home/z/my-project/dhaheros` (control plane slice-1, Bun-first, zero-install).

## Runtime & toolchain (perintah yang benar-benar dijalankan)

| Perintah | Output | Waktu |
|---|---|---|
| `bun --version` | `1.3.14` | 2026-11-12 ~10:38 WIB |
| `node --version` | `v24.22.2` | 2026-11-12 ~10:38 WIB |
| `python3 --version` | `Python 3.12.16` | 2026-11-12 ~10:38 WIB |
| `curl --version` (baris pertama) | `curl 8.14.1 (x86_64-pc-linux-gnu) …` | 2026-11-12 ~10:38 WIB |

## package.json (repo B) — dependency deklarasi

`/home/z/my-project/dhaheros/package.json`:

```json
{
  "name": "dhaheros-control-plane",
  "version": "0.1.0",
  "private": true,
  "description": "DhaherOS Phase 1 slice-1 control plane — zero-install (bun:sqlite + Bun.serve + Bun.spawn)",
  "type": "module",
  "scripts": {
    "dev": "bun --hot src/index.ts",
    "start": "bun src/index.ts",
    "verify": "bash verify_at.sh"
  }
}
```

- **`dependencies`: tidak ada** (kunci tidak dideklarasikan) — desain zero-install: `bun:sqlite`, `Bun.serve`, `Bun.spawn` (API native Bun), tanpa package eksternal.
- **`devDependencies`: tidak ada.**
- Tidak ada lockfile di dalam `dhaheros/` (`bun.lock` yang ada berada di root `/home/z/my-project/` untuk proyek root, bukan untuk repo B).

## Binari runtime yang dipakai `verify_at.sh`

Diverifikasi dengan membaca `dhaheros/verify_at.sh` (2144 baris, dibaca 2026-11-12; hanya dibaca, tidak diubah):

| Binari | Dipakai di verify_at.sh untuk | Versi terpasang |
|---|---|---|
| `bash` | interpreter skrip (`#!/usr/bin/env bash`) | (shell sandbox) |
| `bun` | menjalankan service fresh: `bun src/index.ts` (port 3031) | 1.3.14 |
| `python3` | helper JSON/SQLite inline (`python3 -c`, heredoc `python3 -`) | 3.12.16 |
| `curl` | semua panggilan API (`curl -s -m …` ke `http://127.0.0.1:3031`) | 8.14.1 |
| `fuser` / `pkill` | manajemen proses pre-flight (kill port 3031) | util-linux/procps sandbox |

Catatan jujur: **`node` TIDAK dipanggil langsung oleh verify_at.sh** — `node v24.22.2` terpasang di sandbox tetapi runtime service adalah `bun` murni.

## Ringkasan

- Repo B sengaja **zero-dependency**: satu-satunya runtime wajib adalah **Bun ≥ API native** (terpasang: 1.3.14); node/python3/curl hanya alat bantu verify.
- Inventory ini bukan bukti implementasi — hanya snapshot environment sandbox pada tanggal di atas.
