# DhaherOS — Dokumen Rencana Terpadu

**Versi dokumen:** 1.6 — visi eksploratif P24, masukan kolaborator P25, dan gap OPEN
**Tanggal pembaruan:** 9 November 2026
**Status proyek:** visi dan rancangan awal; belum menjadi spesifikasi implementasi final
**Nama:** DhaherOS digunakan sebagai nama proyek dalam dokumen ini; nama produk/branding final masih terbuka.
**Sumber percakapan:** [P20/P22](https://chatgpt.com/share/6aeb5f3c-fd60-83ec-bc14-c18f348d59b9?ogimg=plain); [eksplorasi visi P24](https://chatgpt.com/share/6af17792-9adc-83ec-a338-0015947056c2?ogimg=plain). Status dan batas tiap sumber dijelaskan di §19.

> **Catatan format:** File ini adalah satu dokumen sumber yang menampung bagian-bagian setara README, blueprint/charter, PRD, design, architecture, goals, MVP, roadmap, changelog, keputusan, threat model, dan dokumen pendukung lain. Judul bagian bukan klaim bahwa file-file terpisah tersebut telah dibuat.
>
> **Catatan validitas:** Dokumen ini memisahkan pernyataan langsung pemilik, materi draft konsolidasi P22, permintaan provider/RAG/UI P23, eksplorasi visi P24, masukan kolaborator P25, enam sumber tambahan S1–S6, usulan, dan hal OPEN. Pada P24, ucapan pemilik dibedakan dari respons/rangkuman AI; usulan, contoh, istilah, angka, dan target dari AI bukan keputusan. P25 juga rekomendasi, bukan keputusan pemilik atau bukti implementasi. Rencana, wishlist, contoh UI, klaim CV, daftar kandidat, dan acceptance test bukan bukti kode, repository, koneksi, atau pengujian telah tersedia atau berhasil.

## Daftar isi

1. [README — ringkasan proyek](#1-readme--ringkasan-proyek)
2. [Blueprint dan project charter](#2-blueprint-dan-project-charter)
3. [Konteks pemilik dan sasaran pribadi](#3-konteks-pemilik-dan-sasaran-pribadi)
4. [Goals dan non-goals](#4-goals-dan-non-goals)
5. [PRD — kebutuhan produk](#5-prd--kebutuhan-produk)
6. [Katalog domain dan kemampuan](#6-katalog-domain-dan-kemampuan)
7. [Design — rancangan pengalaman dan alur kerja](#7-design--rancangan-pengalaman-dan-alur-kerja)
8. [Architecture — blueprint teknis](#8-architecture--blueprint-teknis)
9. [Model data dan lifecycle](#9-model-data-dan-lifecycle)
10. [Runtime dan kontrak adapter](#10-runtime-dan-kontrak-adapter)
11. [Keamanan, privasi, dan threat model](#11-keamanan-privasi-dan-threat-model)
12. [MVP — spesifikasi dan acceptance tests](#12-mvp--spesifikasi-dan-acceptance-tests)
    - [Prompt master untuk coding agent](#prompt-master-untuk-coding-agent)
13. [Roadmap dan gerbang tahap](#13-roadmap-dan-gerbang-tahap)
14. [Metrik dan evaluasi](#14-metrik-dan-evaluasi)
15. [Risk register](#15-risk-register)
16. [Decision log dan pertanyaan terbuka](#16-decision-log-dan-pertanyaan-terbuka)
17. [Changelog](#17-changelog)
18. [Glosarium](#18-glosarium)
19. [Sumber, batas bukti, dan status](#19-sumber-batas-bukti-dan-status)

## Status dan label informasi

- **[Pernyataan langsung — P16/P18/P20]**: pernyataan atau permintaan pemilik yang tercantum langsung dalam percakapan sumber.
- **[Materi draft — P22]**: isi teks konsolidasi yang ditempelkan pemilik sebagai tambahan. Draft itu sendiri menyebut baseline 28 Oktober 2026, versi 1.0-draft, dan belum diaudit terhadap repository atau mesin lokal. Isinya dipertahankan sebagai bahan perencanaan, bukan dianggap keputusan langsung yang telah dikonfirmasi satu per satu.
- **[Permintaan langsung — P23, 2026-11-05]**: pemilik meminta rancangan antarmuka provider custom OpenAI-compatible dan Anthropic-compatible, kemampuan RAG sederhana untuk dokumen/data/memory yang dipilih, serta pembaruan design UI. Permintaan ini memasukkan area tersebut ke cakupan dokumen; bukan bukti implementasi atau keputusan rinci API, penyimpanan, endpoint/provider, retensi, maupun framework.
- **[P24 — eksplorasi visi, 2026-11-09]**: share berisi ucapan pemilik, respons AI, fragmen transkripsi, dan rangkuman AI; hanya substansi ucapan pemilik dipakai sebagai konteks visi. Sesi menyatakan fase eksplorasi, tanpa keputusan teknis atau roadmap. Istilah/strategi/angka yang ditambahkan AI bukan keputusan pemilik.
- **[P25 — masukan kolaborator, 2026-11-09]**: rekomendasi nonbinding yang dihimpun Librarian dari agen/tim lain setelah berbagi brief visi netral. Bukan keputusan pemilik, bukan spesifikasi/arsitektur, dan bukan bukti implementasi; tidak ada dokumen mentah, tautan share, profil, atau data pribadi yang dibagikan.
- **[S1–S6]**: sumber tambahan yang dipetakan satu per satu di §19; setiap klaim mengikuti jenis sumbernya (catatan orang pertama, wishlist, contoh UI, kompilasi, klaim CV, atau spesifikasi generik), bukan otomatis menjadi keputusan produk.
- **[Usulan]**: sintesis/rekomendasi untuk membuat rencana bisa ditindaklanjuti; menunggu pemeriksaan atau keputusan bila berpengaruh pada produk.
- **[OPEN]**: belum diputuskan oleh pemilik atau belum cukup informasinya.
- **[Belum diverifikasi]**: memerlukan pemeriksaan repository, akun, runtime, data, atau pengujian sebelum dinyatakan benar.

---

## 1. README — ringkasan proyek

### Apa itu DhaherOS?

**[Pernyataan langsung — P20]** Pemilik ingin menyusun ulang DhaherOS dan menghubungkan AI dengan data. Ungkapan mengenai sambungan yang luas diperlakukan sebagai arah/visi integrasi, bukan izin untuk membaca semua data tanpa batas.

**[Materi draft — P22]** Draft membayangkan DhaherOS sebagai platform kendali dan operasi AI untuk pekerjaan pribadi, proyek, dan institusi. Platform mengoordinasikan tugas serta runtime yang berbeda, mengelola konteks dan akses, lalu memeriksa dan mencatat hasil. Bentuk produk terpadu ini adalah arah dalam draft; belum dikonfirmasi sebagai spesifikasi final.

### Ringkasan status

- **Sudah menjadi konteks langsung:** kebutuhan menata ulang DhaherOS; keinginan menghubungkan AI dengan data; aspirasi karier dan pendidikan pemilik yang dicatat pada bagian Goals.
- **Diusulkan draft:** fondasi Rust, runtime eksternal, model organisasi/capability, integrasi knowledge/repository, dan eksekusi bertahap.
- **Belum dibuktikan:** keadaan repository DhaherOS, implementasi kode, koneksi ke runtime atau sumber data, hasil benchmark, serta status pengujian.
- **Cakupan rancangan tambahan P23 (belum implementasi):** profil custom OpenAI-compatible dan Anthropic, RAG atas sumber dokumen/data/memory yang dipilih, serta UI provider/source/chat yang menampilkan kemampuan, izin, sitasi, dan disclosure konteks.
- **Konteks visi P24 (belum spesifikasi):** pemilik membayangkan leverage dan ekosistem yang dapat menemukan kebutuhan serta mengembangkan kemampuan/struktur sesuai kebutuhan, tanpa pemilik merancang atau mengelola setiap bagiannya. Ini tidak menetapkan model bisnis, otonomi tindakan, entitas, arsitektur, roadmap, atau MVP.
- **Langkah perencanaan berikutnya:** audit aset yang memang relevan untuk DhaherOS, putuskan cakupan MVP dan batas akses, lalu tetapkan satu alur kerja yang dapat diuji.

- Sumber tambahan S1–S6 memperkaya konteks personal dan memberi contoh/klaim yang perlu validasi, tetapi tidak membuktikan fitur, integrasi, atau status implementasi DhaherOS.
- Konflik prioritas, status pendidikan, dan keterkaitan aset/proyek dengan DhaherOS tetap OPEN.

### Prinsip penggunaan dokumen

Gunakan file ini sebagai peta keputusan dan rancangan awal. Jangan menganggap setiap domain harus dibuat sekarang, setiap runtime harus diintegrasikan, atau setiap usulan teknis sudah dipilih. Perbarui status keputusan setelah pemilik mengonfirmasi atau bukti teknis tersedia.

---

## 2. Blueprint dan project charter

### Eksplorasi visi P24 — belum menjadi spesifikasi

**[Pernyataan/eksplorasi pemilik — P24]** Dalam sesi 9 November, pemilik membayangkan sesuatu yang melampaui daftar agen atau organisasi tetap: sistem yang dapat menemukan kebutuhan/peluang yang belum diketahui, bereksperimen, mengadopsi atau membentuk kemampuan/struktur yang diperlukan, serta memelihara dan menghentikannya bila tidak lagi berguna. Pemilik tidak ingin merancang setiap unit atau menjadi operator harian; ia mencari leverage, kualitas, kepercayaan, dan hasil bernilai yang tidak bertambah hanya secara linear dengan waktu kerjanya. Ini adalah arah eksplorasi, bukan requirement yang sudah disetujui, bukti peluang pasar, atau izin bagi sistem untuk bertindak sendiri.

**[Rangkuman AI dalam sumber — bukan istilah/keputusan pemilik]** Sesi memakai label seperti “Self-Evolving Autonomous Intelligence Ecosystem” dan mengelompokkan kepentingan personal dengan aktivitas ekonomi independen. Label tersebut dibuat/dirumuskan dalam respons atau rangkuman AI; dokumen ini tidak mengangkatnya sebagai nama produk, model organisasi, atau batas domain final.

**[OPEN]** Apakah dan bagaimana visi ini diterjemahkan menjadi ruang lingkup produk; jenis entitas/struktur yang dimaksud; arti “menemukan peluang”, “hidup”, “self-sustaining”, dan “leverage”; batas eksperimen; serta bukti nilai dan kewenangan yang diperlukan.

### Tujuan

**[Pernyataan langsung — P20]** Menata ulang DhaherOS dan mengeksplorasi integrasi AI yang dapat mengakses data yang relevan.

**[Usulan]** Tujuan proyek adalah membangun perangkat lunak yang membantu mengubah konteks, tujuan, dan sumber data berizin menjadi pekerjaan yang dapat dijalankan dan diverifikasi. Fokus pertama bukan jumlah agen atau banyaknya integrasi, melainkan satu alur ujung-ke-ujung yang berguna, terbatas, bisa dihentikan, dan bukti hasilnya bisa diperiksa.

### Visi produk dalam draft

**[Materi draft — P22]** Platform dengan tiga skala kerja yang menggunakan fondasi dan model izin bersama:

1. **Personal OS** — tujuan, tugas, jadwal, riset pribadi, catatan, keputusan, pengingat, dan pekerjaan lintas proyek.
2. **Project OS** — repository, aplikasi, eksperimen, dokumentasi, issue, pengujian, deployment, riset, dan pemeliharaan.
3. **Institution OS** — Labs, perusahaan, quant desk, operasi media, organisasi, dan komunitas; tiap institusi dapat memiliki divisi, tanggung jawab, anggaran, workflow, pengetahuan, dan kebijakan sendiri.

Hubungan antar-skala—misalnya riset menjadi proyek engineering, produk, lalu pekerjaan bisnis atau konten—sebaiknya direpresentasikan sebagai tugas, dependensi, keputusan, dan artefak yang dapat ditelusuri, bukan hanya percakapan ant agen.

### Masalah yang hendak dipecahkan

**[Usulan dari P20 dan P22]** Konteks kerja tersebar di proyek, repository, catatan, runtime, dan sumber data. Tanpa kontrol terpadu, pekerjaan sulit dilanjutkan, akses sulit dibatasi, status dan hasil sulit dibuktikan, dan integrasi berpotensi berkembang lebih cepat daripada manfaatnya.

### Nilai yang dituju

- Satu pekerjaan mempunyai pemilik/konteks, status, izin, anggaran, hasil, dan bukti yang terlihat.
- Runtime dan konektor dapat dipilih sesuai kemampuan yang benar-benar diuji.
- Data diambil secukupnya, dengan provenance dan kemampuan mencabut akses.
- Sistem dapat menolak, menunggu, atau meminta persetujuan saat data, izin, atau nilai tindakan belum cukup.
- Pekerjaan berkembang melalui tahap dengan hasil yang dapat dijalankan, bukan hanya dokumen dan diagram.

### Prinsip desain tingkat proyek

1. **Bukti sebelum klaim.** Status sukses harus ditopang hasil pengujian, diff, artefak, atau evaluator yang sesuai.
2. **Least privilege.** Akses dimulai dari minimum yang diperlukan; sumber data dan tindakan ditambahkan secara eksplisit.
3. **Runtime tetap independen.** Orchestrator berkomunikasi melalui adapter/entrypoint dan tidak berpura-pura mengendalikan fitur yang runtime tidak sediakan.
4. **Tugas dan artefak dapat ditelusuri.** Simpan hubungan dari tujuan sampai evaluasi.
5. **Batas aman lebih penting daripada otonomi tanpa batas.** Persetujuan, anggaran, pembatalan, dan kondisi berhenti adalah bagian dari rancangan.
6. **Satu milestone, satu hasil nyata.** Perluasan terjadi setelah gerbang sebelumnya lulus.
7. **Domain adalah kemampuan yang dapat dikembangkan bertahap.** Katalog luas bukan daftar pekerjaan MVP.

---

## 3. Konteks pemilik dan sasaran pribadi

### Aspirasi yang dinyatakan

- **[Pernyataan langsung — P16]** Pemilik menggambarkan dirinya dalam konteks sebagai mahasiswa RPL/Teknik Informatika dan pekerja maintenance, serta meminta bantuan menyeimbangkan belajar pemrograman, jalur karier IT, website/portofolio, monetisasi, arus kas, tabungan, kuliah, proyek, dan pekerjaan.
- **[Pernyataan langsung — P18]** Aspirasi yang disebut adalah menjadi AI engineer, melanjutkan S2, pergi ke luar negeri, dan menjadi kaya.
- **[Pernyataan langsung — P20]** DhaherOS perlu ditata ulang dan ide integrasi AI/data menjadi motivasi proyek.

### Konteks tambahan dari bahan yang ditinjau

- **[Pernyataan orang pertama dalam workbook — S2; keberlakuan kini belum dipastikan]** Catatan menekankan keselamatan, menjaga arus kas, menghindari kebocoran/impuls, dan tidak melakukan trading impulsif saat emosi. Ini konteks dan aturan yang tertulis di workbook, bukan verifikasi kondisi finansial saat ini atau nasihat finansial; nominal dan rincian akun tidak disalin.
- **[Wishlist/aspirasi — S1/S2/S3]** Bahan sumber memuat tujuan bertahap terkait stabilisasi, keselamatan, pendidikan, usaha/pendapatan, AI/lab, ruang kerja, serta leverage jangka panjang. Label MUST/NEXT/LATER/FANTASY, status fase, biaya, dan rentang waktunya tidak diperlakukan sebagai anggaran, tenggat, atau komitmen aktif.
- **[Klaim CV — S4/S5]** CV menggambarkan pengalaman kerja operasional/maintenance dan keterlibatan pengembangan perangkat lunak, otomasi, serta proyek AI. Ini hanya konteks portofolio yang dilaporkan sendiri; tingkat kemahiran, status proyek, dan keterkaitannya dengan DhaherOS belum diverifikasi. Nama proyek legacy dari bahan sumber tidak dibawa ke rencana.
- **[Kompilasi — S3]** Ekspor Markdown merangkum profil, aspirasi, dan preferensi; ia bukan transkrip primer. Atribusi dalam ekspor tidak dinaikkan menjadi keputusan langsung tanpa sumber yang lebih kuat.
- **[OPEN]** Status pendidikan, program, dan jadwal studi saat ini perlu dikonfirmasi karena deskripsi pada rencana terdahulu, ekspor, dan CV tidak sepenuhnya selaras. Tujuan studi/karier tetap aspirasi, bukan spesifikasi produk.
- **[OPEN]** Prioritas antara stabilisasi/arus kas, trading, usaha, dan AI berbeda antar sumber. Pertahankan sebagai konflik yang perlu diklarifikasi; jangan menyatukan atau memilih prioritas diam-diam.

### Hubungan dengan DhaherOS

**[Usulan]** DhaherOS sebaiknya mendukung sasaran pemilik dengan mengubah proyek besar menjadi prioritas dan milestone yang dapat diukur, bukan menambah beban atau membuat seluruh domain aktif bersamaan. Pengembangan proyek tidak menggantikan pendidikan, pekerjaan, kesehatan, atau perencanaan keuangan pribadi.

### Yang bukan spesifikasi produk

Permintaan awal untuk potret pribadi, gambar, bahan story Instagram, dan perencanaan hidup adalah konteks percakapan, tetapi bukan persyaratan fitur DhaherOS dengan sendirinya. Domain konten/media dapat dipertimbangkan dalam visi platform; pembuatan fitur atau workflow khususnya bukan komitmen MVP.

**[OPEN]** Prioritas dan alokasi waktu antara kuliah, kerja, proyek, belajar, tabungan, dan rencana S2 belum ditetapkan di dokumen ini. Target tanggal, negara, program studi, dan ukuran finansial juga belum diberikan.

---

## 4. Goals dan non-goals

### Sasaran produk

**[Materi draft — P22]** Arah produk yang diusulkan:

- **G1 — Control plane terbukti:** menjalankan satu task dengan state persisten, status yang dapat diperiksa, dan hasil yang dapat diverifikasi.
- **G2 — Kerja lintas konteks:** menghubungkan pekerjaan personal, proyek, dan institusi melalui fondasi bersama dengan batas akses yang tetap terpisah.
- **G3 — Runtime federation:** memungkinkan integrasi beberapa runtime melalui kontrak adapter; runtime tambahan hanya dipertahankan bila memberi nilai yang terukur.
- **G4 — Knowledge dan provenance:** menemukan konteks relevan dan menunjukkan sumber, keputusan, serta artefaknya.
- **G5 — Pengelolaan capability:** mendefinisikan workflow, role, dan capability tanpa membangun agen permanen untuk tiap nama jabatan.
- **G6 — Otonomi terkendali:** menggunakan event, jadwal, dan tujuan untuk memilih pekerjaan berikutnya dalam batas izin, anggaran, dan kondisi berhenti.
- **G7 — Hasil yang dapat diuji:** setiap tahap menghasilkan perangkat lunak atau alur kerja yang dapat dijalankan dan dievaluasi.

### Cakupan langsung P23 dalam rancangan

- Profil endpoint custom OpenAI-compatible dan antarmuka Anthropic-compatible; usulan memisahkan endpoint custom dari adapter Anthropic native Messages.
- RAG sederhana atas dokumen, data proyek, dan memory yang dipilih/diotorisasi pemilik per scope, dengan provenance, sitasi, ACL dan lifecycle pencabutan.
- Design UI yang diperbarui untuk provider profiles, RAG source manager, memory, serta chat yang menampilkan provider, sumber dan konteks eksternal.

Permintaan ini memperluas cakupan dokumen, bukan menetapkan urutan MVP, pilihan teknis, atau status implementasi.

### Arah nilai dan leverage yang dieksplorasi pada P24

**[Pernyataan/eksplorasi pemilik]** Pemilik menekankan kualitas, brand, dan kepercayaan; ia menyebut pasar/pelanggan yang lebih selektif, produk bermutu tinggi, harga tinggi, serta hasil yang tidak bergantung secara linear pada waktu dan tenaga pribadi. Ini aspirasi yang diucapkan, bukan validasi segmen, willingness-to-pay, pendapatan berulang, atau model bisnis yang dipilih.

**[OPEN]** Pengguna/pembeli, masalah bernilai, channel, positioning/pricing, kebutuhan dukungan, dan biaya keseluruhan tetap harus diuji/diputuskan. Jangan menyalin rekomendasi AI tentang premium market/enterprise atau contoh angka menjadi strategi yang disetujui pemilik.

### Sasaran pemilik yang berkaitan

**[Pernyataan langsung — P16/P18]** Membangun jalur menuju karier AI engineering, pendidikan S2, kesempatan ke luar negeri, dan kondisi finansial yang lebih baik. Ini adalah aspirasi pribadi, bukan target bisnis yang sudah didefinisikan untuk produk.

**[Usulan]** DhaherOS dapat membantu melalui pengelolaan proyek dan portofolio belajar/engineering, tetapi kaitan tersebut perlu dibuktikan dengan hasil yang dipakai pemilik.

### Non-goals untuk MVP

**[Usulan]** MVP tidak akan berusaha:

- mengaktifkan seluruh katalog domain atau membuat puluhan persona/agen;
- memberikan akses tidak terbatas ke akun, repository, file, atau data pribadi;
- mengintegrasikan semua runtime, model, MCP, cloud, dan akun sekaligus;
- mengklaim sistem otonom yang berjalan tanpa pemilik, batas biaya, batas percobaan, atau mekanisme berhenti;
- membangun platform SaaS multi-tenant lengkap sebelum satu alur internal terbukti;
- memasukkan self-organization, penciptaan/penggabungan/penghentian entitas atau aktivitas ekonomi mandiri ke MVP sebelum tujuan, kewenangan, bukti nilai, dan batas risiko ditetapkan;
- menetapkan model bisnis, tarif, margin, lisensi komersial, atau target pendapatan tanpa keputusan dan data;
- menganggap diagram arsitektur atau struktur folder konseptual sebagai implementasi.

### Pertanyaan strategi produk yang belum dijawab

**[OPEN]** Siapa pengguna/pelanggan pertama? Apakah produk untuk penggunaan pribadi/internal atau akan dikomersialkan? Masalah apa yang paling bernilai untuk dibuktikan? Apa model pendapatan, harga, biaya operasional, dan margin yang diinginkan? Aspirasi menjadi kaya tidak otomatis menentukan model bisnis DhaherOS.

---

## 5. PRD — kebutuhan produk

### Pengguna dan konteks

**[OPEN — P24]** Share tidak menetapkan siapa yang akan mengoperasikan, menerima manfaat, memiliki, atau mengawasi ekosistem; istilah “pemilik”, “agent”, “divisi”, “perusahaan”, dan “entitas” belum menjadi model role/identitas/hak. Jangan menganggap tipe pengguna pada daftar P22 sudah tervalidasi.

**[Materi draft — P22]** Kemungkinan konteks pengguna meliputi:

- pemilik/pengguna individual yang mengelola tujuan dan proyek;
- pengelola proyek engineering atau repository;
- tim Labs/riset, quant, bisnis, konten, knowledge, keamanan, atau komunitas;
- organisasi yang membutuhkan pemisahan identitas, kebijakan, workflow, dan anggaran.

Ini adalah cakupan rancangan, bukan daftar pelanggan tervalidasi atau riset pengguna.

**[P24 — status]** Gagasan discovery, self-organization, eksperimen, penciptaan kemampuan/unit/entitas, dan keberlanjutan ekonomi adalah agenda eksplorasi, bukan kebutuhan fungsional yang masuk PRD atau roadmap implementasi.

### Kebutuhan inti

| ID | Kebutuhan | Prioritas rancangan | Status |
|---|---|---:|---|
| PR-01 | Membuat task dengan tujuan, konteks, resource, dan kriteria selesai yang eksplisit | MVP | Usulan |
| PR-02 | Menyimpan state task sehingga status penting tidak hilang setelah restart | MVP | Draft P22 + usulan |
| PR-03 | Menghubungkan task ke executor/runtime melalui adapter yang melaporkan kemampuan sebenarnya | MVP | Draft P22 + usulan |
| PR-04 | Menjalankan task hanya pada workspace dan resource yang ditentukan | MVP | Usulan keamanan |
| PR-05 | Merekam output, artefak, status, error, dan bukti evaluasi | MVP | Draft P22 + usulan |
| PR-06 | Memungkinkan operator memeriksa, membatalkan, dan meminta persetujuan untuk tindakan berisiko | MVP | Draft P22 + rekomendasi |
| PR-07 | Mengambil knowledge dengan sumber/provenance yang jelas | Tahap lanjut | Draft P22 |
| PR-08 | Menghubungkan repository lokal/cloud dan state proyek | Tahap lanjut | Draft P22 |
| PR-09 | Mengelola identity, organisasi, role, capability, policy, dan workflow | Tahap lanjut | Draft P22 |
| PR-10 | Menggunakan event, jadwal, dan perencanaan tujuan dengan kondisi berhenti | Tahap lanjut | Draft P22 |
| PR-11 | Menetapkan kontrol retensi, penghapusan, dan pencabutan akses sampai ke indeks/cadangan | Sebelum koneksi data luas | Rekomendasi; detail OPEN |
| PR-12 | Mengelola model, provider, biaya, resource, dan evaluasi model | Tahap lanjut | Draft P22; provider/anggaran OPEN |
| PR-13 | Mendukung profil endpoint custom OpenAI-compatible dengan base URL, model ID, auth/custom headers, dan capability probe yang dilaporkan per profil | Tahap lanjut; urutan OPEN | Permintaan langsung P23; detail protokol/kemampuan OPEN |
| PR-14 | Mendukung adapter Anthropic native Messages API yang terpisah dari adapter OpenAI-compatible dan melaporkan kemampuan yang benar-benar diuji | Tahap lanjut; urutan OPEN | Permintaan langsung P23; versi/fitur/provider lain OPEN |
| PR-15 | Menyediakan RAG sederhana atas dokumen, data, dan memory yang secara eksplisit dipilih/diotorisasi pemilik, dengan ACL, provenance, sitasi, dan lifecycle revoke/delete | Tahap lanjut; urutan OPEN | Permintaan langsung P23; rincian teknis OPEN |
| PR-16 | Memperbarui rancangan UI untuk profil provider, pengelola sumber RAG/memory, dan chat yang menunjukkan sitasi serta konteks eksternal | Perencanaan; implementasi OPEN | Permintaan langsung P23; framework/platform OPEN |

### Kebutuhan non-fungsional

**[Usulan]** Sistem perlu memenuhi sasaran berikut sebelum cakupan operasional diperluas:

- **Keamanan:** default deny, isolasi workspace, batas akses per proyek/organisasi, perlindungan credential.
- **Keandalan:** state tahan restart; retry tidak menghasilkan efek ganda yang tak terdeteksi.
- **Keterlacakan:** hubungan tujuan → task → delegasi → runtime/tool → artefak → evaluasi dapat diperiksa.
- **Pengendalian:** cancellation, timeout, batas resource/biaya, approval gate, dan kill switch.
- **Interoperabilitas:** kemampuan runtime dinyatakan lewat adapter dan diuji, bukan disimpulkan dari nama.
- **Perawatan:** modul dan dependency ditambahkan saat membuktikan nilai; batas arsitektur tidak memaksa microservice.
- **Privasi:** pengumpulan data secukupnya, provenance, dan kebijakan retensi/penghapusan yang kelak ditetapkan.
- **Batas provider/RAG:** izin sumber diperiksa oleh otoritas ACL sumber (otoritas mana yang dipilih tetap OPEN), bukan oleh model atau filter metadata indeks saja; konteks yang keluar ke endpoint remote ditampilkan dan memerlukan notice/approval yang ruang lingkupnya belum diputuskan.

### Kebijakan fitur dan prioritas

**[Usulan]** Urutkan prioritas berdasarkan manfaat yang bisa diuji, risiko, dan biaya pemeliharaan. Pekerjaan yang memiliki efek eksternal—misalnya publikasi, perubahan repository bersama, atau tindakan finansial—tidak boleh disamakan dengan pembacaan atau pembuatan artefak lokal.

---

## 6. Katalog domain dan kemampuan

**[Materi draft — P22]** Katalog berikut memetakan cakupan jangka panjang. Ini bukan rencana untuk membuat satu agent per jabatan dan bukan komitmen bahwa tiap domain masuk MVP.

1. **Executive, Commander & Personal Operations:** perencanaan, keputusan, tugas, jadwal, reminder, manajemen proyek, dan dukungan administratif.
2. **Labs & R&D:** riset literatur, eksperimen, analisis, benchmark, prototipe, dan transfer teknologi. P22 mencatat Labs sebagai domain penuh; struktur internalnya masih dapat berkembang.
3. **Software Engineering & Repository Operations:** arsitektur, Rust/web/API/database, DevOps/SRE, keamanan, QA, dokumentasi, release, CI, dan koordinasi repository.
4. **Quant, Trading & Investment:** riset pasar/strategi, data, backtest, pengelolaan risiko, validasi model, dan audit hasil.
5. **Company & Venture Operations:** strategi, riset pasar, produk, keuangan, penjualan, dukungan, pengadaan, kepatuhan, dan operasi.
6. **Content, Social Media & Distribution:** riset, editorial, copy, skrip, desain, video, media sosial/Instagram, publikasi, SEO, dan evaluasi performa.
7. **Knowledge, Librarian & Memory:** arsip, metadata, indeks, retrieval, verifikasi sumber, pencatatan keputusan, kontradiksi, dan pemeliharaan dokumentasi.
8. **Education & Advisory:** tutor, kurikulum, evaluator, mitra berpikir kritis, perencanaan belajar/karier, dan riset; informasi medis, jika kelak dipertimbangkan, perlu batas klinis yang tegas.
9. **Security, Privacy & Assurance:** audit akses, secure-code review, riset ancaman yang berizin, incident response, privasi, dan pemulihan.
10. **Organization & Community Operations:** struktur unit, moderasi, onboarding, acara, kebijakan, pengelolaan kontributor, dan kesehatan komunitas.
11. **Platform & Runtime Operations:** scheduler, model/router, konektor, resource monitoring, penyimpanan/backup, lingkungan eksekusi, observability, insiden, dan biaya.

**[Materi draft — P22]** Domain dapat dibagi lagi sesuai kebutuhan, misalnya Labs menjadi beberapa lab riset, engineering menjadi tim per repository, atau konten menjadi unit per brand/kanal. Struktur tersebut bukan keputusan final.

---

## 7. Design — rancangan pengalaman dan alur kerja

### Pengalaman operator dan design UI yang diperbarui

**[Materi draft — P22]** Permukaan pengalaman yang disebut mencakup command center, chat, CLI, dashboard, notifikasi, dan persetujuan.

**[Permintaan langsung — P23]** Cakupan rancangan sekarang mencakup UI yang diperbarui bersama profil provider dan RAG. Ini permintaan design, bukan klaim bahwa UI telah dibuat atau pilihan framework/platform.

**[Usulan design — perlu ditinjau pemilik]** Gunakan satu ruang kerja yang mengutamakan keterbacaan, hierarki status, dan kontrol sumber; jangan membuat dashboard dekoratif yang menyembunyikan izin atau provenance. Konsep layar inti:

- **Ruang kerja/Chat:** navigasi konteks proyek dan task; tujuan/kriteria selesai, provider/model aktif, status, batas/biaya yang tersedia, sumber konteks yang dipilih, sitasi per jawaban, serta preview dan approval atas konteks yang akan dikirim ke endpoint remote.
- **Provider Profiles:** protokol (custom OpenAI-compatible atau Anthropic native), endpoint/base URL dan model ID, status kemampuan yang diuji, referensi secret yang dimasking, hasil uji koneksi sintetis, retry/budget/cost status, dan kontrol disable/revoke. Tampilkan dengan jelas bila suatu fitur atau skema tool tidak didukung.
- **RAG Source Manager:** scope proyek/resource dan ACL, status ingest/sync/index, preview chunk beserta locator/version, sitasi/provenance, serta kontrol reindex/revoke/delete dengan status purge yang masih tertunda bila ada.
- **Memory panel:** pisahkan memory yang ditulis/disetujui pemilik dari ringkasan turunan agent; tampilkan sumber, waktu, versi, status kepercayaan/lifecycle, dan tindakan tinjau/cabut.
- **Status terpadu:** **[Usulan dari pola eksternal yang ditinjau—belum dipilih]** satu permukaan dashboard/API dapat menyajikan state kanonis task/agent/event dengan pembaruan status langsung bila mekanisme event dipilih; konsistensi API, transport/live updates, dan desain aksesibilitas masih OPEN.
- **Keadaan antarmuka:** permission-denied, sumber stale, no-result, provider error, capability mismatch, degraded/experimental, loading/sync, dan purge-pending harus mempunyai penjelasan dan tindakan berikutnya yang berbeda; jangan menyajikan no-result atau status degraded sebagai sukses.

**[Usulan]** Di setiap layar task, pertahankan visibilitas tujuan, resource/izin, executor dan kemampuan terverifikasi, status/progress, alasan berhenti, artefak, diff, hasil tes, dan evaluasi. **[OPEN]** Platform, framework UI, sistem desain/warna, navigasi final, responsivitas, serta target aksesibilitas belum dipilih. WCAG 2.2 AA tetap sasaran opsional untuk diputuskan sebelum klaim kesesuaian; tidak ada UI yang diklaim tersedia.

### Opsi alur personal dari contoh sumber

**[Contoh UI/worksheet — S1/S2; bukan keputusan produk]** Mockup dan workbook menampilkan konsep dashboard pribadi, pencatatan arus kas, daftar tujuan berstatus, serta alur input–proses–penyimpanan–output dan ringkasan berkala. Ini hanya bahan validasi kebutuhan. Klaim CV mengenai dashboard terdahulu tidak membuktikan bahwa proyek itu adalah DhaherOS atau aset yang siap dipakai ulang.

**[Usulan untuk dievaluasi]** Laporan status/audit berkala dari sumber yang secara eksplisit dipilih pemilik dapat menjadi satu kandidat workflow Personal OS. Ini bukan MVP, kebijakan pemantauan, atau izin membaca sumber secara otomatis. Sumber data, tujuan, kolom minimum, frekuensi, dan penerima harus ditetapkan terpisah.

### Siklus kerja

**[Materi draft — P22]** Siklus inti yang dicatat adalah:

`observe → understand state → detect gaps → research → decide → delegate → execute → verify → document → update state → repeat`

**[Usulan]** Setiap transisi menyimpan state dan alasan yang relevan. Sistem sebaiknya berhenti atau meminta arahan ketika data tidak cukup, izin tidak ada, risiko melampaui ambang yang kelak ditetapkan, atau nilai tindakan tidak sebanding dengan biaya.

### Lifecycle task konseptual

**[Usulan]** Status minimal yang bisa diuji dapat berupa:

`draft → ready → approved (bila diperlukan) → queued → running → verifying → succeeded`

Status akhir/pengecualian: `failed`, `blocked`, atau `cancelled`. Nama status dan transisi ini adalah rancangan awal; definisi final perlu disesuaikan dengan executor dan model persistensi.

### Tingkat efek tindakan

**[Rekomendasi tim]** Klasifikasikan tindakan sebelum dieksekusi, setidaknya menjadi:

- baca data/resource yang sudah diizinkan;
- perubahan lokal yang mudah ditinjau atau dibatalkan;
- perubahan pada resource bersama/remote;
- tindakan eksternal seperti publikasi atau komunikasi keluar;
- tindakan yang memiliki konsekuensi finansial, legal, atau sulit dibalik.

Tindakan berisiko lebih tinggi memerlukan izin eksplisit/approval sesuai policy. Ambang dan matriks final masih **[OPEN]**; daftar ini bukan policy yang sudah diterapkan.

---

## 8. Architecture — blueprint teknis

### Batas domain logis

**[Materi draft — P22]** Dua belas domain arsitektur berikut adalah batas tanggung jawab logis, bukan keputusan untuk membuat dua belas service/microservice:

1. **Human Control & Experience:** command center, chat, CLI, dashboard, notifikasi, persetujuan.
2. **Identity & Governance:** pengguna, organisasi, peran, policy, kepemilikan, dan wewenang delegasi.
3. **Intelligence & Planning:** planner, riset, kritik, advis, dan pengambilan keputusan.
4. **Orchestration & Work Management:** task graph, queue, scheduler, dependensi, event, retry, dan recovery.
5. **Federated Agent Runtimes:** adapter OpenCode, Hermes, runtime eksternal opsional, model/executor.
6. **Capability & Organization Engine:** registry role/capability, komposisi tim, template institusi, domain packs.
7. **Tools & Access:** MCP, konektor, shell, browser, API, referensi credential, dan approval.
8. **Knowledge & Memory:** Obsidian, librarian, provenance sumber, memori proyek, keputusan, dan pengetahuan institusi.
9. **Assets & Environments:** repository lokal/cloud, workspace, dataset, file, akun, artefak, dan metadata lingkungan.
10. **Domain Operations:** engineering, Labs, quant, bisnis, konten, personal, komunitas, dan keamanan.
11. **Evaluation & Evolution:** benchmark, verifikasi, penilaian kualitas, analisis kegagalan, dan peningkatan capability terkendali.
12. **Rust Core Infrastructure:** state persisten, event log, observability, enforcement keamanan, budget, backup, dan recovery.

### Layanan lintas-domain yang harus dipetakan

**[Materi draft — P22]** Komponen yang perlu masuk peta desain, walaupun tidak semua dibuat di awal:

- **Model Gateway / Provider Registry:** pemilihan model, fallback, batas token, biaya, latency, dan evaluasi model; rancangan membedakan endpoint custom OpenAI-compatible dari adapter Anthropic native dan menyatakan capability per profil/provider, bukan menjanjikan parity.
- **Trigger & Event Engine:** jadwal, perubahan repository, issue, kegagalan tes, eksperimen, atau peristiwa eksternal.
- **Notification & Approval Center:** laporan, permintaan persetujuan, eskalasi, dan pemberitahuan kegagalan.
- **Artifact & Provenance System:** versi output, sumber, commit, log, dataset, hasil agent, dan bukti verifikasi.
- **Budget & Resource Manager:** biaya model, jumlah worker, concurrency, CPU/memori, dan durasi.
- **Evaluation Registry:** kriteria kualitas yang sesuai untuk kode, riset, konten, quant, dan pekerjaan administratif.
- **Backup & Disaster Recovery:** pemulihan state, data, konfigurasi, dan workspace.
- **Integration Lifecycle:** discovery, onboarding, health check, versioning, deprecation, dan pencabutan akses.
- **Knowledge/RAG Service:** sumber yang dipilih pemilik, ingest/parse, chunk/index, pemeriksaan ACL saat retrieval dan sebelum konteks mencapai model, sitasi, serta propagasi revoke/delete; backend dan metode indeks tetap OPEN.
- **Tool Registry / Execution Guard:** **[Usulan dari pola eksternal yang ditinjau—belum dipilih]** pembungkus tool file/shell/code dengan scope/path sandbox, rate limit, dan circuit breaker; daftar tool, isolasi proses, serta kebijakan izin tetap OPEN.
- **Runtime Health & Recovery:** **[Usulan dari pola eksternal yang ditinjau—belum dipilih]** heartbeat/health, watchdog, dan state degraded/experimental yang eksplisit; auto-recovery hanya dalam batas policy dan tidak boleh membuat fake success. Mekanisme/ambang tetap OPEN.

### Observability lintas task (usulan)

**[Usulan — belum dipilih]** Rencanakan korelasi bukti dari task ke attempt, runtime, tool, artefak, dan evaluasi. Trace/span ID serta resource context dapat membantu menghubungkan log dan trace; rahasia harus disaring sebelum telemetry dikirim. Jika W3C Trace Context dipilih, propagasikan `traceparent`/`tracestate` sesuai spesifikasi; pertahankan event/audit log persisten sebagai bukti terpisah dari telemetry. OpenTelemetry adalah framework/toolkit vendor-netral, bukan backend; backend maupun adopsinya belum dipilih ([ringkasan OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/), [logs dan korelasi trace/span/resource](https://opentelemetry.io/docs/specs/otel/logs/), [W3C Trace Context](https://www.w3.org/TR/trace-context/), [propagasi context OpenTelemetry](https://opentelemetry.io/docs/specs/otel/overview/)). Semantik GenAI yang berstatus development tetap opsional dan berversi jika kelak dipertimbangkan.

### Bentuk implementasi awal yang diusulkan

**[Materi draft — P22]** Draft mengusulkan modular monolith berbasis Rust untuk core, sementara proses runtime agent berjalan terpisah. Kandidat fondasi lain: SQLite untuk state awal; Git/filesystem untuk repository, workspace, dan artefak; adapter process/API; CLI sebagai antarmuka awal; event log dan audit log; konfigurasi tervalidasi untuk role, capability, organisasi, dan workflow.

**[OPEN]** Belum ditetapkan: framework async, crate MCP, library database final, platform/framework UI, model deployment, detail cloud, provider/API/path/version dan capability yang didukung, secret storage, endpoint/egress policy, otoritas ACL per sumber, backend RAG (lokal/remote), lexical/vector/embedding, parser/chunking, batas ukuran/biaya, retensi/purge SLA, serta mekanisme sinkronisasi knowledge. Permintaan provider, RAG, dan UI masuk cakupan rancangan; rincian tersebut tidak diputuskan di sini.

### Workspace konseptual

**[Materi draft — P22]** Berikut sketsa batas tanggung jawab, bukan struktur direktori yang sudah ada atau instruksi membuat semua crate sekaligus:

```text
platform/
├── Cargo.toml
├── apps/
│   └── control-center-cli/
├── crates/
│   ├── domain-model/
│   ├── application-core/
│   ├── task-runtime/
│   ├── orchestration/
│   ├── runtime-federation/
│   ├── capability-registry/
│   ├── organization-engine/
│   ├── policy-engine/
│   ├── tool-gateway/
│   ├── mcp-center/
│   ├── credential-integration/
│   ├── repository-fabric/
│   ├── knowledge-fabric/
│   ├── event-engine/
│   ├── model-gateway/
│   ├── evaluation-engine/
│   ├── observability/
│   └── storage/
├── packs/
│   ├── engineering/  ├── labs/  ├── quant/
│   ├── business/     ├── media-content/
│   ├── personal-operations/  ├── knowledge/
│   ├── security/     └── community/
├── policies/  ├── schemas/  ├── migrations/
└── tests/
    ├── integration/  ├── recovery/
    ├── permissions/  └── evaluation/
```

**[Usulan]** Saat implementasi, gabungkan modul yang belum membutuhkan batas crate tersendiri. Hindari struktur besar sebelum ada satu jalur fungsional.

---

## 9. Model data dan lifecycle

### Entitas inti

**[Materi draft — P22]** Entitas bersama yang disarankan:

| Entitas | Fungsi rancangan |
|---|---|
| `Institution` | Perusahaan, Labs, komunitas, atau organisasi |
| `Division` | Unit kerja dalam institusi |
| `RoleDefinition` | Tanggung jawab, kompetensi, batas izin, dan kriteria sukses |
| `AgentInstance` | Executor yang sedang berjalan/dipanggil |
| `RuntimeAdapter` | Integrasi ke runtime eksternal |
| `Capability` | Kemampuan yang dapat digunakan atau dikomposisikan |
| `WorkflowDefinition` | Aturan proses yang dapat dijalankan |
| `Task` | Pekerjaan dengan state dan hasil |
| `TaskDependency` | Dependensi/urutan antarpekerjaan |
| `Project` | Tujuan dan konteks pekerjaan berkelanjutan |
| `Resource` | Repository, file, dataset, akun, workspace, atau layanan |
| `ToolDefinition` | Tool, skema, dan policy yang berlaku |
| `CredentialReference` | Rujukan aman ke credential, bukan nilai rahasia dalam teks |
| `KnowledgeRecord` | Catatan, sumber, ringkasan, dan metadata pengetahuan |
| `ProviderProfile` | Profil protokol/endpoint/model, referensi credential, dan capability yang diuji; skema final OPEN |
| `KnowledgeSource` / `SourceGrant` | Identitas sumber, scope proyek/resource, rujukan otoritas ACL, dan status izin/sinkronisasi |
| `KnowledgeVersion` / `KnowledgeChunk` | Versi/hash/locator sumber dan chunk turunan beserta relasi provenance/ACL; detail indeks OPEN |
| `MemoryRecord` | Memory berlabel user-authored/approved atau agent-derived, dengan sumber, waktu, versi, dan lifecycle |
| `DecisionRecord` | Keputusan, alasan, sumber, pemilik, dan status revisi |
| `Artifact` | Hasil kerja: laporan, patch, media, atau output eksperimen |
| `EvaluationRun` | Bukti pengujian dan kualitas |
| `Policy` | Izin, risiko, anggaran, dan persetujuan |
| `Event` | Perubahan/peristiwa yang dapat dicatat atau memicu pekerjaan |

Definisi perlu dibedakan dari instance eksekusi. Misalnya, sebuah role dapat dipakai berkali-kali; tiap eksekusi tetap mempunyai identitas, state, budget, dan audit trail sendiri.

**[P24 — implikasi yang masih OPEN]** Jika suatu saat struktur/entitas dapat berubah sendiri, provenance perlu menghubungkan usulan, alasan, keputusan otorisasi, perubahan lifecycle, pemilik/otoritas, sumber daya, serta hasil evaluasinya. Ini bukan keputusan menambah schema atau memberi sistem hak membuat/menggabungkan/menutup entitas. Jenis entitas, status legal, kepemilikan, tanggung jawab, dan pemisahan dari record teknis tetap OPEN.

### Task, event, artefak, dan provenance

**[Usulan]** Setiap task mengacu pada tujuan, resource, pemilik, policy, executor, status, timestamp, hasil, artefak, dan evaluasi; bedakan `task_id`, `attempt_id`/execution ID, dan `event_id`. Perubahan state dan event terkait harus tersimpan secara konsisten. Jika CloudEvents dipilih, keunikan `source` + `id` mengidentifikasi event berbeda, tetapi bukan jaminan pemrosesan tepat-satu-kali ([CloudEvents spec](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md); spesifikasi hanya berlaku jika diadopsi).

**[Usulan keselamatan retry]** Bila efek eksternal mungkin sudah terjadi tetapi konfirmasi hilang, tandai hasil sebagai **belum pasti** dan lakukan rekonsiliasi; jangan retry secara buta atau mengklaim exactly-once. Untuk request HTTP non-idempoten, RFC 9110 §9.2.2 menyatakan klien SHOULD NOT otomatis mengulanginya kecuali semantik idempotent diketahui atau diketahui request pertama belum diterapkan; ini bukan jaminan idempotensi untuk efek tool/agent di luar HTTP ([RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2)).

**[OPEN]** Skema final, penulisan state/event yang atomik, idempotency key, rekonsiliasi efek eksternal, retensi event/log, dan kebijakan provenance/penghapusan belum ditentukan.

### Knowledge dan repository

**[Materi draft — P22]** Draft menyebut `D:\\Obsidian` sebagai pustaka yang ingin dihubungkan serta repository lokal/cloud sebagai resource. Draft juga mencatat Git, GitHub, dan Composio MCP sebagai kemungkinan integrasi.

**[Belum diverifikasi]** Keberadaan, akses, lokasi aktual, isi, dan keadaan teknis Obsidian/repository/konektor tersebut belum diaudit. Draft yang menyebut pemilik “memiliki” atau “ingin” memakai sesuatu bukan bukti koneksi saat ini.

**[Usulan]** Bedakan fungsi Obsidian/knowledge notes, operational database, memori runtime, project state, dan artifact store. Untuk setiap record knowledge, simpan provenance secukupnya agar sumber dapat ditemukan; tentukan sinkronisasi, konflik, serta pencabutan akses sebelum integrasi luas.

**[P24 — eksplorasi institutional memory]** Pemilik menghendaki agar pengalaman/pengetahuan tidak harus hilang ketika agen atau unit berubah. Ini aspirasi, bukan izin menyalin memory lintas proyek/identitas atau memindahkan data otomatis. Otoritas pemilik, scope, consent, provenance, retensi, revocation, inheritance/transfer, dan penghapusan turunan/backup masih OPEN dan tunduk pada §11.

#### RAG sederhana untuk sumber yang dipilih

**[Permintaan langsung — P23]** RAG diminta untuk mencakup dokumen, data, dan memory. “Semua” berarti sistem kelak dapat menangani kategori sumber yang dipilih pemilik—bukan akses, penyalinan, atau pengindeksan otomatis atas seluruh file/akun/data. Setiap sumber dan scope proyek/resource harus dipilih serta diotorisasi secara eksplisit; credential/secret tidak boleh diindeks.

**[Usulan desain keselamatan — sumber otoritas dan penyimpanan tetap OPEN]** Alur konseptualnya adalah: (1) pilih sumber dan scope; (2) ingest/parse dengan metadata source ID, project/resource scope, rujukan otoritas ACL, versi/hash, locator, timestamp, dan relasi `derived_from`/turunan; (3) chunk/index dengan strategi yang masih OPEN; (4) pada setiap query, validasi izin terkini terhadap otoritas ACL sumber sebelum hasil retrieval diberikan; (5) validasi ulang tepat sebelum konten terpilih dikirim ke model; (6) batasi konteks pada bagian relevan yang diizinkan; lalu (7) jawab dengan sitasi source, locator, dan versi. Filter metadata/indeks boleh membantu penyaringan, tetapi bukan sumber otorisasi yang berwenang. Sistem yang menjadi otoritas ACL untuk tiap konektor masih OPEN.

Konten hasil retrieval tetap data tak tepercaya, bukan instruksi. Bila tidak ada sumber yang lolos atau hasil relevan tidak ditemukan, jawaban harus mengatakan tidak ditemukan dan tidak membuat sitasi/isi rekaan. Memory pemilik yang ditulis atau disetujui harus dibedakan dari ringkasan/derivasi agent; masing-masing menyimpan sumber, waktu, versi, dan lifecycle sehingga asal-usul serta pencabutan dapat ditelusuri. **[Usulan dari pola eksternal yang ditinjau—belum dipilih]** Kategori memory berlapis (mis. short-term/long-term, semantic/episodic), deduplikasi content-hash, penggabungan berbobot confidence, ranking importance, atau pruning berbasis TTL dapat dievaluasi kelak; bukan requirement atau izin ingest otomatis. Setiap memory tetap harus memiliki sumber/scope/ACL, provenance dan lifecycle yang diotorisasi; TTL/retensi tetap OPEN.

Pencabutan atau penghapusan sumber segera membuatnya retrieval-denied berdasarkan otorisasi terkini, sekalipun purge fisik belum selesai. Status purge yang tertunda harus terlihat; purge diteruskan ke chunk, index, cache, memory, dan data turunan. Retensi, batas waktu purge/SLA, cakupan backup/log, dan metode storage belum dipilih. Panduan OWASP RAG dan contoh Microsoft security trimming mendukung pengujian kontrol ini, tetapi bukan klaim compliance atau keputusan backend ([OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html); [Microsoft document security trimming](https://learn.microsoft.com/en-us/azure/developer/python/get-started-app-chat-document-security-trim)).

---

## 10. Runtime dan kontrak adapter

### Kandidat dan status menurut draft

| Nama | Catatan P22 | Perlakuan di rencana ini |
|---|---|---|
| Rust | Draft menyebut sebagai pilihan bahasa baru untuk core | Usulan fondasi; perlu konfirmasi dan audit kebutuhan |
| OpenCode | Draft menyatakan pemilik memilikinya | Kandidat executor awal; kepemilikan dan kemampuan belum diperiksa |
| Hermes Agent | Draft menyatakan pemilik memilikinya | Kandidat executor awal; kepemilikan dan kemampuan belum diperiksa |
| `D:\\Obsidian` | Draft menyebut sebagai pustaka knowledge | Kandidat sumber; akses dan sinkronisasi belum diperiksa |
| ORCA | Draft menyebut belum digunakan | Evaluasi opsional, bukan fondasi saat ini |
| DeepSeek harness | Draft menyebut belum digunakan | Evaluasi opsional, bukan fondasi saat ini |
| OpenFang, Prime Agent, DeerFlow, OpenMausBot, Infinity | Disebut sebagai kandidat dari pembahasan terdahulu | Belum dipilih; penempatan fungsi dalam draft hanya hipotesis |
| Composio MCP, GitHub | Disebut sebagai integrasi yang ingin dipertimbangkan | Perlu menentukan kebutuhan, akses, dan API yang benar-benar diperlukan |
| A2A | Opsi masa depan hanya jika delegasi task ke agen remote independen dibutuhkan | **OPEN; bukan MVP.** A2A berfokus pada kolaborasi agent-to-agent, sedangkan MCP pada tools/resources; evaluasi hanya setelah kebutuhan terbukti ([perbandingan A2A dan MCP](https://a2a-protocol.org/v1.0.0/topics/a2a-and-mcp/)). |

Semua status di tabel berasal dari draft dan belum diaudit secara independen. Pemetaan runtime ke fungsi bukan hasil benchmark.

**[Usulan bersyarat — bila MCP dipilih]** Pin versi protokol dan uji kompatibilitas sesuai versi: spesifikasi 2026-07-28 memakai versi per-request dan `server/discover`, dengan extension negotiation; versi lama menggunakan initialization/capability handshake menurut pembahasan kompatibilitas pada spesifikasi baru. Gunakan hanya fitur yang didukung/diiklankan menurut versi tersebut, gagal dengan aman pada versi atau kapabilitas wajib yang tidak kompatibel, dan uji timeout, cancellation, serta shutdown bersih ([MCP versioning/compatibility 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle)). Ini bukan keputusan integrasi MCP.

### Antarmuka provider model dalam cakupan rancangan

**[Permintaan langsung — P23]** Rancangan provider harus mendukung custom OpenAI-compatible dan Anthropic-compatible interface. **[Usulan refinement]** Registry membedakan dua jalur, tanpa menyamakan kompatibilitas dengan parity:

1. **Endpoint custom OpenAI-compatible:** profil konfigurabel dengan base URL, model ID, auth dan custom headers melalui referensi secret server-side, serta capability probe/status spesifik pada endpoint/model. SDK resmi OpenAI menyediakan konfigurasi base URL, tetapi itu tidak menjamin server tujuan mendukung semua fitur atau skema OpenAI. Catat protokol/versi dan kemampuan yang benar-benar diuji.
2. **Anthropic native Messages API:** adapter tersendiri untuk `POST /v1/messages`; tangani versi API lewat `anthropic-version`, autentikasi (`Authorization: Bearer` atau `x-api-key` sesuai metode yang dipilih), dan `anthropic-workspace-id` bila diperlukan. Nilai versi, pilihan auth/workspace, fitur, model, dan provider deployment tetap OPEN.

Lapisan Anthropic yang menerima OpenAI SDK adalah opsi kompatibilitas berbeda dari Messages native; dokumentasi Anthropic menyebutnya terutama untuk evaluasi/perbandingan dan bukan solusi jangka panjang/produksi bagi kebanyakan penggunaan. Jangan menganggapnya default atau menyamakan dukungan field/tool schema. Capability test harus menggunakan payload sintetis aman, bukan dokumen/data/memory pemilik. Field, parameter wajib, atau tool schema yang tidak didukung harus menghasilkan kegagalan eksplisit, bukan dihilangkan diam-diam. Uji auth, error, stream, retry, budget/cost, serta batas capability sesuai kontrak yang akhirnya dipilih.

**[Usulan keselamatan]** Validasi URL/origin/transport/TLS dan batas egress sebelum koneksi untuk membatasi SSRF; ikat auth/custom headers ke host yang telah dikonfigurasi dan cegah credential leak pada redirect atau request ke origin lain. Kebijakan allowlist egress, proxy, jaringan, secret storage, serta detail URL validation tetap **[OPEN]**. Uji koneksi tidak boleh mengirim data sumber. **[Usulan dari pola eksternal yang ditinjau—belum dipilih]** Profil task provider dapat dievaluasi bersama cooldown/backoff, cache yang dibatasi, dan pelaporan provider/latency; bila cache dipilih, scope permission harus diisolasi dan ACL diperiksa kembali saat cache hit serta cache invalidated pada perubahan/revoke sumber. Semantik cache, fallback, cooldown, dan backoff tetap OPEN. Sebelum permintaan real dikirim ke provider remote, UI menampilkan provider/endpoint dan kategori serta isi konteks sumber yang akan keluar; approval/notice eksplisit diperlukan, sedangkan cakupan dan masa berlaku approval tetap OPEN. Ini persyaratan rancangan, bukan izin untuk mengirim data atau membuat provider.

### Kontrak adapter yang diusulkan

**[Materi draft — P22]** Adapter perlu melaporkan, sesuai kemampuan runtime:

- pengiriman task dan konteks;
- identitas execution dan status;
- output, artefak, dan bukti yang tersedia;
- error, timeout, cancellation, dan exit status;
- informasi resource/biaya bila runtime menyediakannya;
- referensi resume bila runtime mendukungnya.

**[Usulan CFO — kontrak manifest adapter]** Cantumkan runtime, versi kontrak, transport, dan hanya capabilities yang benar-benar diuji; unsupported version/capability harus dinyatakan eksplisit. Bedakan status menunggu input dari status terminal, serta permintaan pembatalan dari penghentian yang sudah dikonfirmasi. A2A v1.0 memberi contoh task version/status semantics, tetapi tidak mewajibkan DhaherOS mengadopsinya ([A2A v1.0](https://a2a-protocol.org/v1.0.0/specification/)). Manifest, field wajib, dan state machine tetap usulan, bukan implementasi/keputusan. Integrasi runtime lain hanya setelah kontrak dan satu integrasi awal terbukti berguna.

**[Usulan dari pola eksternal yang ditinjau—belum dipilih]** Pisahkan runtime sebagai proses melalui kontrak bridge/adapter yang stabil dan berversi; JSON Lines request/response, error eksplisit, health/heartbeat, dan capability test adalah kandidat—bukan transport/format yang sudah dipilih. API/state boundary untuk task/event serta retry, timeout, cancellation, heartbeat, dan shutdown perlu diuji terhadap runtime nyata sebelum dipakai.

---

## 11. Keamanan, privasi, dan threat model

**[Materi draft — P22]** Draft menekankan identitas, policy, permission, isolasi workspace, approval, anggaran, audit log, pembatalan, dan recovery. Nilai kontrol berikut adalah sasaran desain; belum ada bukti implementasi.

### Aset yang perlu dilindungi

- credential/token dan identitas pengguna;
- catatan pribadi, data institusi, dataset, repository, dan workspace;
- task, keputusan, logs, artefak, backup, indeks, serta data turunan;
- integritas perubahan dan hasil evaluasi;
- biaya model, resource komputasi, dan integrasi eksternal.

### Batas kepercayaan

**[Rekomendasi tim]** Tetapkan batas eksplisit di antara: pengguna dan control plane; satu proyek/organisasi dengan lainnya; core dengan runtime eksternal; core dengan tool/MCP/API; workspace lokal dengan resource remote; data tepercaya dengan konten yang diambil dari repository, Obsidian, output runtime, atau konektor. Data tidak tepercaya tidak boleh mengubah identity, policy, izin, atau konfigurasi sistem.

### Ruang lingkup untuk telaah hukum (OPEN; bukan nasihat hukum)

**[Usulan CFO]** Sebelum menyimpulkan aturan Indonesia yang berlaku, catat dulu operator yang bertanggung jawab, model deployment/penggunaan, apakah akses bersifat publik, serta tujuan dan jenis pemrosesan data. Peran hukum dan kewajiban belum dapat ditetapkan dari rencana ini saja. Tinjau kembali teks dan status peraturan yang berlaku sebelum peluncuran; jangan menyatakan kepatuhan atau kewajiban tertentu sebelum scope diketahui ([UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022); [Permenkominfo No. 5 Tahun 2020](https://jdih.komdigi.go.id/produk_hukum/view/id/759/t/peraturan+menteri+komunikasi+dan+informatika+nomor+5+tahun+2020)). Status amendemen/keberlakuan terkini kedua rujukan tersebut **belum diperiksa dalam pembaruan ini**; pertanyaan applicability tetap OPEN.

### Ancaman dan kontrol yang diusulkan

| Ancaman | Dampak | Kontrol/tes yang disarankan | Status |
|---|---|---|---|
| Akses lintas proyek/organisasi | Kebocoran atau perubahan data | Isolasi konteks dan default deny; tes negatif lintas batas | Draft P22 + rekomendasi |
| Prompt/instruksi berbahaya di file, knowledge, MCP, atau output runtime | Eskalasi hak atau tindakan tak sah | Perlakukan konten eksternal sebagai data; policy tidak dapat diganti oleh konten; uji injeksi | Draft P22 + rekomendasi |
| Credential masuk prompt, log, memory, atau artefak | Pengambilalihan akun/data | Simpan hanya referensi credential, minimalkan paparan, scrub logs; tes kebocoran; jangan indeks secret | Draft P22 + usulan |
| Runtime/worker bertindak di luar workspace | Perubahan atau eksfiltrasi tak diizinkan | Sandbox, allowlist resource, batas filesystem/network sesuai kebutuhan; verifikasi isolasi | Draft P22 + rekomendasi |
| Retry/restart menjalankan efek samping dua kali | Duplikasi publikasi/perubahan | Idempotency/deduplication, state durable, approval untuk tindakan berisiko | Rekomendasi tim |
| Task macet atau biaya/resource berlebih | Gangguan layanan atau biaya tidak terkendali | Batas waktu, resource, biaya, jumlah run/worker, kill switch | Draft P22; angka OPEN |
| Approval dilewati atau identitas pelaku kabur | Tindakan tanpa kewenangan/jejak | Policy enforcement, identitas delegasi, audit trail, deny-by-default | Draft P22 + rekomendasi |
| Pencabutan izin tidak menyebar | Akses berlanjut melalui cache/salinan/backup | Retrieval-denied segera dari ACL terkini; track purge ke chunk/index/cache/memory/turunan; SLA tetap OPEN | Rekomendasi tim |
| Metadata filter dianggap sebagai otorisasi RAG | Kebocoran lintas proyek atau setelah grant berubah | Periksa otoritas ACL sumber saat retrieval dan sekali lagi sebelum konteks mencapai model; uji lintas proyek | Usulan refinement |
| Sumber RAG dicabut tetapi masih ada di cache/memory/index | Jawaban memakai salinan yang tidak lagi berizin | Blok retrieval segera; tampilkan purge-pending dan lanjutkan purge ke seluruh turunan | Usulan refinement |
| Endpoint provider custom memicu SSRF atau mengalihkan credential | Akses internal atau secret terkirim ke host yang tidak dipilih | Validasi URL/origin/TLS dan batas egress; bind header ke host, cegah redirect lintas-origin; allowlist/network policy OPEN | Usulan refinement |
| Endpoint kompatibel mengabaikan field atau tool schema | Perilaku berbeda tanpa diketahui pengguna | Capability probe, manifest per endpoint, dan explicit fail untuk field/skema wajib yang tidak didukung | Usulan refinement |
| Kegagalan/rollback tak terdeteksi | State korup atau perubahan tertinggal | Backup, recovery drill, cancellation dan restart tests | Draft P22 |

### Rekomendasi keamanan berbasis sumber primer (belum diterapkan)

- **Prompt injection dan agency.** Perlakukan input langsung maupun tidak langsung dari file, knowledge, atau tool sebagai tidak tepercaya. OWASP menyatakan RAG/fine-tuning tidak sepenuhnya menghilangkan prompt injection; enforce otorisasi secara deterministik di aplikasi/sistem downstream, batasi tool/izin/otonomi dengan least privilege, dan minta persetujuan untuk tindakan berdampak tinggi ([OWASP LLM01:2025](https://genai.owasp.org/llmrisk/llm01-prompt-injection/); [LLM06:2025](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/)). Ini rekomendasi desain dan uji adversarial, bukan klaim perlindungan sempurna.
- **Risiko agentic untuk threat review.** OWASP Top 10 for Agentic Applications (label 2026; diterbitkan 9 Desember 2025) mencantumkan goal hijack, tool misuse, identity/privilege abuse, supply-chain vulnerabilities, unexpected code execution, memory/context poisoning, insecure inter-agent communication, cascading failures, human-agent trust exploitation, dan rogue agents. Gunakan sebagai taksonomi untuk meninjau ancaman—bukan bukti bahwa risiko tersebut telah terjadi atau seluruhnya tercakup ([OWASP Agentic Top 10](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/)).
- **Risk management dan privasi.** NIST AI 600-1 dapat dipakai sebagai panduan sukarela sepanjang siklus Govern/Map/Measure/Manage, termasuk adversarial/context testing, pemantauan, provenance/retensi, dan respons insiden; pilih tindakan sesuai konteks, bukan klaim sertifikasi ([NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence)). NIST Privacy Framework 1.0 adalah versi final sukarela; versi 1.1 pada rekaman NIST yang dirujuk masih berlabel Initial Public Draft—periksa kembali statusnya sebelum keputusan implementasi ([PF 1.0 final](https://csrc.nist.gov/pubs/cswp/10/nist-privacy-framework-version-10/final); [PF 1.1 draft](https://csrc.nist.gov/pubs/cswp/40/nist-privacy-framework-11/ipd)). Tidak ada klaim compliance atau sertifikasi.
- **Akses berpusat pada resource.** NIST SP 800-207 mendukung prinsip tidak memberi kepercayaan implisit hanya karena lokasi jaringan/ownership dan menilai akses per resource/sesi dengan hak minimum; ini rujukan desain, bukan bukti kesesuaian atau kewajiban hukum ([NIST SP 800-207](https://csrc.nist.gov/pubs/sp/800/207/final)).
- **MCP/OAuth, jika benar-benar dipakai.** MCP authorization bersifat opsional; aturan authorization yang dirujuk berlaku terutama pada HTTP. Bila fitur itu dipilih, ikat token pada resource/audience server tujuan, tolak token passthrough, dan validasi redirect URI. Consent per-client berlaku pada skenario proxy/confused-deputy yang dideskripsikan; persetujuan sebelum menjalankan command lokal berlaku bila klien menawarkan konfigurasi server lokal one-click. RFC 9700 adalah BCP OAuth umum, bukan sumber aturan MCP ([MCP Authorization 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization); [MCP Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices); [MCP Local Server SEP-1024](https://modelcontextprotocol.io/seps/1024-mcp-client-security-requirements-for-local-server-); [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700.html)). Ketentuan MUST/SHOULD mengikuti versi dan cakupan dokumen; bukan kewajiban hukum universal.

### Data dan credential

- **[Materi draft — P22]** Credential hanya direpresentasikan dengan referensi aman; jangan menaruh nilai rahasia di prompt, log, atau knowledge.
- **[Rekomendasi tim]** Batasi scope credential per konektor/resource dan berikan hanya saat diperlukan. Catat identitas penggunaan tanpa mencatat nilai rahasia.
- **[OPEN]** Penyimpanan credential, rotasi, masa berlaku, retensi log, penghapusan data, redaksi output, serta penghapusan indeks/cache/cadangan belum dipilih.
- **[Rekomendasi untuk intake sumber personal — belum diterapkan]** Sebelum menghubungkan file atau data pribadi: minta persetujuan eksplisit untuk sumber dan tujuan tertentu; ambil hanya kolom minimum sesuai tujuan; pisahkan akses per proyek; simpan provenance; redaksi identifier/nilai sensitif pada output dan log; tetapkan retensi serta penghapusan yang mencakup log, indeks, cache, backup, dan salinan turunan.
- File personal mentah tidak masuk ke knowledge umum secara default. Jika kelak diperlukan, pemilik memilih sumber, tujuan, cakupan, dan retensinya; proses harus dapat ditinjau dan aksesnya dicabut.
- **[Usulan refinement RAG]** Untuk setiap request remote, tunjukkan sumber/kategori dan konteks yang akan dikirim; kirim hanya setelah notice/approval eksplisit sesuai aturan yang kelak dipilih. Persetujuan untuk menulis rencana ini bukan authorization transfer. Gunakan penyimpanan credential server-side melalui reference, bukan nilai rahasia di UI, prompt, index, atau log.
- **[OPEN]** Endpoint allowlist/egress policy, otoritas ACL untuk tiap tipe sumber, granularitas approval outbound, endpoint/provider registry yang disetujui, dan detail penyimpanan secret belum diputuskan.

### Otonomi, approval, dan kondisi berhenti

**[Materi draft — P22]** Otonomi dapat memakai event-driven initiative, scheduled operations, goal-driven planning, dan controlled self-improvement. Sistem juga harus dapat menunggu jika tidak ada task bernilai cukup, data tidak memadai, atau izin belum tersedia.

**[Rekomendasi tim]** Setiap task otonom memiliki pemilik, izin, anggaran/batas percobaan, dan kondisi stop. Eksperimen self-improvement berjalan terisolasi dan tidak boleh mengubah policy/permission; perubahan capability dibandingkan terhadap baseline sebelum promosi.

**[OPEN]** Batas numerik biaya, jumlah percobaan, durasi, concurrency, serta jenis tindakan yang selalu memerlukan persetujuan belum ditentukan.

### Recovery dan respons insiden

**[Usulan]** Definisikan prosedur untuk menghentikan worker, mempertahankan bukti yang aman, merekonsiliasi state setelah restart, memulihkan backup, mencabut konektor/credential, dan memeriksa efek samping. Uji recovery sebelum mengandalkan operasi berjadwal atau unattended.

### Operasi setelah deployment dan penghentian (usulan)

Sebelum mengaktifkan operasi tanpa pengawasan, tetapkan pemantauan pascadeployment, jalur umpan balik operator dan override, perubahan yang terkendali, serta prosedur disable/decommission; pertahankan incident response dan recovery yang sudah tercatat di atas. Pemilik, pemicu, dan perilaku penghentian masih OPEN, tanpa ambang angka yang dikarang. Ini gerbang rancangan masa depan yang sejalan dengan panduan risiko GAI NIST AI 600-1, bukan bukti operasi atau implementasi.

### Tata kelola operasi (usulan CFO; belum diputuskan)

Tetapkan pemilik/steward untuk kontrol dan capability; catat residual risk, siapa yang berwenang menerima risiko, pemicu review ulang, panduan operator dan titik human validation, jalur feedback/incident, serta review capability change sebelum promosi. Ini melengkapi approval, stop, recovery, dan evaluasi yang sudah dirancang; bukan bukti governance telah berjalan atau klaim compliance. Owner, frekuensi/pemicu, dan ambang review tetap OPEN.

### Lisensi dan syarat penggunaan

**[OPEN]** Lisensi dan terms untuk model, runtime, dataset, library, sumber data, serta distribusi produk belum diinventarisasi atau diputuskan. Periksa sebelum memilih dependency, data, atau model untuk implementasi/komersialisasi.

---

## 12. MVP — spesifikasi dan acceptance tests

### Hipotesis MVP

**[Usulan konsolidasi dari P22]** MVP terkecil yang berguna adalah control plane Rust yang dapat dijalankan dengan satu cara mengirim task, state persisten, satu executor nyata pada repository/workspace uji, artefak yang dapat diperiksa, dan hasil verifikasi yang jujur. Pilihan Rust/CLI/runtime masih perlu dikonfirmasi dan diuji; kandidat runtime awal adalah OpenCode atau Hermes, bukan kewajiban mengintegrasikan keduanya sekaligus.

### Cakupan yang diusulkan

1. Buat dan tampilkan task dengan tujuan, resource target, dan kriteria selesai.
2. Simpan state/event task secara persisten.
3. Jalankan task pada workspace uji yang dibatasi melalui satu executor terpilih.
4. Rekam status, output, error, artefak/diff, dan bukti verifikasi.
5. Dukung timeout dan pembatalan; cegah duplikasi yang tidak terdeteksi saat restart/retry.
6. Tolak tindakan tanpa izin dan catat alasan penolakan.
7. Sediakan jalur inspeksi untuk status dan hasil sebelum memperluas otomatisasi.

### Di luar cakupan MVP

Integrasi semua sumber data, semua runtime/provider, dashboard lengkap, aplikasi multi-tenant siap produksi, seluruh domain bisnis, social media autopublishing, cloud-wide access, autonomous self-improvement, penciptaan/penggabungan/penutupan entitas secara mandiri, dan model pendapatan/komersialisasi.

Laporan status/audit pribadi berkala bukan bagian MVP sampai dipilih dan dirumuskan sebagai satu workflow yang punya sumber, tujuan, batas data, persetujuan, dan kriteria selesai. Impor file pribadi mentah ke knowledge umum juga bukan perilaku default.

### Acceptance tests yang dapat gagal

Tidak ada hasil tes yang dilaporkan di sini. Setiap tes berikut adalah kriteria yang harus dijalankan; kegagalan berarti gate belum lulus.

Tes P24 berikut hanya **usulan bersyarat** jika pemilik kelak memilih mengimplementasikan self-organization/economic activity; bukan keputusan bahwa kemampuan itu masuk MVP.

| ID | Skenario | Lulus hanya jika… |
|---|---|---|
| AT-01 | Membuat dan menjalankan task valid | Task menerima ID/state; hasil dan bukti bisa ditautkan ke task |
| AT-02 | Restart setelah state tersimpan | Setelah proses dimulai ulang, state penting dipulihkan tanpa task sukses palsu |
| AT-03 | Runtime gagal atau timeout | Error/timeout tercatat; status tidak salah dilaporkan sebagai sukses; worker berhenti sesuai batas |
| AT-04 | Pembatalan saat berjalan | Permintaan pembatalan dibedakan dari penghentian terkonfirmasi; executor berhenti, atau task ditandai belum pasti/perlu rekonsiliasi; tidak ada efek samping tak diketahui yang dilaporkan sukses |
| AT-05 | Akses tanpa izin | Operasi ditolak secara default dan penolakan tercatat |
| AT-06 | Target workspace tidak cocok | Executor tidak mengubah resource di luar workspace yang disetujui |
| AT-07 | Artefak/verifikasi | Diff/output dan bukti tes/evaluator tersimpan; klaim sukses konsisten dengan bukti |
| AT-08 | Retry/restart dan hasil efek eksternal tak pasti | Setelah crash pada titik efek terjadi tetapi hasil belum tercatat, task ditandai belum pasti dan direkonsiliasi; retry hanya saat idempotensi diketahui atau non-application dipastikan, tanpa klaim exactly-once |
| AT-09 | Pemeriksaan kebocoran secret | Secret uji tidak ditemukan pada prompt/log/memory/artefak; tes otomatis harus gagal bila ada kebocoran |
| AT-10 | Konten berbahaya dalam file/knowledge/output | Konten tersebut tidak dapat menaikkan hak atau mengganti policy; operasi berbahaya ditolak |
| AT-11 | Traceability | Alur task → delegasi → runtime/tool → artefak → evaluasi dapat ditelusuri |
| AT-12 | Anggaran dan stop cap | Ketika batas konfigurasi tercapai, task berhenti/menunggu dan menjelaskan alasannya |
| AT-13 | Prompt injection langsung/tidak langsung | Fixture adversarial di prompt dan konten eksternal tidak dapat mengganti policy, membocorkan secret, atau memicu tool/action tanpa otorisasi; keputusan akses tetap ditegakkan aplikasi/downstream |
| AT-14 | Kredensial read-only dan least privilege | Kredensial read-only tidak dapat menulis/menghapus; operasi tidak berizin ditolak oleh pemeriksaan otorisasi downstream |
| AT-15 | Persetujuan terikat payload | Persetujuan berlaku hanya untuk action, resource, dan payload yang ditampilkan; perubahan target atau payload membatalkan persetujuan lama dan meminta yang baru |
| AT-16 | Pencabutan akses dan salinan turunan | Setelah grant dicabut, akses ke sumber dan salinan/index/cache yang dicakup ditolak; retensi/penghapusan backup dan turunan mengikuti kebijakan yang ditetapkan |
| AT-17 | Batas retry/call loop | Retry dan loop tool/agent berhenti pada cap konfigurasi dan menjelaskan sebab; tidak ada pemanggilan tersembunyi setelah cap tercapai |
| AT-18 | Korelasi observability | Satu task dapat ditelusuri melintasi execution, runtime, tool, artefak, dan evaluasi dengan trace/span dan konteks resource yang konsisten; telemetry tidak memuat secret |
| AT-19 | Versi/kapabilitas MCP (jika dipilih) | Versi yang tidak kompatibel atau fitur wajib yang tidak didukung gagal dengan aman; mode versi yang dipin mengikuti negotiation/discovery yang sesuai versi, hanya memakai capabilities/extensions yang didukung; timeout, cancellation, dan shutdown ditangani |
| AT-20 | Authorization MCP/OAuth (jika dipilih) | Token untuk audience/resource lain atau token passthrough ditolak, redirect yang tak terdaftar gagal, dan consent/approval hanya berjalan pada skenario proxy atau konfigurasi lokal yang berlaku; pembatalan mencegah eksekusi |
| AT-21 | Override dan disable/decommission | Operator dapat meninjau status, melakukan override, menghentikan operasi terjadwal/tanpa pengawasan, dan mencabut grant; state/hasil penghentian tercatat dan alur recovery dapat dijalankan |
| AT-22 | Pemulihan backup terisolasi | Restore dijalankan terpisah dari process restart; task, event, artefak dan relasinya konsisten sesudah restore; bukti dan batas validasi dicatat |
| AT-23 | Penghentian worker/proses | Setelah dispatch dihentikan dan stop diminta, sistem menunggu grace period yang dipilih, memverifikasi child/worker berhenti, atau menandai task untuk rekonsiliasi; nilai grace tetap OPEN |
| AT-24 | Persaingan budget/concurrency | Dua task yang bersaing untuk satu slot atau sisa budget tidak melampaui batas yang dikonfigurasi; reservasi, dispatch, dan settlement konsisten; satuan/batas tetap OPEN |
| AT-25 | Versi dan kalibrasi evaluasi | Fixture/case berversi; deterministic checks terpisah dari scoring subjektif; hasil dibandingkan per kasus dengan baseline; jika LLM grader dipilih, kalibrasi terhadap penilaian manusia dan uji bias posisi |
| AT-26 | Aksesibilitas UI (jika UI dipilih) | Target WCAG 2.2 AA diputuskan sebelum klaim; uji keyboard/focus, contrast, status/error yang dapat diakses; ringkasan approval menyebut action/target/impact sebagai kriteria produk tambahan ([W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)) |
| AT-27 | Gate supply-chain rilis (jika rilis/distribusi dipilih) | Dependency ter-resolve diinventarisasi; SBOM tertaut ke artefak; RustSec advisory diperiksa jika Rust dipilih; provenance artefak diverifikasi bila SLSA dipilih; owner remediasi/exception tercatat; format/vendor/tenggat tidak diasumsikan |
| AT-28 | Capability provider per endpoint/model | Protokol, versi yang relevan, model ID, dan hanya capability yang berhasil diuji tercatat; nama "compatible" tidak dianggap parity atau bukti endpoint berfungsi |
| AT-29 | Fitur/field atau tool schema tidak didukung | Bila fitur wajib/skema tool tidak didukung, request gagal secara eksplisit dan menyebut capability; tidak ada field wajib yang diam-diam diabaikan atau diklaim berhasil |
| AT-30 | Credential provider dan origin endpoint | Auth/custom header hanya dikirim ke host yang dikonfigurasi dan TLS/origin tervalidasi; redirect atau perubahan host tidak membocorkan credential; kebijakan egress diuji sesuai pilihan yang kelak disetujui |
| AT-31 | Uji koneksi provider | Capability/connection test hanya memakai payload sintetis aman, tidak mengirim sumber pemilik, dan menampilkan endpoint serta hasil yang benar-benar diuji |
| AT-32 | Pemilihan sumber dan scope RAG | Hanya sumber dokumen/data/memory yang dipilih dan diotorisasi untuk scope proyek/resource tersebut yang dapat di-ingest; secret/credential tidak masuk index |
| AT-33 | ACL RAG lintas proyek dan tepat sebelum model | Akses yang ditolak otoritas ACL sumber tak dapat diambil; ACL terkini diperiksa saat retrieval dan diperiksa lagi segera sebelum potongan konteks dikirim ke model |
| AT-34 | Revoke/delete dan purge turunan RAG | Revoke/delete langsung membuat sumber retrieval-denied walau purge pending; status terlihat dan purge mencakup chunk, index, cache, memory, dan data turunan sesuai kebijakan yang dipilih |
| AT-35 | Provenance, sitasi, dan no-result | Jawaban bersumber menyertakan source/version/locator (dan hash bila tersedia); tanpa hasil yang lolos, sistem berkata tidak ditemukan tanpa membuat isi atau sitasi |
| AT-36 | Konten retrieval berbahaya | Instruksi dalam dokumen tetap data tak tepercaya; tidak dapat mengubah policy, melewati ACL, memicu tool tanpa izin, atau menyuntikkan sitasi rekaan |
| AT-37 | Disclosure konteks eksternal | Sebelum request remote, pengguna melihat provider dan konteks/sumber yang akan keluar; tidak ada request bila approval/notice yang diwajibkan belum ada atau payload berubah dari yang disetujui |
| AT-38 | Provenance lifecycle memory | Memory user-authored/approved terpisah dari ringkasan agent-derived; sumber/waktu/versi/lifecycle bisa dilihat dan revoke/delete tidak meninggalkan memory turunan yang masih dapat diretrieval |
| AT-39 | UI provider/RAG/chat dan keadaan error | UI rancangan/implementasi menunjukkan provider/capability, sumber/sitasi dan disclosure konteks serta membedakan permission-denied, stale, no-result, provider error, dan purge-pending tanpa status sukses palsu |
| AT-40 | Endpoint kompatibilitas berperilaku buruk | Auth ditolak, error/timeout, respons/stream malformed atau terpotong, dan batas biaya yang tersedia ditangani sebagai status eksplisit; tidak ada respons salah yang dianggap sukses atau retry/biaya tersembunyi |
| AT-41 | Bridge runtime berversi (jika dipilih) | Request/response JSON Lines atau format yang dipilih tervalidasi per versi; error, heartbeat/health, capability, timeout, cancellation, dan shutdown tidak pernah dilaporkan sebagai sukses palsu |
| AT-42 | State task/event dan UI status | API boundary dan dashboard menampilkan state task/agent/event yang sama; live update (jika dipilih) terurut/terkoreksi setelah reconnect dan tidak menutupi status degraded/experimental |
| AT-43 | Tool registry dan sandbox | Tool file/shell/code yang dipilih tidak melampaui path/scope yang diotorisasi; rate limit/circuit breaker (jika dipilih) menghentikan call sesuai batas dan mencatat alasan |
| AT-44 | Provider/task cache dan revoke (jika cache dipilih) | Cache terikat ke profile dan scope izin; ACL sumber dicek kembali pada hit dan revoke/update membatalkan respons/chunk turunan yang sudah cached sebelum retrieval berikutnya |
| AT-45 | Health/watchdog dan degraded state | Health failure/heartbeat hilang menghasilkan status degraded/blocked yang terlihat; watchdog/recovery tidak melewati policy/stop cap, menggandakan side effect, atau melaporkan sukses tanpa bukti |
| AT-46 (usulan bersyarat) | Otorisasi lifecycle entitas | Jika lifecycle entitas dipilih, create/merge/pause/stop harus mencatat pemilik/approver, alasan, scope grant, perubahan data/resource, provenance, dan rollback/closure; aksi di luar kewenangan ditolak |
| AT-47 (usulan bersyarat) | Pemisahan personal vs entitas | Jika entitas ekonomi dipilih, data, aset, dana, biaya, credential, dan approval personal tidak dapat digunakan silang tanpa grant eksplisit; audit mengaitkan biaya dan otorisasi ke entitas/task yang tepat |
| AT-48 (usulan bersyarat) | Nilai bersih eksperimen | Jika eksperimen ekonomi dipilih, keputusan continue/revise/stop memakai baseline dan manfaat yang terukur/terealisasi setelah seluruh biaya langsung/tidak langsung; potential revenue atau aktivitas saja tidak lulus gate |

**[Masukan kolaborator P25 — usulan]** Review evaluasi dapat mencatat kualitas bukti, privasi, stop/rollback, biaya dan latensi, selain keberhasilan task; pilihan dan ambang tetap OPEN.

**[OPEN]** Batas numerik dan metode pengukuran pada AT-12 ditentukan setelah provider, alur, dan baseline biaya dipilih.

### Gate MVP

**[Materi draft — P22]** Target awal yang tertulis adalah program Rust yang dapat dijalankan, task tersimpan persisten, pengujian lulus, dan satu pekerjaan nyata yang dapat diverifikasi. Ini adalah target masa depan; tidak ada klaim bahwa target tersebut telah tercapai.

---

## Prompt master untuk coding agent

> Salin prompt berikut ke coding agent setelah file ini tersedia di lingkungan proyek. Prompt ini dirancang untuk menuntun pekerjaan sampai selesai sejauh ruang lingkup, bukti, izin, dan lingkungan memungkinkan; prompt ini tidak menjamin hasil tanpa kesalahan.

````text
Anda adalah coding agent untuk proyek DhaherOS. Tuntaskan pekerjaan yang diminta dari inspeksi hingga implementasi dan verifikasi, dalam batas izin yang tersedia. Jangan menjanjikan hasil bebas kesalahan; buktikan klaim dengan pemeriksaan dan laporkan batas yang belum terselesaikan.

SUMBER KEBENARAN DAN PRIORITAS
1. DhaherOS_Plan.md adalah spesifikasi awal tunggal. Temukan dan baca seluruh isi DhaherOS_Plan.md sebelum merencanakan; setelah itu, inspeksi hanya file proyek yang relevan dan diizinkan. Jika file kanonis tidak ada, tidak lengkap, atau ada beberapa salinan yang bertentangan, hentikan perubahan dan laporkan masalah sumber kebenaran.
2. Ikuti instruksi terbaru pemilik dan batas izin lingkungan. Bedakan dengan jelas status: keputusan/pernyataan langsung pemilik, materi draft P22, permintaan langsung P23, eksplorasi visi P24, usulan, OPEN, dan belum diverifikasi. Pernyataan langsung terbaru mengalahkan draft lama.
3. Perlakukan setiap hal berlabel OPEN sebagai belum diputuskan: jangan memilih nilai, stack, provider, anggaran, kebijakan, akses data, lisensi, retensi, jadwal, atau model bisnis dengan menebak. Jangan menyelesaikan konflik material dalam dokumen dengan asumsi. Jika keputusan itu memengaruhi akses, data lintas-tenant/proyek, uang/provider, lisensi, retensi, efek eksternal, deployment, atau migrasi, hentikan bagian tersebut dan minta keputusan pemilik. Lanjutkan hanya pekerjaan independen yang aman.
4. Draft P22 adalah bahan rancangan, bukan bukti implementasi, audit, izin akses, atau keputusan final. Verifikasi keadaan sebenarnya dari repository, kode, konfigurasi, tes, dokumentasi, serta status repository/worktree sebelum mengubah apa pun.

5. P24 adalah eksplorasi visi: hanya substansi ucapan pemilik boleh dicatat sebagai arah eksploratif. Rangkuman/respons AI, label konsep, angka, contoh strategi, atau proposal teknis bukan keputusan pemilik. Jangan mengubah P24 menjadi roadmap, MVP, arsitektur, atau izin tindakan otonom; pertahankan yang belum diputuskan sebagai OPEN sampai ada instruksi pemilik yang jelas.

EVIDENCE, SCOPE, AND SAFETY GATES
1. Untuk sumber eksternal, simpan judul, URL, versi/tanggal publikasi, tanggal akses, provenance, dan status (normatif, sukarela, atau bersyarat). Utamakan sumber primer; jangan klaim sumber sudah dibuka bila hanya diberikan sebagai tautan. Jika pemilik melarang riset tambahan, jangan browsing; tandai yang belum diperiksa dan jaga sebagai OPEN.
2. Bedakan pernyataan pemilik, usulan CFO/agent, rekomendasi eksternal, spesifikasi normatif dalam cakupannya, panduan sukarela, dan implementasi yang benar-benar terbukti. Jangan menyatakan penggunaan standard/framework berarti compliance atau sertifikasi.
3. Sebelum menyatakan hukum Indonesia berlaku, identifikasi operator, model deployment/use, akses publik, tujuan dan jenis pemrosesan data; jangan menyimpulkan role/kewajiban tanpa fakta yang cukup dan jangan meluncurkan tanpa recheck hukum terbaru yang relevan.
4. Efek eksternal dengan hasil yang tidak pasti tidak boleh otomatis diulang; catat state belum pasti dan rekonsiliasi. Identitas task/attempt/event terpisah. Permintaan cancellation bukan konfirmasi berhenti—verifikasi proses/worker berakhir atau tandai perlu rekonsiliasi. Process restart bukan backup restore; uji restore terisolasi sebelum klaim pemulihan.
5. Bila UI dipilih, aksesibilitas adalah target desain/tes yang harus diputuskan; jangan mengklaim sesuai WCAG tanpa bukti. Bila merilis artefak, pertimbangkan gate inventory dependency, SBOM terkait artefak, pemeriksaan advisory, owner remediasi/exception, dan verifikasi provenance; format/vendor/tenggat tetap OPEN sampai diputuskan.

6. Provider compatibility bukan jaminan parity. Pisahkan custom OpenAI-compatible profile (base URL/model/auth/custom headers/capability per endpoint) dari Anthropic native Messages adapter (`POST /v1/messages`, versi/auth/workspace header sesuai pilihan). Jangan diam-diam menghilangkan field/tool schema wajib yang tidak didukung; gunakan explicit fail. Tes koneksi hanya dengan payload sintetis. Validasi URL/origin/TLS dan egress untuk membatasi SSRF; cegah credential terkirim ke host/redirect lain. Detail egress policy dan secret storage tetap OPEN.
7. RAG mencakup hanya dokumen/data/memory yang dipilih dan diotorisasi pemilik per scope; jangan indeks secret. Terapkan authoritative ACL check saat retrieval dan tepat sebelum konteks masuk ke model (filter metadata bukan otoritas), provenance source/scope/version/hash/locator/derivation, sitasi, no-result yang jujur, serta konten retrieved sebagai data tak tepercaya. Revoke langsung blok retrieval walau purge pending; track penghapusan chunks/index/cache/memory/turunan. Sebelum data keluar ke provider remote, tampilkan konteks dan provider dan minta approval sesuai policy; jangan anggap permintaan dokumentasi sebagai izin transfer.
8. UI design mencakup provider profile/capability/status, RAG Source Manager (scope/ACL/sync/chunk/citation/reindex/revoke/delete/purge), pemisahan memory authored/approved dari agent-derived, dan chat yang memperlihatkan provider/sumber/konteks eksternal serta state permission-denied, stale, provider error, dan no-result. Framework, endpoint list, index/store, retention, ACL authority, serta detail provider tetap OPEN sampai diputuskan pemilik. Perlakukan pola eksternal tambahan yang berlabel usulan sebagai kandidat, bukan instruksi untuk otomatis membangun semua pola tersebut.
9. Jika bridge JSON Lines, memory layering, task-profile cache/cooldown, tool circuit breaker, atau watchdog dipertimbangkan, catat keputusan eksplisit, threat model, permission/cache scope, stop behavior, dan acceptance tests terlebih dahulu; jangan mengadopsi nama produk, endpoint publik/keyless, atau workflow domain yang tidak diminta.

ALUR KERJA WAJIB
1. Kenali lingkungan dan lindungi keadaan awal: pastikan root proyek, instruksi proyek, file yang relevan, status Git/perubahan lokal, dependensi, tes, dan batas akses. Jangan menimpa perubahan yang sudah ada atau menghapus/membersihkan file kerja pengguna.
2. Ubah permintaan menjadi rencana singkat dan pecah menjadi tugas vertikal: tujuan, batas cakupan, dependensi, risiko, acceptance criteria yang dapat diamati, serta perintah verifikasi untuk tiap tugas. “Tuntas A–Z” berarti menuntaskan milestone yang disetujui, bukan membangun seluruh visi sekaligus. Utamakan iris implementasi terkecil yang memberi fungsi nyata.
3. Bila dokumen memuat rekomendasi tetapi belum ada keputusan, gunakan hanya asumsi kecil yang aman, reversibel, dan tidak material; catat asumsi tersebut. Untuk keputusan material atau berisiko, jangan menebak. Kerjakan bagian independen yang jelas bila aman, lalu laporkan blocker dan pilihan yang dibutuhkan.
4. Implementasikan secara bertahap. Pertahankan perilaku dan konvensi proyek. Jangan mengubah file yang tidak berkaitan, menambah dependensi tanpa alasan, atau mengklaim integrasi/runtime tersedia sebelum memeriksanya.
5. Hormati izin dan keamanan: least privilege; jangan membaca atau mengirim data di luar sumber yang disetujui; jangan membuka, memeriksa, menyalin, atau menampilkan nilai credential/secret dalam prompt, output, log, test fixture, atau laporan. Kerjakan perubahan lokal yang diizinkan secara terpisah dari publikasi, perubahan remote, tindakan finansial/berbayar, penghapusan, migrasi destruktif, deployment, commit, atau push. Tindakan tersebut memerlukan persetujuan eksplisit untuk aksi, cakupan, tujuan/destinasi, dan biaya bila ada; jangan menganggap persetujuan lokal sebagai izin untuk aksi eksternal.
6. Hormati budget dan stop gate yang berlaku. Jangan memulai layanan berbayar, memakai kuota berbayar, atau melampaui batas biaya/resource yang ditetapkan. Jika batas belum ditetapkan dan tindakan dapat menimbulkan biaya, berhenti sebelum tindakan itu dan minta keputusan.
7. Uji perubahan dengan pemeriksaan proyek yang relevan: tes terarah, suite yang diperlukan, build, lint/type-check, dan tes keamanan/recovery sesuai acceptance criteria. Perbaiki kegagalan dalam cakupan, lalu jalankan ulang pemeriksaan yang terdampak. Jangan menulis hasil yang tidak benar-benar diperoleh.
8. Lakukan review akhir terhadap diff dan efek samping. Pastikan perubahan sesuai permintaan, tidak merusak perubahan lama atau data, tidak membocorkan secret, dan tiap klaim status didukung bukti. Minta review independen bila tersedia dan diizinkan; jika tidak tersedia, lakukan second-pass review sendiri dan nyatakan bahwa review independen belum dilakukan. Jika tes tidak tersedia atau tidak aman dijalankan, nyatakan dengan spesifik.

ATURAN PENGHENTIAN
- Berhenti sebelum tindakan yang tidak diizinkan, tidak dapat dibalik, berdampak eksternal, berbiaya, atau memerlukan akses yang belum diberikan.
- Jangan commit, push, deploy, publish, menjalankan migrasi destruktif, atau melakukan tindakan berbayar tanpa persetujuan eksplisit atas tindakan dan cakupannya.
- Jika acceptance criterion gagal, jangan menyebut pekerjaan lulus. Perbaiki jika aman dan masih dalam cakupan; jika tidak, laporkan kegagalan, dampak, dan langkah yang diperlukan.
- Jika informasi atau sumber bukti tidak cukup, tandai sebagai belum diverifikasi. Jangan mengarang hasil, log, repository, runtime, koneksi, benchmark, atau tes.
- Selesaikan seluruh bagian yang jelas dan diizinkan; jangan menghentikan pekerjaan hanya karena ada bagian lain yang OPEN. Pisahkan hasil selesai dari blocker.

FORMAT LAPORAN AKHIR
1. Ringkasan perubahan dan status tiap acceptance criterion.
2. Daftar file yang diubah dengan path persis dan ringkasan diff per file.
3. Perintah tes/build/lint yang benar-benar dijalankan serta hasilnya; sertakan bukti review yang relevan seperti diff, output tes, atau artefak.
4. Bagian yang belum diuji, gagal, atau belum diverifikasi beserta alasannya.
5. Keputusan pemilik yang masih diperlukan, risiko tersisa, dan langkah berikutnya yang konkret.

Lakukan pekerjaan sampai tuntas sejauh diizinkan dan dapat diverifikasi. Jangan menyatakan semuanya selesai jika ada acceptance criterion, pengujian, atau tindakan yang masih tertunda.
````

---

## 13. Roadmap dan gerbang tahap

Roadmap ini menyusun materi P22 menjadi milestone berurutan. Tidak ada tanggal atau durasi yang ditetapkan. Tiap fase baru dimulai setelah bukti/gate sebelumnya tersedia. P24 menambah bahan eksplorasi visi saja; ia tidak mengubah urutan tahap, mengesahkan milestone baru, atau memilih jalur implementasi. Semua fase dan checkbox implementasi tetap tunduk pada keputusan pemilik dan bukti gate.

| Tahap | Fokus dan keluaran yang diusulkan | Gerbang sebelum lanjut | Status bukti |
|---|---|---|---|
| **0 — Spesifikasi minimum dan audit aset** | Audit repository DhaherOS yang relevan, dokumentasi, kemampuan runtime, kebutuhan koneksi/data, model, dan keamanan. Uji satu pekerjaan/workaround nyata dengan prototype kecil; usulan ini mendahului penguncian MVP. | Bukti prototype ditinjau dan kriteria continue/revise/stop disepakati sebelum MVP dikunci; tujuan, aset, batas data, risiko, dan kontrak runtime jelas. Nilai/threshold kriteria masih OPEN. | Belum dilakukan sebagai bagian pembaruan dokumen ini. |
| **1 — Control plane** | Implementasikan model task, state machine, persistence, event/audit log, cancellation, timeout, retry, dan recovery. Rust/SQLite adalah kandidat draft. | Tes sukses, crash/restart, timeout, retry, permission denial lulus. | Belum diverifikasi/diimplementasikan. |
| **2 — Satu alur executor nyata** | Hubungkan satu executor terpilih ke workspace uji, simpan artefak, periksa perubahan, dan hasilkan laporan yang dapat ditelusuri. | Bukti build/test/diff/evaluator mendukung setiap klaim. | Belum diverifikasi/diimplementasikan. |
| **3 — Runtime kedua** | Uji integrasi runtime kedua, lifecycle, konteks, error, resume, resource, dan pemilihan berdasarkan capability. | Kegagalan ditangani konsisten; adapter hanya mengiklankan fitur teruji. | Belum diverifikasi/diimplementasikan. |
| **4 — Knowledge, Repository & RAG Fabric** | Integrasi sumber yang dipilih pemilik (knowledge/Obsidian, Git lokal, project state, dokumen/data/memory), ingest/index, provenance, ACL, sitasi, dan revoke/delete. | Pemilihan sumber/scope eksplisit; ACL otoritatif diperiksa saat retrieval dan sebelum model; cross-project denial, provenance/sitasi, no-result, dan purge lifecycle lulus; backend/retensi tetap OPEN. | Belum diverifikasi/diimplementasikan. |
| **5 — Organization & Capability Engine** | Organisasi, divisi, role, capability registry, komposisi tim, workflow, dan policy binding. | Konfigurasi tervalidasi tanpa membuat runtime baru untuk setiap role. | Belum diverifikasi/diimplementasikan. |
| **6 — Tools, provider, credential, dan akses remote** | Execution gateway, provider registry (endpoint custom OpenAI-compatible serta Anthropic native Messages sebagai adapter terpisah), konektor yang dipilih, referensi credential, capability probe sintetis, approval outbound, dan audit. | Capability/unsupported behavior dinyatakan akurat; credential terikat ke host; disclosure/approval konteks remote dan kontrol stop diuji. Provider, model, versi, secret store, egress, biaya tetap OPEN. | Belum diverifikasi/diimplementasikan. |
| **7 — UI dan workflow domain** | Rancang dan bila dipilih implementasikan pengalaman provider, RAG source manager, memory lifecycle, dan chat/citations/context disclosure; alur domain diperluas sesudah standar siap. | Permission-denied, stale, no-result, provider error, purge-pending, disclosure, navigasi keyboard/status yang dapat diakses, dan bukti workflow diuji; framework/target WCAG OPEN. | Belum diverifikasi/diimplementasikan. |
| **8 — Operasi otonom** | Trigger, jadwal, goal tracking, inisiatif, evaluasi, dan peningkatan capability terkontrol. | Alasan tindakan, budget/izin, stop, recovery, dan manfaat dibanding baseline terbukti. | Belum diverifikasi/diimplementasikan. |

### Checklist roadmap — rencana dan implementasi dipisahkan

Status item: **Belum mulai**, **Berjalan**, **Terblokir**, **Siap ditinjau**, atau **Diterima**. Kotak hanya boleh dicentang setelah keluaran tersedia dan acceptance evidence dilampirkan; fase baru diterima setelah gate ditinjau dan keputusan lanjut dicatat. Tanggal, owner pelaksana, nilai threshold, dan SLA tidak diisi karena belum diputuskan. Semua fase implementasi di bawah tetap **Belum mulai** dan seluruh checkbox-nya kosong.

#### Checklist dokumen/perencanaan

- [x] Share P24 dibaca; ucapan pemilik dipisahkan dari rangkuman/saran AI dan dicatat sebagai eksplorasi, bukan keputusan implementasi.
- [x] Urutan fase, keluaran yang diusulkan, serta gerbang awal sudah dicatat di roadmap tabel.
- [x] Checklist implementasi dipecah per fase dan membedakan hasil, bukti acceptance, serta gate review.
- [x] Status bukti yang tersedia dibedakan dari rancangan; tidak ada fase implementasi ditandai selesai.
- [ ] Pemilik meninjau/menyetujui urutan, cakupan fase, dan kriteria gate sebelum pekerjaan implementasi dimulai.
- [ ] Keputusan OPEN yang menjadi blocker bagi fase terkait telah dicatat sebelum fase itu dimulai.

#### Checklist implementasi per fase

##### Tahap 0 — Spesifikasi minimum dan audit aset
- [ ] Inventaris aset/repository yang diizinkan, statusnya, kebutuhan data, serta batas workspace selesai; temuan disimpan tanpa membuka secret.
- [ ] Satu pekerjaan/workaround nyata diuji dengan prototype kecil dan hasilnya dibandingkan dengan acceptance criteria.
- [ ] Pemilik meninjau bukti prototype, menetapkan kriteria continue/revise/stop, dan mencatat keputusan gate sebelum MVP dikunci.
- **Status:** Belum mulai. **Dependensi/blocker:** scope aset dan izin audit, masalah nyata untuk divalidasi, serta kriteria keputusan masih OPEN.

##### Tahap 1 — Control plane
- [ ] Model task, state transition, persistence, event/audit, timeout, cancellation, retry, dan recovery memiliki implementasi yang dapat dijalankan.
- [ ] Tes restart/crash, permission denial, duplikasi/retry, timeout, cancellation, dan state yang belum pasti lulus; perintah serta hasilnya disimpan.
- [ ] Gate ditinjau terhadap bukti state persisten dan tidak adanya fake success; keputusan lanjut dicatat.
- **Status:** Belum mulai. **Dependensi/blocker:** pilihan core/storage dan kontrak acceptance masih perlu diputuskan/ditetapkan.

##### Tahap 2 — Satu alur executor nyata
- [ ] Satu executor yang dipilih berjalan pada workspace uji dengan scope yang disetujui.
- [ ] Artifact/diff, status/error, perintah, hasil tes/evaluator, dan provenance ditautkan ke task.
- [ ] Gate ditinjau terhadap hasil yang dapat direproduksi dan efek workspace yang sesuai izin.
- **Status:** Belum mulai. **Dependensi/blocker:** tahap 1 diterima; executor, workspace, dan satu pekerjaan MVP dipilih.

##### Tahap 3 — Runtime kedua
- [ ] Adapter/runtime kedua dipilih dan manifest hanya menyebut capability yang sudah diuji.
- [ ] Tes konteks, error, timeout, resume/cancellation, biaya/resource, dan shutdown sesuai kontrak lulus.
- [ ] Gate menilai manfaat runtime kedua dibanding biaya/kompleksitas, lalu keputusan diterima atau tidak dilanjutkan dicatat.
- **Status:** Belum mulai. **Dependensi/blocker:** tahap 2 diterima; kebutuhan/runtime kedua serta kontrak adapter masih OPEN.

##### Tahap 4 — Knowledge, repository, dan RAG
- [ ] Sumber dan scope proyek/resource dipilih serta diberi izin; secret/credential tidak masuk ingestion/index.
- [ ] ACL otoritatif lolos uji saat retrieval dan sebelum konteks dikirim; provenance, citation/no-result, revoke-deny-immediately, dan purge seluruh turunan memiliki bukti.
- [ ] Gate privasi, egress, retensi/purge, isolation lintas proyek, dan deletion evidence ditinjau; keputusan lanjut dicatat.
- **Status:** Belum mulai. **Dependensi/blocker:** tahap 1 diterima; konektor/ACL authority, storage/index, scope, transfer, retensi, dan purge SLA masih OPEN.

##### Tahap 5 — Organization dan capability engine
- [ ] Model organisasi/divisi/role/capability/workflow diterapkan hanya untuk kebutuhan yang disetujui.
- [ ] Tes validasi konfigurasi, least privilege, pemisahan scope, dan deny lintas tenant/proyek lulus.
- [ ] Gate meninjau manfaat, beban operasional, dan bukti isolasi; keputusan dicatat.
- **Status:** Belum mulai. **Dependensi/blocker:** kebutuhan multi-organisasi/role dan otoritas izin belum dipastikan.

##### Tahap 6 — Tools, provider, credential, dan akses remote
- [ ] Tool/provider yang dipilih memiliki kontrak, scope izin, host/origin policy, secret reference server-side, dan daftar capability teruji.
- [ ] Tes sandbox/tool scope, URL/TLS/egress/host-bound auth, unsupported provider behavior, disclosure konteks, dan approval outbound lulus dengan payload sintetis atau fixture aman.
- [ ] Gate meninjau biaya, lisensi, izin, transfer data, secret storage, rate limit/stop behavior; persetujuan eksplisit dan keputusan lanjut dicatat.
- **Status:** Belum mulai. **Dependensi/blocker:** tahap 1–2 diterima; provider/model, endpoint policy, secret store, scope konektor, lisensi, dan batas biaya masih OPEN. Tidak ada provider/account/layanan berbayar yang diaktifkan oleh checklist ini.

##### Tahap 7 — UI dan workflow domain
- [ ] Platform/framework dan alur UI dipilih; provider profile, RAG Source Manager, memory lifecycle, dan chat/citation/disclosure dibangun sesuai scope.
- [ ] Tes state permission-denied, stale, no-result, provider error, purge-pending, keyboard/focus, dan accessibility target yang disepakati memiliki bukti.
- [ ] Gate meninjau keterpahaman, aksesibilitas, approval clarity, serta satu workflow nyata sebelum domain diperluas.
- **Status:** Belum mulai. **Dependensi/blocker:** tahap 2 dan kebutuhan UI disetujui; framework/platform, visual system, dan target aksesibilitas masih OPEN.

##### Tahap 8 — Operasi otonom
- [ ] Trigger/schedule/goal workflow yang secara khusus dipilih mempunyai izin, owner, idempotency/dedup, batas biaya/run/waktu, dan kill switch.
- [ ] Tes duplicate event, retry/restart, cancellation/worker stop, recovery, approval dan no-op ketika izin/data/nilai tidak cukup lulus.
- [ ] Gate meninjau manfaat terhadap baseline, residual risk, biaya/operasi, override manusia, recovery, dan decommission; keputusan lanjut dicatat.
- **Status:** Belum mulai. **Dependensi/blocker:** tahap sebelumnya yang relevan diterima; frekuensi, biaya, kebijakan unattended action, operator, dan stop threshold tetap OPEN.

**[Usulan]** Jangan menetapkan milestone kalender sampai kapasitas waktu, pekerjaan, kuliah, prioritas MVP, dan biaya diketahui. Fase 0 harus singkat dan berorientasi keputusan; segera beralih ke implementasi setelah kontrak minimum konsisten.

**[Usulan CFO — gate rilis/supply-chain, bersyarat pada rilis/distribusi]** Sebelum menerbitkan artefak, pertimbangkan inventaris dependency yang ter-resolve, SBOM yang terikat ke artefak rilis, pengecekan advisory RustSec jika Rust dipilih, verifikasi provenance build jika SLSA dipilih, serta pemilik remediation/exception. Rujukan: [NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final), [RustSec advisories](https://rustsec.org/), [SLSA v1.2 verification](https://slsa.dev/spec/v1.2/verifying-artifacts). Ini usulan gate, bukan implementasi atau kewajiban umum; format SBOM, vendor, ambang, dan tenggat **OPEN**.

---

## 14. Metrik dan evaluasi

**[Materi draft — P22]** Metrik awal yang layak dicatat:

- penyelesaian yang terverifikasi dan tingkat kegagalan;
- jumlah intervensi manusia;
- waktu penyelesaian;
- kualitas output menurut evaluator domain;
- biaya per hasil/workflow;
- jumlah regresi setelah perubahan;
- penggunaan resource, retry, dan pembatalan.

**[Usulan]** Ukur baseline sebelum menetapkan target numerik. Biaya-per-workflow dapat menjadi metrik; batas biaya dan stop cap harus disetujui sebelum penggunaan model/layanan berbayar.

**[Usulan CFO terkait eksplorasi P24 — belum dipilih]** Jika kelak menguji nilai ekonomi, bedakan estimasi dari realisasi; bandingkan revenue yang benar-benar diterima, biaya terhindar, atau waktu yang terukur terhadap baseline, lalu kurangi seluruh biaya task/provider/model, storage/egress/tool/compute, fallback, dan review manusia. Biaya, FX, metode alokasi, definisi manfaat, horizon, baseline, dan ambang lanjut/revisi/stop tetap OPEN. Potential revenue atau demo tidak membuktikan ROI.

**[OPEN]** Provider/model, kuota, tarif, biaya operasional, target kualitas, anggaran per task/hari/bulan, dan sumber pendanaan belum dipilih. Tidak ada angka target yang diasumsikan dalam dokumen ini.

**[Usulan CFO — protokol evaluasi]** Version-kan eval case/fixture; pisahkan pemeriksaan deterministik dari penilaian subjektif; bandingkan hasil per kasus terhadap baseline. Jika LLM-as-judge dipilih, kalibrasikan pada sampel yang ditinjau manusia dan uji bias posisi. Benchmark eksternal tidak dianggap bukti MVP tanpa kesesuaian tugas/bahasa; hasil benchmark Python bukan bukti representatif untuk MVP Rust. Referensi yang diberikan untuk desain ini: [Inspect AI tutorial](https://inspect.aisi.org.uk/tutorial.html), [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices), dan [IJCNLP-AACL 2025 paper on position bias](https://aclanthology.org/2025.ijcnlp-long.18/). Framework, grader, benchmark, dan threshold tetap OPEN.

---

## 15. Risk register

| Risiko | Tanda awal | Mitigasi yang diusulkan |
|---|---|---|
| Cakupan terlalu luas | Banyak domain/diagram, belum ada satu workflow berjalan | Pertahankan visi; implementasikan satu gate dan satu hasil pada satu waktu |
| Runtime terlalu banyak | Integrasi bertambah tanpa manfaat terukur | Tetapkan kontrak dan ukur nilai setiap runtime sebelum dipertahankan |
| Agent/persona sprawl | Banyak role tanpa tanggung jawab, permission, atau evaluasi | Bangun mesin capability/workflow terlebih dahulu, bukan daftar persona statis |
| Memory/data sprawl | Duplikasi antara notes, DB, runtime memory, dan project state | Tetapkan pemilik dan fungsi tiap kategori data; putuskan retensi |
| Otonomi tanpa kendali | Task berjalan di luar prioritas/izin/budget | Approval, least privilege, stop conditions, kill switch, audit |
| Keberhasilan palsu | Output agen dianggap benar tanpa tes/diff/evaluator | Kriteria selesai dan bukti evaluasi wajib; tes harus bisa gagal |
| Credential/data terekspos | Secret tersebar ke prompt/log/cache/output | Referensi secret, minimisasi akses, tes kebocoran, pencabutan |
| Efek samping berulang | Retry/restart menggandakan perubahan | Idempotensi/deduplication atau approval/manual recovery |
| Ketergantungan provider/lisensi | Pilihan dibuat sebelum terms dan biaya diperiksa | Audit lisensi dan terms; benchmark dengan batas biaya terbuka |
| Tidak cocok dengan kapasitas pemilik | Proyek mengganggu kuliah/kerja/prioritas finansial | Tetapkan MVP dan jadwal realistis setelah kapasitas diklarifikasi |
| Terus merancang tanpa implementasi | Dokumen bertambah tanpa kode/alur teruji | Gate fase harus menghasilkan program atau workflow yang dapat dijalankan |
| Struktur/entitas berubah tanpa otorisasi | Eksperimen otonom memperluas identitas, akses, biaya, atau tindakan di luar izin | Jika kelak dievaluasi, pisahkan usulan dari tindakan; tetapkan pemilik/approver, lifecycle, scope data/uang, dan stop/rollback sebelum uji; belum diputuskan |
| Nilai ekonomi diasumsikan dari aktivitas atau potensi | Pengeluaran model/operasi meningkat tanpa manfaat terverifikasi | Ukur baseline dan manfaat yang terealisasi setelah seluruh biaya; tetapkan continue/revise/stop gate sebelum eksperimen; metrik/threshold OPEN |
| Memory/data poisoning, privilege escalation, atau failure berantai | Konteks/instruksi tercemar, kewenangan melebar, satu kegagalan memicu dampak pada unit lain | Uji sumber berbahaya, deny lintas-scope, isolasi dependensi dan stop/rollback; cakupan eksperimen serta ambang tetap OPEN; masukan kolaborator P25 |
| Bias atau klaim/aset tanpa provenance/lisensi cukup | Keputusan atau publikasi mengandalkan bukti timpang/tidak jelas haknya | Catat provenance dan status lisensi; bedakan mockup dari live; evaluasi bias, kualitas bukti, dan lisensi sebelum reuse; rekomendasi P25 |

---

## 16. Decision log dan pertanyaan terbuka

### Catatan keputusan/status

| ID | Topik | Status | Catatan |
|---|---|---|---|
| DL-01 | Nama proyek pada dokumen | Dipakai untuk konteks ini | DhaherOS digunakan sebagai nama proyek sesuai arahan saat ini; nama produk/branding final tetap OPEN. |
| DL-02 | Menata ulang DhaherOS dan integrasi AI/data | Pernyataan langsung pemilik — P20 | Arah langsung; cakupan sumber data, hak akses, dan urutan belum ditentukan. |
| DL-03 | Produk sebagai control plane untuk personal/project/institution | Arah dalam materi draft — P22 | Belum dianggap keputusan langsung final; konfirmasi bentuk produk diperlukan. |
| DL-04 | Rust-first dan pembangunan baru | Usulan/arah dalam materi draft — P22 | Perlu pemeriksaan aset dan keputusan reuse/rebuild. |
| DL-05 | OpenCode, Hermes, Obsidian | Kandidat yang dicatat P22 | Belum diperiksa kepemilikan, state, kemampuan, koneksi, atau kompatibilitasnya. |
| DL-06 | SQLite, modular monolith, CLI, Git/filesystem | Pilihan teknis kandidat P22 | Belum diputuskan sebagai implementasi final. |
| DL-07 | Dua belas domain arsitektur | Peta konseptual P22 | Bukan kewajiban membuat 12 service. |
| DL-08 | MVP satu workflow nyata dan verifiable | Target/usulan berdasarkan P22 | Runtime, data, kriteria task, dan lingkungan uji masih OPEN. |
| DL-09 | Produk untuk internal atau komersial | OPEN | Pengguna pertama, masalah yang dibayar, harga, revenue model, biaya, dan margin belum ditentukan. |
| DL-10 | Provider/model dan anggaran | OPEN | Provider, kuota, tarif, batas per task/hari/bulan belum dipilih. |
| DL-11 | Lisensi dan terms | OPEN | Model, runtime, dataset, dependency, dan sumber data harus diperiksa sebelum digunakan/distribusikan. |
| DL-12 | Retensi, penghapusan, pencabutan | OPEN | Durasi dan perilaku untuk task, logs, knowledge, artifacts, cache/index, turunan, konektor, dan backup belum ditentukan. |
| DL-13 | Otonomi dan tindakan yang perlu approval | OPEN | Matriks risiko, approval, stop cap, dan pemilik keputusan perlu ditetapkan. |
| DL-14 | Target waktu dan hubungan dengan sasaran pribadi | OPEN | Prioritas kuliah, pekerjaan, proyek, tabungan, belajar, dan S2 belum dijadwalkan. |
| DL-15 | Intake dan penggunaan sumber personal | OPEN | Persetujuan eksplisit, tujuan, kolom minimum, akses per proyek, provenance, redaksi, retensi, dan penghapusan data turunan belum ditetapkan/diterapkan. |
| DL-16 | Prioritas pribadi menurut sumber tambahan | OPEN | Workbook, kompilasi, dan mockup berbeda dalam urutan prioritas; perlu rekonsiliasi langsung, tanpa memakai nominal mentah. |
| DL-17 | Status pendidikan saat ini | OPEN | Deskripsi pada P16, S3, dan CV tidak cukup konsisten untuk menetapkan program atau status terkini. |
| DL-18 | Aset/proyek yang ditampilkan pada bahan profil/CV | Belum diverifikasi | Hanya klaim atau contoh sumber; hubungan ke DhaherOS, keberadaan, kepemilikan, kondisi, dan kelayakan reuse perlu audit terpisah. Nama legacy tidak diadopsi sebagai nama proyek DhaherOS. |
| DL-19 | Laporan pribadi berkala | Kandidat, bukan keputusan | Hanya opsi workflow Personal OS dari sumber yang dipilih pemilik; bukan MVP, monitoring otomatis, atau izin akses. |
| DL-20 | A2A / delegasi agent-ke-agent jarak jauh | OPEN | Evaluasi hanya jika ada kebutuhan independen; bukan MVP atau protokol yang dipilih. MCP tetap opsi berbeda untuk tools/resources. |
| DL-21 | Instrumentasi observability dan backend | OPEN | Korelasi trace/span/resource dapat diuji; OpenTelemetry hanya rujukan vendor-netral, bukan backend yang dipilih. Secret scrubbing wajib diuji bila telemetry dibuat. |
| DL-22 | Versi MCP/OAuth | OPEN/bersyarat | Belum diputuskan memakai MCP atau OAuth. Jika dipilih, versi protokol/transport serta batas consent dan token wajib dipatok dan diuji sesuai sumbernya. |
| DL-23 | Operasi pascadeployment | OPEN | Monitoring, umpan balik/override operator, perubahan terkendali, serta disable/decommission harus ditetapkan sebelum unattended operation; tanpa ambang yang dikarang. |
| DL-24 | Validasi problem sebelum MVP | Usulan CFO | Prototype untuk pekerjaan/workaround nyata dan kriteria continue/revise/stop sebelum MVP dikunci; belum dipilih, ambang OPEN. |
| DL-25 | Applicability hukum Indonesia | OPEN | Operator, deployment/use, akses publik, tujuan/jenis data, status terkini hukum, dan peran yang relevan belum ditelaah; tidak ada kewajiban yang disimpulkan. |
| DL-26 | Accessibility target | OPEN/bersyarat | Pertimbangkan WCAG 2.2 AA hanya bila UI dipilih; bukan target/claim yang disetujui saat ini. |
| DL-27 | Release/supply-chain gate | OPEN/bersyarat | Usulan inventaris dependency, SBOM, advisory check, provenance dan owner remediation; format/vendor/tenggat belum dipilih. |
| DL-28 | Event/retry/efek eksternal | OPEN | ID task/attempt/event, atomicity, dan rekonsiliasi uncertain side effects perlu dirancang; tidak ada klaim exactly-once. |
| DL-29 | Backup/restore dan shutdown | OPEN | Backend, metode/retensi backup, RPO/RTO, grace period, serta perilaku child termination belum dipilih/diuji. |
| DL-30 | Evaluasi dan residual-risk review | OPEN | Fixture/baseline, grader, pemilik risk acceptance, pemicu review, operator guide, dan human validation belum dipilih. |
| DL-31 | Antarmuka provider OpenAI-compatible dan Anthropic | Permintaan langsung P23 untuk cakupan rancangan; rincian OPEN | Usulan memisahkan endpoint custom OpenAI-compatible dari Anthropic native Messages (`POST /v1/messages`); tidak menyamakan compatibility layer Anthropic dengan native API. Provider/model list, API path/version selain kebutuhan native, field/tool support, auth/secret store, capability probe, retry/stream/cost, endpoint policy, dan budget belum dipilih. |
| DL-32 | RAG dokumen/data/memory | Permintaan langsung P23; implementasi dan pilihan teknis OPEN | “Semua” hanya sumber yang dipilih/diotorisasi pemilik per scope; ACL authority, lokasi/index, vector-vs-lexical, embeddings, parser/chunking, batas, retention/purge SLA dan backup masih OPEN. Authoritative ACL checks, provenance, citations, untrusted content, revoke-deny-immediately adalah usulan desain/tes; bukan implementasi. |
| DL-33 | Pembaruan design UI | Permintaan langsung P23 untuk design; keputusan implementasi OPEN | Usulan layar provider profile, RAG Source Manager, memory lifecycle, chat citations/context disclosure dan permission/error states. Framework/platform, visual language/tokens, responsive strategy, aksesibilitas target dan navigasi final tetap OPEN. |
| DL-34 | URL/origin, TLS dan egress provider | OPEN | Validasi origin/TLS dan bind credential ke host adalah usulan keselamatan; host allowlist, proxy, egress/network policy, redirect rules dan secret storage belum dipilih. |
| DL-35 | Approval data yang dikirim ke provider remote | OPEN | Usulan memerlukan preview provider dan konteks/sumber serta approval sebelum transfer; granularity, durasi dan kapan approval dapat digunakan ulang belum ditetapkan. Tidak ada otorisasi transfer pada pembaruan dokumen. |
| DL-36 | Pola fitur tambahan dari review eksternal | Usulan dari pola eksternal yang ditinjau—belum dipilih | Task-profile/cooldown/backoff/cache, bridge JSON Lines, layered memory, tool sandbox/rate-limit/circuit-breaker, watchdog/degraded state, dan satu dashboard/API surface adalah kandidat saja; tidak ada yang menjadi keputusan atau implementasi. Evaluasi satu per satu terhadap izin, security, biaya, kebutuhan, dan tes. |
| DL-37 | P24 — visi dan status sesi | Eksplorasi visi pemilik; bukan roadmap atau keputusan teknis | Share 2026-11-09 berstatus Vision Exploration & Conceptual Discovery. Keinginan menemukan kebutuhan, mengembangkan kemampuan/struktur, dan leverage dicatat sebagai eksplorasi. Respons/rangkuman AI, label konsep, contoh strategi, angka, serta usulan teknologi tidak menjadi keputusan. |
| DL-38 | Discovery dan self-organization | OPEN | Arti opportunity discovery, eksperimen, pembentukan/adopsi/penyesuaian kemampuan atau struktur; siapa mengusulkan/mengesahkan/menjalankan; dan batas tindakan belum ditetapkan. |
| DL-39 | Lifecycle unit/entitas | OPEN | Apakah struktur/entitas teknis atau ekonomi dapat dibuat, digabung, dipause, dipisah, atau dihentikan; otoritas, catatan/provenance, akibat data/kontrak, serta status legal belum diputuskan. |
| DL-40 | Institutional memory lintas perubahan | OPEN | Aspirasi mempertahankan pengalaman lintas agen/unit tidak mengizinkan transfer otomatis. Ownership, scope/grant, provenance, retensi, revocation, inheritance, delete/purge dan akses lintas identitas belum dipilih. |
| DL-41 | Personal vs entity authority | OPEN | Pemisahan identitas, kepemilikan, tanggung jawab, data, memory, resource, cost center, sumber dana, approver, dan kewenangan finansial personal/proyek/institusi belum ditetapkan. |
| DL-42 | Bukti nilai ekonomi dan keberlanjutan | OPEN | Manfaat harus diuji terhadap baseline dan total biaya sebelum mengklaim nilai/ROI. Definisi manfaat, sumber pendapatan, alokasi biaya, mata uang/FX, horizon, threshold, dan pihak yang menyetujui eksperimen belum diputuskan. |
| DL-43 | Batas otonomi untuk eksperimen/entitas | OPEN | Apa yang boleh diriset/diusulkan otomatis versus dibuat/diaktifkan/dibelanjakan/dikirim ke luar memerlukan batas authority, resource/data grants, stop/rollback, dan approval spesifik. Tidak ada izin tindakan baru dari P24. |
| DL-44 | Masukan kolaborator P25 | Rekomendasi, bukan keputusan | Usulan review mencakup peran/otoritas; pemisahan rekomendasi vs aksi disetujui; lifecycle, grant/ACL, memori/retensi/revoke/purge; nilai bersih setelah seluruh biaya; dan pengujian runaway cost, injection/poisoning, privilege escalation, leakage, bias, supply chain, cascading failure, duplicate side effects, serta evidence/privacy/stop/rollback/cost/latency. Pakai sebagai prompt review; owner scope/policy tetap OPEN.

### Pertanyaan yang harus dijawab sebelum implementasi luas

1. Repository mana yang benar-benar merupakan aset DhaherOS, apa keadaan dan lisensinya, dan apakah ada bagian yang layak dipakai ulang?
2. Apa satu pekerjaan MVP dengan manfaat langsung yang dapat diuji pada workspace aman?
3. Runtime mana yang diuji pertama, bagaimana cara memanggilnya, dan capability apa yang harus dibuktikan?
4. Sumber data mana yang dimaksud terlebih dahulu; data apa yang boleh dibaca/ditulis; bagaimana akses dicabut?
5. Apa peran Obsidian dibanding database operasional, memori runtime, state proyek, dan artifact store?
6. Apakah Rust, SQLite, modular monolith, Git/filesystem, dan CLI tetap sesuai setelah audit kebutuhan?
7. Tindakan apa yang wajib mendapat persetujuan manusia, termasuk perubahan remote, publikasi, komunikasi keluar, dan tindakan finansial?
8. Siapa pengguna/pelanggan pertama; produk internal atau komersial; apa nilai utama, harga, model pendapatan, margin, dan biaya operasi?
9. Model/provider apa yang dipakai, berapa kuota/tarif, dan apa batas biaya yang disetujui?
10. Apa kebijakan lisensi/terms untuk model, runtime, dependency, dataset, dan sumber data?
11. Bagaimana retensi dan penghapusan berlaku pada logs, knowledge, artefak, cache/index, data turunan, serta backup?
12. Target jadwal apa yang realistis sejalan dengan kuliah, pekerjaan, proyek, belajar, dan aspirasi S2/karier?
13. Nama produk/branding final apa, jika berbeda dari nama proyek DhaherOS?
14. Prioritas saat ini yang perlu didahulukan apa di antara keselamatan/stabilisasi, arus kas, trading, usaha, pendidikan, dan AI? Konflik sumber perlu dijawab pemilik.
15. Apa status/program pendidikan dan ketersediaan waktu studi saat ini? Konfirmasi sebelum merancang workflow pendidikan.
16. Sumber personal mana yang secara spesifik boleh dipakai untuk workflow tertentu; field apa yang minimum, untuk tujuan berapa lama, dan bagaimana redaksi/penghapusan sampai ke log, indeks, cache, backup, dan salinan turunan?
17. Apakah laporan status/audit berkala benar-benar diinginkan; sumber apa yang dipilih dan siapa yang boleh melihat hasilnya?
18. Apakah ada kebutuhan delegasi task ke agen remote independen yang cukup untuk mengevaluasi A2A, terpisah dari akses tool/resource melalui MCP?
19. Versi/transport MCP mana yang akan dipakai, bila dipilih, dan apakah dukungan OAuth atau konfigurasi server lokal one-click memang diperlukan?
20. Sebelum unattended operation, siapa operator yang dapat memberi feedback/override dan siapa yang berwenang men-disable atau decommission; bagaimana kondisi berhentinya dibuktikan?
21. Pekerjaan/workaround nyata mana yang harus diprototipekan pada Stage 0, dan siapa yang menetapkan kriteria continue/revise/stop sebelum MVP dikunci?
22. Untuk menilai hukum yang mungkin berlaku, apa operator dan model deployment/use, apakah layanan publik, serta tujuan dan jenis data yang diproses; kapan recheck legal terbaru dilakukan sebelum launch?
23. Apakah UI akan dipilih; bila ya, apakah WCAG 2.2 AA menjadi target, dan bagaimana ringkasan approval diuji?
24. Jika rilis/distribusi dipilih, format SBOM, metode verifikasi provenance, pemilik remediation/exception, dan tenggat apa yang disetujui?
25. Backend/backup apa yang dipilih, bagaimana pemulihan terisolasi diuji, dan RPO/RTO apa yang benar-benar dibutuhkan?
26. Fixture/baseline/grader evaluasi apa yang representatif untuk runtime/bahasa terpilih, serta siapa yang menerima residual risk dan memulai review ulang?
27. Provider/protokol/model mana yang akan didukung lebih dulu; API path/version, field/tool schemas, auth/custom header, credential storage, retry/stream/error/cost limits dan capability probe apa yang disetujui?
28. Untuk tiap konektor RAG, sistem mana yang menjadi otoritas ACL; bagaimana ACL diuji saat retrieval dan tepat sebelum request model, dan bagaimana cakupan revoke/delete sampai cache, memory, derived data, logs, dan backup?
29. Storage/index RAG lokal atau remote mana yang dipilih; apakah pencarian lexical/vector/hybrid, embedding/model, parser/chunking, ukuran/budget, retensi dan purge SLA sesuai kebutuhan?
30. Apa unit dan masa berlaku approval untuk sumber/konteks yang akan dikirim ke endpoint provider remote; bagaimana tampilan preview serta perubahan payload membatalkan approval?
31. Platform/framework UI, visual language, navigasi/responsiveness, target accessibility, dan prioritas implementasi provider/RAG screens mana yang dipilih?
32. Apa kebijakan egress/allowlist, proxy, TLS/origin validation, dan perilaku redirect yang akan diberlakukan pada endpoint custom?
33. Apakah runtime benar-benar perlu process bridge; jika iya, format/versi, health/heartbeat, restart, timeout/cancellation, dan shutdown apa yang akan didukung?
34. Apakah provider/task cache, cooldown/backoff, atau latency reporting diperlukan; bagaimana isolasi ACL, invalidation, biaya, dan TTL dibuktikan?
35. Apakah layered memory, content-hash dedupe, confidence merge, importance ranking, atau TTL pruning memberi manfaat tanpa melanggar pilihan sumber, provenance, dan penghapusan?
36. Tool mana yang perlu path sandbox/rate limit/circuit breaker, dan bagaimana watchdog/degraded states mencegah fake success atau retry berbahaya?
37. Apa yang dimaksud dengan visi P24 dalam istilah yang disetujui pemilik; mana aspirasi jangka panjang, dan mana (jika ada) scope produk yang ingin diuji?
38. Bagaimana opportunity discovery dan eksperimen dibatasi, direview, didokumentasikan, serta dihentikan tanpa melahirkan akses atau side effect tak disetujui?
39. Jika ada unit/entitas yang berubah lifecycle, siapa owner/approver, apa bukti kebutuhan/nilai, dan bagaimana create/merge/pause/stop/closure memengaruhi kontrak, akses, memory, data, dan audit?
40. Bagaimana identitas, aset, data/memory, biaya, sumber dana, dan authority personal dipisahkan dari project/institution/entity; siapa membayar dan menyetujui setiap pengeluaran?
41. Manfaat ekonomi apa yang benar-benar dapat diobservasi setelah semua biaya, bagaimana baseline/FX/time horizon dicatat, dan siapa menetapkan gate continue/revise/stop?

---

## 17. Changelog

### 1.6 — 9 November 2026

- Menghimpun saran kolaborator secara nonrahasia; menandainya sebagai rekomendasi terpisah dari keputusan owner dan tidak membagikan dokumen mentah/profil/data pribadi.
- Membaca share P24 secara lengkap dan memasukkan hanya substansi ucapan pemilik yang relevan sebagai visi eksploratif; respons/rangkuman AI, nama konsep, strategi, teknologi, angka/harga, target market, dan usulan implementasi tidak dinaikkan menjadi keputusan.
- Menambahkan pertanyaan OPEN tentang opportunity discovery, self-organization/evolution, lifecycle entitas, institutional memory, pemisahan kewenangan personal vs entitas, bukti nilai ekonomi setelah seluruh biaya, dan batas tindakan.
- Memperbarui ringkasan, non-goals, risiko, metrik, acceptance-test usulan, prompt/status, checklist dokumen, dan sumber/provenance tanpa memilih arsitektur, bahasa, model bisnis, roadmap, MVP, atau implementasi. Checkbox fase implementasi tidak berubah; tidak ada push/publication.

### 1.5 — 5 November 2026

- Menambahkan checklist berurutan untuk tahap 0–8 dengan item keluaran, bukti acceptance, gate review, dependensi, dan blocker.
- Memisahkan checklist dokumen/perencanaan dari checklist implementasi; checklist implementasi seluruhnya tetap `[ ]` dan berstatus Belum mulai karena tidak ada milestone yang dieksekusi atau bukti implementasi yang dilampirkan.
- Tidak menetapkan tanggal/owner/threshold baru atau mengubah keputusan OPEN; tidak membuat repository dan tidak mengubah remote.

### 1.4 — 5 November 2026

- Menambahkan provenance anonim untuk review dokumentasi eksternal: `README.md` dan `docs/ARCHITECTURE.md` pada commit `c32331548ea0d56da97b73afd150c992a4013760`; hanya deskripsi dokumentasi yang dibaca, tanpa code/runtime validation. Nama dan URL sengaja tidak dicantumkan sesuai batasan scope; pola tetap usulan.

### 1.3 — 5 November 2026

- Mencatat permintaan langsung untuk rancangan endpoint custom OpenAI-compatible, Anthropic-compatible, RAG atas dokumen/data/memory yang dipilih, serta design UI yang diperbarui; tidak menyatakan implementasi.
- Memisahkan endpoint custom OpenAI-compatible dari adapter Anthropic native Messages API dan mencatat batas kompatibilitas/capability yang perlu diuji.
- Menambahkan alur RAG terpilih dengan ACL otoritatif, provenance, sitasi, konten tak tepercaya, pemisahan authored/approved memory dari memory turunan, dan revoke-deny-immediately dengan purge status.
- Memperbarui konsep UI menjadi Provider Profiles, RAG Source Manager, Memory panel, dan Chat context/citations/disclosure, termasuk state permission-denied, stale, provider error, no-result, dan purge-pending.
- Menambahkan acceptance tests, pertanyaan terbuka, risiko origin/credential/data-transfer, serta sumber primer OpenAI, Anthropic, OWASP, Microsoft, W3C, dan NIST yang dibuka pada 2026-11-05.
- Mencatat pola fitur tambahan secara anonim sebagai usulan belum dipilih (provider/task profiles, runtime bridge, memory options, tool guard, health/degraded state, dan live status UI); tidak menyalin identitas atau lokasi sumber ke dokumen.
- Tidak memilih provider/model/vendor, endpoint allowlist, secret store, storage/index/embedding, chunking, retensi/SLA, otoritas ACL konektor, framework UI, atau aturan transfer yang belum diputuskan; tidak membuat akun/provider/mirror atau menyentuh repository.

### 1.2 — 5 November 2026

- Meninjau enam sumber tambahan dan memetakan tiap sumber dengan jenis bukti, bagian rencana terkait, batas privasi, dan status yang belum terverifikasi.
- Memisahkan catatan orang pertama, wishlist, contoh UI, kompilasi profil, klaim CV, dan spesifikasi generik resume; tidak mengubahnya menjadi keputusan DhaherOS.
- Menambahkan konflik prioritas dan status pendidikan sebagai OPEN, serta safeguards intake personal, akses minimum, provenance, redaksi, retensi, dan penghapusan.
- Menyaring nama proyek legacy dan identifier/nilai pribadi yang tidak diperlukan; tidak menambahkan klaim implementasi.
- Menambahkan rekomendasi threat-model dan acceptance tests berbasis sumber primer OWASP/NIST, dengan caveat sukarela/versi dan tanpa klaim compliance.
- Menambahkan observability correlation sebagai opsi, tes MCP yang sadar-versi, serta A2A sebagai pertanyaan terbuka saja.
- Menambahkan prototipe Stage 0 dan continue/revise/stop sebagai usulan CFO; memperjelas ID attempt/event, efek eksternal uncertain, restore backup, shutdown, budget concurrency, dan evaluasi per kasus.
- Menambahkan ruang lingkup telaah hukum Indonesia, aksesibilitas UI, release/supply-chain, dan governance operations sebagai usulan/conditional gates; tidak mengasumsikan kewajiban, pilihan, atau implementasi.
- Memperbarui prompt coding agent dengan pencatatan status sumber, batas riset, konteks legal, rekonsiliasi efek samping, konfirmasi penghentian, restore, aksesibilitas, dan supply-chain evidence.

### 1.1 — 4 November 2026

- Menata dokumen sebagai satu sumber terpadu dengan bagian README, blueprint/charter, PRD, design, architecture, goals, MVP, roadmap, changelog, threat model, dan lampiran keputusan.
- Memisahkan pernyataan langsung pemilik (P16/P18/P20), materi draft konsolidasi (P22), usulan, status belum diverifikasi, dan pertanyaan terbuka.
- Menambahkan acceptance tests yang memiliki kondisi lulus/gagal, threat model, batas akses, pengelolaan efek samping, stop conditions, recovery, serta pertanyaan lisensi/retensi/biaya.
- Menegaskan bahwa nama-nama runtime, lokasi knowledge, stack, struktur workspace, dan milestone adalah kandidat/rancangan dari draft, bukan klaim implementasi.
- Tidak membuat file terpisah; semua bagian berada dalam dokumen ini.

### Baseline yang dikutip — P22

Teks konsolidasi P22 menyebut “Baseline per 28 Oktober 2026”, “v1.0-draft”, dan “belum diaudit terhadap repository atau mesin lokal”. Isi P22 dipertahankan sebagai bahan rancangan, bukan audit atau bukti status teknis.

---

## 18. Glosarium

- **Adapter:** lapisan yang menerjemahkan kontrak task/status antara control plane dan runtime eksternal.
- **Artifact:** hasil kerja yang disimpan dan dapat dihubungkan dengan task serta bukti evaluasi.
- **Capability:** kemampuan yang dapat disusun/diberikan ke workflow atau executor dengan batas izin.
- **Control plane:** bagian yang mengelola task, policy, status, orkestrasi, dan bukti; berbeda dari proses runtime yang melakukan pekerjaan.
- **Credential reference:** rujukan aman ke rahasia; bukan nilai rahasia yang ditulis ke konteks/log.
- **Domain pack:** kumpulan konfigurasi, workflow, capability, dan kriteria evaluasi untuk satu bidang kerja.
- **Event log:** catatan perubahan/peristiwa yang membantu rekonstruksi state dan audit.
- **Institution:** entitas organisasi seperti perusahaan, Labs, atau komunitas.
- **MCP:** mekanisme integrasi tool/konektor yang perlu policy, permission, dan lifecycle.
- **Provenance:** asal-usul data/output dan hubungan sumbernya.
- **RAG:** pola mengambil sumber yang diizinkan, memilih konteks relevan, lalu menyertakannya pada permintaan model; tidak dengan sendirinya menetapkan ACL atau storage.
- **Capability probe:** uji terkontrol (dalam rancangan ini memakai data sintetis) untuk mencatat fitur provider yang benar-benar diuji.
- **Locator:** lokasi spesifik dalam sumber (misalnya halaman, bagian, baris, atau offset) yang memungkinkan sitasi diperiksa.
- **Runtime:** executor/agent eksternal yang menjalankan sebagian pekerjaan.
- **Task:** pekerjaan terdefinisi dengan state, tujuan, resource, izin, hasil, dan kriteria selesai.
- **Workspace:** lingkungan/resource tempat executor boleh bekerja.

---

## 19. Sumber, batas bukti, dan status

### Sumber

- **P16, P18, P20 — pernyataan langsung pemilik di percakapan:** konteks kuliah/kerja serta aspirasi AI engineering, S2, ke luar negeri, dan kondisi finansial yang lebih baik; permintaan menata ulang DhaherOS dan gagasan integrasi AI dengan data.
- **P22 — teks konsolidasi yang ditempelkan dalam percakapan:** rancangan Autonomous AI Platform berlabel baseline 28 Oktober 2026, versi draft, dan belum diaudit. Detail arsitektur, stack, runtime, katalog domain, roadmap, dan acceptance criteria di dokumen ini berasal dari bahan tersebut kecuali diberi label usulan.
- **P23 — permintaan langsung pemilik pada 2026-11-05:** masukkan rancangan custom OpenAI-compatible, Anthropic-compatible, RAG sederhana atas sumber dokumen/data/memory yang dipilih, dan pembaruan design UI; detail teknis serta implementasi tidak diputuskan oleh permintaan tersebut.
- **P24 — share percakapan eksplorasi visi pada 2026-11-09:** ucapan pemilik membahas leverage, penemuan kebutuhan, struktur/kemampuan yang tidak harus ditentukan lebih dulu, eksperimen, operasi berkelanjutan, dan hasil ekonomi. Hal ini dicatat sebagai eksplorasi, bukan keputusan implementasi; AI summary dan rekomendasi tidak dipakai sebagai keputusan pemilik. Sesi menyatakan tidak menetapkan arsitektur, bahasa, organisasi, mekanisme ekonomi, roadmap, atau MVP. Sumber: https://chatgpt.com/share/6af17792-9adc-83ec-a338-0015947056c2?ogimg=plain.
- **P25 — masukan kolaborator nonrahasia:** Librarian menghimpun rekomendasi dari agen/tim counterpart setelah mengirim brief visi netral; masukan memetakan authority, lifecycle/grants/memory, pemisahan personal-entitas, net-cost evaluation, dan risiko/evidence. Tidak ada dokumen mentah, link share, profil, atau data pribadi yang dibagikan. Semua masukan berstatus usulan; bukan keputusan pemilik atau hasil implementasi.
- **Instruksi pembaruan dokumen saat ini:** seluruh materi logis harus berada di satu file, status sumber harus dibedakan, dan klaim implementasi tidak boleh dilebihkan.

### Rujukan eksternal dan status sumber

Tanggal akses **5 November 2026** dicantumkan untuk halaman yang dibuka/ditinjau pada pembaruan ini atau riset terdahulu. Baris yang hanya diberi keterangan “URL diberikan, tidak dibuka” tetap belum diverifikasi langsung; tanggal versi/publikasi yang tidak tercatat tidak ditebak. “Normatif” berlaku dalam cakupan spesifikasi/standar sumber dan tidak otomatis menjadi kewajiban hukum; “sukarela” bukan bukti compliance.

| Sumber | Publikasi/versi | Status dan applicability | Akses/provenance |
|---|---|---|---|
| Review dokumentasi repo publik (identitas disamarkan) | `README.md` dan `docs/ARCHITECTURE.md`; commit `c32331548ea0d56da97b73afd150c992a4013760`, bertanggal 2026-11-03T19:32:55Z | Hanya klaim yang dideskripsikan di dokumentasi tentang pola memory berlapis/dedupe/TTL, provider profiles/backoff, bridge berkontrak, task/API terpusat, dan tool guard; pola generik yang dipertimbangkan sebagai usulan, bukan fitur DhaherOS atau validasi implementasi. | Dibaca read-only 2026-11-05; nama/URL repo sengaja tidak dicantumkan. Tidak membuka kode, tes, credential, atau file environment; tidak menjalankan kode. |
| [OpenAI API reference overview](https://developers.openai.com/api/reference/overview/) | Dokumentasi API resmi; versi REST dan model berkembang | Rujukan resmi untuk API surfaces, Bearer auth, error/rate limit/request IDs; tidak menetapkan parity endpoint custom. | Dibuka 2026-11-05. |
| [OpenAI Python SDK](https://github.com/openai/openai-python) | Repository resmi; branch `main` berubah | SDK resmi menerima konfigurasi `base_url`; kemampuan tersebut bukan jaminan kompatibilitas semua server/fitur. | Dibuka 2026-11-05. |
| [Anthropic API overview](https://platform.claude.com/docs/en/api/overview) | Dokumentasi API resmi; versi API per header | Messages API menggunakan `POST /v1/messages`; membahas `anthropic-version`, auth, workspace header bersyarat, error/rate limits; nilai versi/fitur untuk proyek tetap OPEN. | Dibuka 2026-11-05. |
| [Anthropic OpenAI SDK compatibility](https://platform.claude.com/docs/en/cli-sdks-libraries/libraries/openai-sdk) | Dokumentasi resmi Anthropic; status dokumentasi menyebut compatibility feature stabil | Anthropic menyebut lapisan ini terutama untuk test/compare dan bukan solusi jangka panjang/produksi untuk kebanyakan use case; sejumlah field diabaikan dan ada batas skema/fitur. Bukan pengganti native Messages. | Dibuka 2026-11-05. |
| [OpenAI Retrieval guide](https://developers.openai.com/api/docs/guides/retrieval) dan [File Search](https://developers.openai.com/api/docs/guides/tools-file-search) | Dokumentasi resmi OpenAI; fitur provider tertentu | Menjelaskan vector store, chunking, filter metadata, result origin/citations dan batas hasil; contoh vendor-specific, bukan otoritas ACL atau pilihan storage DhaherOS. Metadata filter saja tidak memberi otorisasi. | Dibuka 2026-11-05. |
| [OWASP RAG Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/RAG_Security_Cheat_Sheet.html) | Cheat sheet keamanan sukarela; revisi/tanggal halaman tidak dicatat di sini | Rekomendasi untuk ACL per chunk/retrieval-time, isolation, untrusted context, provenance, cache/deletion propagation; bukan standar hukum, compliance, atau jaminan aman. | Dibuka 2026-11-05. |
| [Microsoft document security trimming for chat](https://learn.microsoft.com/en-us/azure/developer/python/get-started-app-chat-document-security-trim) | Contoh panduan Azure/Python | Implementasi contoh menggunakan index fields/filters untuk membatasi hasil; domain/stack-specific, bukan norma universal atau pengganti otoritas ACL sumber. | Dibuka 2026-11-05. |
| [W3C PROV-O](https://www.w3.org/TR/prov-o/) | W3C Recommendation 2013-04-30 | Vocabulary/ontology untuk merepresentasikan provenance dan derivasi; opsional sebagai rujukan model, belum diadopsi. | Dibuka 2026-11-05. |
| [OWASP LLM01:2025 — Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/) | Edisi 2025 | Panduan risiko sukarela; rekomendasi, bukan kewajiban hukum/jaminan mitigasi. | Ditinjau 2026-11-05. |
| [OWASP LLM06:2025 — Excessive Agency](https://genai.owasp.org/llmrisk/llm062025-excessive-agency/) | Edisi 2025 | Panduan risiko sukarela; dipakai sebagai dasar usulan least privilege/downstream authorization. | Ditinjau 2026-11-05. |
| [OWASP Top 10 for Agentic Applications](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) | Edisi 2026; halaman menyebut rilis 2025-12-09 | Taksonomi threat review; bukan audit atau compliance. | Ditinjau 2026-11-05. |
| [NIST AI 600-1 — Generative AI Profile](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) | Terbit 2024-07-26 | Panduan/profil sukarela; bukan sertifikasi. | Ditinjau 2026-11-05. |
| [NIST Privacy Framework 1.0 final](https://csrc.nist.gov/pubs/cswp/10/nist-privacy-framework-version-10/final) | Final; 2020-01-16 | Alat sukarela, bukan kewajiban hukum. | Ditinjau 2026-11-05. |
| [NIST Privacy Framework 1.1 IPD](https://csrc.nist.gov/pubs/cswp/40/nist-privacy-framework-11/ipd) dan [status proyek](https://www.nist.gov/privacy-framework/new-projects/privacy-framework-version-11) | IPD terbit 2025-04-14; halaman status yang ditinjau diperbarui 2026-04-01 | Status yang tertangkap adalah draft/“Coming soon”; bukan versi final. Periksa ulang sebelum keputusan. | Ditinjau 2026-11-05; status dibatasi pada halaman yang dirujuk. |
| [NIST SP 800-207 — Zero Trust Architecture](https://csrc.nist.gov/pubs/sp/800/207/final) | Final; 2020-08-11 | Panduan arsitektur; bukan bukti kepatuhan. | Ditinjau 2026-11-05. |
| [MCP versioning/compatibility](https://modelcontextprotocol.io/specification/2026-07-28/basic/lifecycle) | Spesifikasi 2026-07-28 | Normatif hanya dalam versi/role yang dicakup; modern request metadata berbeda dari initialize handshake versi lama. | Ditinjau 2026-11-05. |
| [MCP Authorization](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) dan [Security Best Practices](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices) | Dokumentasi/spec 2026-07-28 | Otorisasi opsional; aturan HTTP OAuth/proxy berlaku hanya pada kondisi tersebut. | Ditinjau 2026-11-05. |
| [MCP SEP-1024 local-server setup](https://modelcontextprotocol.io/seps/1024-mcp-client-security-requirements-for-local-server-) | Status Final pada rekaman SEP; tanggal versi tidak dicatat di sini | Bersyarat pada klien yang menawarkan konfigurasi server lokal one-click; bukan konfirmasi tiap tool call. | Ditinjau 2026-11-05; status spesifikasi terbaru tetap mengendalikan. |
| [RFC 9700 — OAuth 2.0 Security BCP](https://www.rfc-editor.org/rfc/rfc9700.html) | BCP 240; terbit 2025-01 | Praktik terbaik OAuth umum; bukan aturan khusus MCP. | Ditinjau 2026-11-05. |
| [OpenTelemetry overview](https://opentelemetry.io/docs/what-is-opentelemetry/) dan [Logs specification](https://opentelemetry.io/docs/specs/otel/logs/) | Versi/tanggal publikasi tidak dicatat di sini | Framework/spec vendor-netral; adopsi/backend belum dipilih. | Ditinjau 2026-11-05. |
| [A2A v1.0 specification](https://a2a-protocol.org/v1.0.0/specification/) dan [A2A vs MCP](https://a2a-protocol.org/v1.0.0/topics/a2a-and-mcp/) | A2A v1.0.0 | Protokol pilihan masa depan, bukan kebutuhan DhaherOS/MVP. | Ditinjau 2026-11-05. |
| [RFC 9110 §9.2.2](https://www.rfc-editor.org/rfc/rfc9110.html#section-9.2.2) | RFC 9110; versi publikasi 2022-06 | Rekomendasi normatif HTTP tentang retry non-idempotent; bukan exactly-once tool guarantee. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [CloudEvents specification](https://github.com/cloudevents/spec/blob/main/cloudevents/spec.md) | Tautan `main`; revisi/tanggal tidak dicatat di delta | Kontrak event hanya jika diadopsi; identitas source+id bukan jaminan exactly-once. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [PostgreSQL 18 `pg_verifybackup`](https://www.postgresql.org/docs/18/app-pgverifybackup.html) | Dokumentasi versi 18 | Bersyarat jika PostgreSQL dipilih; verifikasi backup tidak menggantikan uji restore aplikasi. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [SQLite WAL](https://www.sqlite.org/wal.html) dan [Online Backup API](https://www.sqlite.org/backup.html) | Versi/tanggal tidak dicatat di delta | Bersyarat jika SQLite/WAL dipilih; jangan mengasumsikan backend. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [Tokio `Child`](https://docs.rs/tokio/latest/tokio/process/struct.Child.html) dan [gRPC deadlines](https://grpc.io/docs/guides/deadlines/) | Tokio `latest`; tanggal/version docs gRPC tidak dicatat | Bersyarat jika Tokio/gRPC dipilih; perlu verifikasi terhadap versi implementasi. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [W3C Trace Context](https://www.w3.org/TR/trace-context/) dan [OpenTelemetry context propagation](https://opentelemetry.io/docs/specs/otel/overview/) | Versi/tanggal publikasi tidak dicatat di delta | Propagasi lintas proses hanya jika dipilih; audit/event log tetap bukti terpisah. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [Inspect AI tutorial](https://inspect.aisi.org.uk/tutorial.html), [OpenAI evaluation best practices](https://developers.openai.com/api/docs/guides/evaluation-best-practices), dan [IJCNLP-AACL 2025 paper on position bias](https://aclanthology.org/2025.ijcnlp-long.18/) | Paper IJCNLP-AACL 2025; tanggal dokumen web lain tidak dicatat | Rujukan metode/evaluasi; framework/provider/grader tidak dipilih. | URL diberikan dalam delta; tidak dibuka ulang pada pembaruan ini. |
| [UU No. 27 Tahun 2022 tentang PDP](https://peraturan.bpk.go.id/Details/229798/uu-no-27-tahun-2022) | Undang-undang 2022 | Teks hukum primer; applicability dan status/amendemen terkini belum dinilai. | URL diberikan oleh CFO; tidak dibuka ulang. Recheck sebelum launch. |
| [Permenkominfo No. 5 Tahun 2020](https://jdih.komdigi.go.id/produk_hukum/view/id/759/t/peraturan+menteri+komunikasi+dan+informatika+nomor+5+tahun+2020) | Peraturan 2020 | Teks hukum primer; applicability/status terkini belum dinilai; tidak ada kewajiban disimpulkan. | URL diberikan oleh CFO; tidak dibuka ulang. Recheck sebelum launch. |
| [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/) | W3C Recommendation; 2023 | Target aksesibilitas bersyarat bila UI dipilih; bukan target yang telah disetujui. | Dibuka 2026-11-05; target desain tetap OPEN. |
| [NIST SSDF SP 800-218 v1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | Versi 1.1; tanggal publikasi tidak dicatat dalam delta | Panduan secure development; usulan gate, bukan kewajiban/compliance. | URL diberikan oleh CFO; tidak dibuka ulang. |
| [RustSec advisories](https://rustsec.org/) dan [SLSA v1.2 artifact verification](https://slsa.dev/spec/v1.2/verifying-artifacts) | RustSec tanpa versi tetap; SLSA v1.2 | Bersyarat pada Rust/release dan keputusan adopsi SLSA; format/vendor/tenggat tetap OPEN. | URL diberikan oleh CFO; tidak dibuka ulang. |

### Sumber tambahan yang ditinjau

| ID / sumber yang diberikan | Provenance dan bagian relevan | Status dan perlakuan dalam rencana |
|---|---|---|
| **S1 — JSX** (`17f4d13c16eace8584b3b324`; `.jsx.txt`) | Profil/dashboard berkode React dengan nilai hard-coded; §3, §7, §11, §16. Locator utama: blok roadmap, alur keuangan, diagram sistem, dan ringkasan profil. | Contoh UI dan klaim profil, bukan rekaman otoritatif atau bukti integrasi. Tahap, data, proyek, kemampuan, alat, dan status tidak diverifikasi; detail sensitif tidak disalin. |
| **S2 — workbook** (`198a28484df3337bfc5dc848`; `.xlsx`) | Workbook dengan sheet Dashboard, Inputs, Cashflow, Wishlist, Trading, Goals, Rules; §3, §7, §11, §16. Locator: Goals!A3:C9, Wishlist!A3:J53, Rules!A3:A12, Inputs!A10, serta sheet Trading. | Aturan orang pertama dan catatan prioritas dipisahkan dari wishlist dan contoh dashboard. Keberlakuan kini, formula, dan angka tidak diverifikasi; konflik MUST/NEXT tetap terbuka; sheet Trading kosong meskipun label status workbook menyebut pekerjaan sedang berjalan. |
| **S3 — ekspor Markdown** (`ad5c923fbae7ecb6467a708b`; `.md`) | Kompilasi/dossier profil dan ringkasan konteks, bukan transkrip primer; §3, §10, §16. Locator: bagian nilai, pendidikan/prioritas, named concepts, dan arah arsitektur. | Atribusi dianggap klaim kompilasi; prioritas dan status teknologi/proyek tidak ditetapkan. Nama legacy yang muncul di sumber tidak dibawa ke rencana. |
| **S4 — CV PDF** (`1c9a0cee5eeca362e935086d`; `.pdf`) | CV dua halaman; §3 dan §16. Locator: Professional Summary, Technical Skills, Professional Experience, Selected Projects, Education, Additional Information. | Pengalaman, keterampilan, pendidikan, aspirasi remote/relokasi, dan portofolio adalah klaim CV yang belum diverifikasi; hanya konteks relevan yang diringkas, tanpa detail kontak/identifier. |
| **S5 — CV DOCX** (`a4a8f3e8926e5e0508ed2039`; `.docx`) | CV yang mencakup klaim proyek dashboard personal, toolkit trading, dan eksperimen coding; §3 dan §16. Locator: Professional Summary, Core Skills, Selected Personal Projects, Learning & Career Interests. | Tidak membuktikan hubungan proyek terdahulu dengan DhaherOS, status implementasi, atau pilihan fitur. Nama proyek legacy tidak diteruskan; contoh hanya menjadi aset/klaim yang perlu audit. |
| **S6 — spesifikasi resume** (`ee777d04aacae06575c22092`; `.md`) | Spesifikasi generik pembuatan resume/CV dan template, bukan resume pribadi; §19. Locator: Goal, Input Processing Rules, ATS & Structure Constraints, Template Selection. | Tidak ada fakta pribadi atau keputusan DhaherOS yang diadopsi. Aturan ATS/visual dan panjang dokumen berlaku untuk konteks resume, bukan otomatis untuk produk ini. |
| **P24 — share percakapan eksplorasi visi** | Sesi publik bertanggal 2026-11-09; teks berisi 61 item bernomor, dengan ucapan pemilik, respons AI, fragmen transkripsi, dan AI-generated session summary; §§2, 4, 5, 9, 11–16, 19. Sumber: https://chatgpt.com/share/6af17792-9adc-83ec-a338-0015947056c2?ogimg=plain. | Dibaca lengkap 2026-11-09. Hanya substansi ucapan pemilik yang diringkas sebagai visi eksploratif. Respons dan rangkuman AI, termasuk nama ekosistem/konsep, strategi, angka/modal/harga, target market, atau usulan teknologi/roadmap, tidak dijadikan keputusan. AI-generated session summary mencantumkan fase Vision Exploration & Conceptual Discovery dan bahwa belum ada keputusan; ini diperlakukan sebagai deskripsi summary, bukan keputusan owner. |
| **P25 — masukan kolaborator nonrahasia** | Himpunan ringkasan Librarian atas tanggapan counterpart, tanggal 2026-11-09; brief visi netral saja; §§11, 14–16, 19. | Saran tentang governance/authority, entity lifecycle, data grants/ACL, memori/retensi/revoke/purge, pemisahan personal-entitas, nilai ekonomi setelah total biaya, dan risiko/evaluasi. Semua tetap rekomendasi yang perlu dipilih dan diuji, bukan keputusan owner, spesifikasi final, bukti teknis, atau implementasi. |

### Batas bukti

Pembaruan ini meninjau dokumen rencana, sumber percakapan P16/P18/P20/P22/P23/P24, masukan kolaborator P25, enam sumber tambahan S1–S6, dan rujukan primer yang dicantumkan. Share P24 dibaca dari awal hingga akhir; respons/rangkuman AI diperlakukan sebagai isi sumber, bukan instruksi atau keputusan pemilik. Isi NotebookLM tidak diperiksa dan tetap belum terintegrasi karena akses/sesi sumber memerlukan konfirmasi terpisah. Pembaruan ini tidak melakukan audit teknis terhadap repository DhaherOS, runtime, akun, Obsidian, konektor, provider, UI, atau deployment. Karena itu, tidak dapat disimpulkan bahwa kode, crate, database, CLI, service, integrasi provider/RAG/UI, benchmark, atau tes apa pun telah dibuat atau berhasil. Status tersebut tetap **belum diverifikasi** sampai ada pemeriksaan dan bukti terpisah. Spreadsheet tidak dihitung ulang; klaim CV tidak diverifikasi independen; tidak ada nominal finansial, identifier pribadi, atau rahasia yang dimasukkan.

### Status akhir dokumen

Dokumen ini adalah blueprint perencanaan terpadu untuk ditinjau dan dikonfirmasi. P24 menambah visi eksploratif, bukan spesifikasi, roadmap, arsitektur, MVP, atau izin untuk menjalankan otonomi/aktivitas ekonomi. Discovery, self-organization/evolution, lifecycle entitas, institutional memory, batas kewenangan personal vs entitas, dan nilai ekonomi net-of-costs tetap OPEN. Provider custom OpenAI-compatible/Anthropic, RAG untuk sumber terpilih, dan UI yang diperbarui tetap cakupan rancangan tanpa implementasi atau pilihan rinci yang diklaim. Isi NotebookLM belum dibaca. Dokumen ini tidak menggantikan keputusan pemilik atas pilihan teknis, bisnis, biaya, otoritas, akses data, retensi, lisensi, dan jadwal.
