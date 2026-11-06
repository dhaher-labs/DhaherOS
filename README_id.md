# BlackHornet

![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.11%2B-blue)
![Version](https://img.shields.io/badge/version-7.0.0-orange)
![Trading](https://img.shields.io/badge/trading-paper--only-red)

**Pilih bahasa:** [EN — English](README.md) · [ID — Bahasa Indonesia](README_id.md) · [CN — 中文](README_zh.md)

> **Status — rebuild bersih v7.0.0.**
> BlackHornet v7 adalah pembangunan ulang menyeluruh dengan **riwayat git satu-commit yang baru** (seluruh riwayat pra-v7 dipensiunkan karena alasan keamanan — lihat [Keamanan](#keamanan)).
> Modul trading-nya **paper-trading saja**. **Tidak ada konektivitas broker sungguhan.** Tidak ada bagian dari repositori ini yang merupakan saran finansial.

---

## Apa itu BlackHornet

BlackHornet adalah **platform koloni agent otonom** yang ditulis dalam Python: koloni proses agent yang saling bekerja sama dengan memori bersama, state ekosistem yang hidup, akses LLM tanpa kunci API, registri tool ter-sandbox, dan stack trading paper-only — disajikan lewat dashboard tanpa dependensi eksternal.

Ia **bukan** AGI, dan belum melakukan self-improvement dalam arti yang berarti. Sebagian bagiannya (loop "self-improvement" Omega dan debat Council) adalah **scaffolding tata kelola dengan output debat tersimulasi** dan diberi label demikian. README ini menjelaskan apa yang benar-benar berfungsi, diverifikasi terhadap kode dan suite 366-test pada baseline v7.

## Subsistem yang berfungsi

| Subsistem | Apa yang dilakukan | Status |
|---|---|---|
| **Memory federation** | Sistem memori SQLite + FTS5 (STM/LTM/semantik/episodik) dengan `MemoryFederation`: dedupe content-hash, merge berbobot kepercayaan, retrieval berperingkat kepentingan, pemangkasan TTL | Nyata, teruji |
| **Colony ecosystem** | Sync loop `EcosystemOrchestrator`; discovery peer UDP `ColonyRadar`; `MeshBus`; kesehatan/restart `SelfNest`; permukaan perintah `QueenAgent`. Mesh multi-instance hanya diuji unit test — tidak ada koloni kedua yang disertakan dalam repo | Nyata, single-node |
| **Jeumpa Brain** | Lapisan LLM tanpa kunci: 5 endpoint komunitas publik dengan profil tugas, cooldown, dan cache respons. Endpoint gratis pihak ketiga — ketersediaan dan kualitas tidak dijamin | Nyata, best-effort |
| **Tool registry** | Tool File / Shell / Code di balik registri dengan circuit breaker, rate limiting, dan sandboxing path | Nyata |
| **Risk officer** | Veto keras pada setiap trade: maks 0,5% risiko/trade, 1%/hari, 3%/minggu; veto dicatat log, tidak pernah dilewati | Nyata, paper-only |
| **Trading stack** | Data pasar yfinance → analisis teknikal → veto risiko → eksekusi **paper** → jurnal SQLite. Tidak ada kode broker di mana pun dalam tree | Nyata, paper-only |
| **Ecosystem state API** | `GET /api/v1/ecosystem` — `EcosystemState` kanonik yang diaudit (agent, tugas, debat, audit log) | Nyata |
| **Dashboard / UI** | Dashboard HTTP stdlib tanpa dependensi (port 8080) dengan API bridge dan event WebSocket | Nyata |
| **Swarm intelligence** | PSO (4 topologi), ABC, stigmergy — pustaka algoritma murni | Nyata, hanya matematika |
| **Knowledge graph** | Property graph SQLite + session recorder, terhubung ke dashboard | Nyata |
| **Self-healing** | Failure detector Phi-accrual | Nyata |
| **Omega Engine / Council** | Loop "self-improvement" + dewan konsensus 15 persona. Mesin matematika konsensusnya nyata; **debater-nya tersimulasi** — suara dan teks debat adalah string template, loop tidak menghasilkan pekerjaan nyata | **Eksperimental / tersimulasi** |
| **SAMAN governance** | Mesin konsensus (skor ≥ 0,85, 3 ronde, fail-closed), debate arena, sanitizer AST. Mesinnya sehat, menunggu debater nyata (berbasis LLM) | Mesin nyata, wiring eksperimental |

## Mulai cepat

Persyaratan: **Python ≥ 3.11** dan pip.

```bash
# install (editable, paket lokal "blackhornet-colony")
pip install -e .

# dashboard + ecosystem API + memory + graph (http://localhost:8080)
bh-colony

# loop tata kelola Omega (EKSPERIMENTAL — debat tersimulasi, lihat tabel di atas)
bh-omega

# loop paper-trading (berjalan lama; data pasar via yfinance, alert hanya jika
# variabel lingkungan TELEGRAM_* diisi — tidak ada konektivitas broker)
python -m src.hermes_quant

# jalankan suite pengujian
pip install -e ".[dev]"
pytest tests/ -q
```

Kredensial LLM dan alert dibaca hanya dari variabel lingkungan; tidak ada yang wajib untuk menjalankan dashboard. Jangan pernah meng-commit file `.env` — riwayat pra-v7 memuat satu file itu, dan itulah sebabnya riwayatnya dipensiunkan.

Docker: `Dockerfile` multi-stage non-root dan `docker-compose.yml` (service `omega`, `omega-loop`) tersedia; `deploy/` berisi unit systemd dan entrypoint container.

## Yang dihapus di v7

Ditinggalkan dalam rebuild (mati, rusak, atau dekoratif — lihat [PLAN.md](PLAN.md) untuk argumen lengkapnya): port `src/harness` dengan dependensi tak terdeklarasi, stack FastAPI yang yatim (`src/api`), modul `src/channels` dan `src/mcp` yang merusak import, pulau `.mjs` Node.js, sistem tipe yang terduplikasi, 102 file agent template, data runtime yang di-commit ke git, dan dokumen pemasaran di root. Game `ui/` warisan "Living World" dan pak `skills/` sedang dipisahkan dari tree produk.

## Arsitektur

Lihat [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) untuk peta modul, graf dependensi mermaid, alur data runtime (giliran agent, giliran paper-trading), lapisan persistensi, dan vonet jujur per subsistem.

## Roadmap

Setelah rilis, Python tetap menjadi runtime default (`BH_RUNTIME=python`); inti Rust ditumbuhkan di sampingnya di balik seam yang stabil (MCP, RAP, `ModelProvider`, store traits). Sikapnya: *adopsi protokolnya, sematkan runtime-nya, jangan pernah pindahkan koloninya*.

| Fase | Minggu | Tujuan |
|---|---|---|
| 0 | 0–2 | Ground truth: kontrak adapter; round-trip tool BH melalui endpoint RAP |
| 1 | 2–6 | Jembatan sebelum port: Infinity MCP bridge + `JeumpaProvider` yang mengimplementasikan `ModelProvider` |
| 2 | 6–12 | Wedge runtime: daemon Rust `bh-rtd` yang menyematkan `infinity-agent-core` di balik `BH_RUNTIME=rust` |
| 3 | 10–16 | Seam memori: store traits Infinity yang ditopang memori SQLite/FTS5 milik BH |
| 4 | 14–22 | Tool server RAP native di Rust (shell/file/search lebih dulu) |
| 5 | 20–30 | Hardening & UI: timer watchdog di Rust, pembaruan view ke dashboard |

Money-path trading **dikecualikan dari migrasi sampai Fase 5+**. Detail lengkap: [PLAN.md](PLAN.md) §4.

## Dokumentasi

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — peta arsitektur (v7)
- [docs/02-arch/MODULE_GRAPH.md](docs/02-arch/MODULE_GRAPH.md) — graf dependensi paket (hasil generate; regenerasi: `python3 scripts/gen_arch_graph.py`)
- [PLAN.md](PLAN.md) — rencana rebuild, detail roadmap, kriteria penerimaan
- [docs/13-changelog/](docs/13-changelog/CHANGELOG.md) — changelog historis dan audit integrasi SAMAN
- [README_zh.md](README_zh.md) — terjemahan bahasa Mandarin

## Keamanan

- **Riwayat baru:** seluruh riwayat git pra-v7 dipensiunkan karena sebuah file kredensial pernah ter-commit ke dalamnya dan ter-push ke remote publik. Siapa pun yang masih memegang clone pra-v7 harus menganggap kredensial itu bocor dan merotasinya.
- **Working tree:** dijaga bersih dari rahasia secara kebijakan; kredensial datang dari variabel lingkungan. Jika Anda menemukan rahasia di dalam tree, jangan buka isu publik — hubungi pemelihara proyek.
- **Keamanan trading:** jalur eksekusinya paper-only secara desain; tidak ada adapter broker di dalam codebase.

## Lisensi

[MIT](LICENSE) — Hak Cipta (c) 2026 Mulky Malikul Dhaher / kontributor Dhaher Labs.
