# Changelog

Riwayat perubahan penting beserta **alasannya**. Bagian "kenapa" sama
pentingnya dengan "apa" — banyak keputusan di repo ini tampak aneh kalau
konteksnya hilang.

Urutan dari terbaru ke terlama.

---

## 2026-09 — Slicer bulan otomatis (Dashboard UPT & Sales)

### Dashboard UPT — kolom bulan ditemukan otomatis dari header sheet

**Apa:** `parseDashboardCSV()` sekarang membaca **baris header** sheet Summary
untuk menemukan kolom bulan (index 5 ke kanan) lewat `detectMonthFromHeader_()`.
Tiap baris data menyimpan `uptByMonth` (map key bulan → nilai), bukan lagi
`uptJuly`/`uptAugust`. Dropdown diisi oleh `populateDashboardMonthSlicer_()`
dan default-nya `getDefaultDashboardMonthKey_()` = bulan berjalan.

**Kenapa:** Parser lama hardcode kolom F (Juli) dan G (Agustus). Begitu kolom
September ditambahkan di sheet, dashboard tetap menampilkan Agustus sampai ada
yang mengedit kode. Sekarang menambah kolom bulan baru di sheet sudah cukup.

**Detail:** `detectMonthFromHeader_()` menerima berbagai ejaan — Indonesia &
Inggris, lengkap maupun singkatan ("UPT Agustus", "September 2026", "Sep-26",
"OKT 2026", "2026-11"). Tahun diambil dari header kalau ada; kalau tidak,
diasumsikan tahun berjalan, dengan koreksi mundur setahun bila hasilnya jatuh
lebih dari 6 bulan di masa depan (kasus header "Desember" dibaca pada Januari).
Kalau header sama sekali tidak mengandung nama bulan, ada fallback ke perilaku
lama (kolom F/G) supaya dashboard tidak kosong total.

Opsi bulan di `index.html` dihapus dan diganti placeholder — daftar bulan tidak
lagi ditulis di dua tempat.

### Sales — dropdown bulan bersumber dari `SHEET_GIDS`

**Apa:** `populateSalesMonthSlicer_()` membangun dropdown dari `SHEET_GIDS`.
`setDefaultBulanSlicer_()` kini jatuh ke bulan **terbaru yang tersedia** kalau
bulan berjalan belum terdaftar, disertai catatan di UI dan peringatan console.
Fallback GID `'1766415704'` (Agustus 2026) yang di-hardcode diganti
`resolveMonthGid_()`.

**Kenapa:** Daftar bulan sebelumnya ditulis dua kali (HTML + `SHEET_GIDS`) dan
bisa tidak sinkron. Lebih penting: opsi HTML berhenti di Oktober 2026 dengan
Agustus 2026 sebagai `selected`. Mulai November 2026, `setDefaultBulanSlicer_()`
tidak menemukan opsi bulan berjalan dan **diam-diam kembali ke Agustus 2026** —
makin lama makin menyesatkan. Sekarang gagalnya terlihat, bukan senyap.

**Catatan:** GID sheet tidak bisa ditebak otomatis (Google yang menentukannya
saat tab baru dibuat), jadi menambah bulan baru tetap perlu satu baris di
`SHEET_GIDS`. Yang berubah: kalau lupa, sistem memberi tahu alih-alih
menampilkan bulan lama tanpa penjelasan.

Kedua slicer menandai pilihan manual user (`dataset.userPicked`) supaya
refresh data tidak menarik pilihan balik ke bulan berjalan.

---

## 2026-09 — Batas kolom N, multi-file upload, dokumentasi

### Batas kolom output (maks. kolom N)

**Apa:** Konstanta `MAX_OUTPUT_COLUMNS = 14` + fungsi `truncateToMaxColumns_()`.
Data yang ditulis ke `OFFICIAL_IT_REPORT` tidak pernah melewati kolom N; yang
seharusnya jatuh di kolom O dst dibuang.

**Kenapa:** Sebelumnya lebar output dinamis mengikuti jumlah token yang
ditemukan di baris PDF. Baris dengan token lebih banyak dari biasanya bisa
meluber ke kolom O+ dan merusak struktur sheet.

**Detail implementasi:** Dipasang di dua jalur tulis — `buildOutputRow_()`
untuk baris baru, dan pembatasan `writeWidth` untuk baris update. Khusus
update, `writeWidth` sekarang `Math.min(Math.max(existingWidth, newWidth),
MAX_OUTPUT_COLUMNS)` — bukan lagi mengikuti yang lebih lebar. Ini disengaja:
baris lama peninggalan versi sebelum batas ini ada (yang mungkin lebih lebar
dari 14 kolom) akan ikut dikosongkan kolom O+-nya saat ter-update.

### Upload multi-file

**Apa:** Input file dapat atribut `multiple`. `submitOfficialPdf()` sekarang
melakukan loop atas semua file terpilih.

**Kenapa:** Sebelumnya hanya `input.files[0]` yang diproses — user harus
mengulang proses upload satu per satu untuk tiap bulan.

**Detail implementasi:**
- File diproses **berurutan, bukan paralel** — mencegah tabrakan
  `LockService` di backend dan menghindari batas eksekusi Apps Script.
- Payload menambah `fileIndex` / `totalFiles`, dicatat di kolom "Berkas ke-"
  pada `UPLOAD_LOG`.
- Progress bar dibagi rata antar file (`base` + `span`), label `[File 2/3]`.
- `foundCodesUnion` sekarang menggabungkan semua file **dan** semua chunk
  sebelum menghitung toko yang hilang — supaya sesi multi-bulan tidak salah
  melaporkan toko sebagai hilang.
- Pesan akhir menampilkan ringkasan per file.

### Dokumentasi

Folder `docs/` dibuat berisi arsitektur, dokumentasi mendalam fitur upload
PDF, panduan troubleshooting, changelog ini, dan AI handoff. `Code.gs`
dipindahkan ke `backend/Code.gs` agar ikut terversi bersama repo — sebelumnya
hanya hidup di editor Apps Script.

---

## Sebelumnya — Update-jika-berbeda

**Apa:** Kalau kombinasi Store Code + Tanggal sudah ada di sheet, isi barisnya
sekarang **dibandingkan** dulu. Identik → dilewati (duplikat). Berbeda →
baris lama ditimpa di tempat (update), bukan ditambahkan sebagai baris baru.

**Kenapa:** Sebelumnya kunci yang sudah ada **selalu** dilewati, tanpa peduli
nilainya berubah atau tidak. Akibatnya koreksi data di PDF yang diunggah ulang
tidak pernah masuk.

**Detail implementasi:** `buildExistingKeySet_` (Set) diganti
`buildExistingKeyMap_` (Map) yang juga menyimpan `rowIndex` dan isi baris.
Perbandingan lewat `valuesEqual_` sengaja toleran terhadap perbedaan tipe yang
nilainya sama (Date vs Date beda instance, angka vs string angka, `""` vs
`null`) — tanpa ini setiap upload ulang akan salah terdeteksi sebagai
"berubah". `pendingByKey` memastikan kunci yang muncul berkali-kali dalam satu
PDF diputuskan dari kemunculan terakhir saja.

---

## Sebelumnya — Dukungan PDF besar (laporan bulanan)

**Apa:** Pemecahan PDF otomatis di browser pakai `pdf-lib`
(`splitPdfIntoChunks_`, maks. 150 halaman/bagian), plus penjaga di backend
(`estimatePdfPageCount_` + `MAX_PAGES_PER_UPLOAD = 160`).

**Kenapa:** Google Docs — yang dipakai di balik `convert:true` untuk membaca
teks PDF — punya batas keras ~1 juta karakter per dokumen. PDF harian (±50
halaman) aman, tapi PDF bulanan (diukur: 1.503 halaman = **7,7 juta
karakter**) jauh melebihinya. Yang berbahaya, konversi tidak error — teksnya
cuma terpotong diam-diam, jadi data seolah hilang tanpa pesan apa pun.

**Kenapa dipecah di frontend, bukan backend:** Backend tidak bisa memecah PDF
tanpa menerima file utuhnya dulu — dan file utuh itu sendiri sudah terlalu
besar untuk diproses. Memecah di browser membuat backend tidak perlu tahu
apa-apa soal chunking; anti-duplikat Store Code + Tanggal yang membuat proses
ini aman diulang.

---

## Sebelumnya — Anti-duplikat Store Code + Tanggal

**Apa:** Sebelum insert, kombinasi Store Code + Tanggal dicek terhadap data
yang sudah ada. Dibungkus `LockService` (timeout 30 detik).

**Kenapa:** Membuat upload aman diulang — penting karena upload multi-chunk
bisa gagal di tengah jalan. Tanggal diambil dari **isi baris PDF**, bukan dari
input tanggal di form, karena PDF bulanan mencakup banyak tanggal sekaligus.

---

## Sebelumnya — UPLOAD_LOG self-healing header

**Apa:** Kolom log dicocokkan berdasarkan **nama**, bukan posisi. Kolom yang
belum ada ditambahkan di ujung kanan. `LOG_HEADER_ALIASES` memetakan nama
lama ke nama kanonik.

**Kenapa:** Versi skrip yang berbeda menulis nama header yang sedikit berbeda
(`"Toko Tidak Ketemu di PDF"` vs `"Kode Toko Tidak Ketemu di PDF"`), sehingga
tercipta kolom dobel dan data historis bergeser/salah label. Penambahan selalu
di ujung kanan — tidak pernah disisipkan di tengah — supaya baris lama tidak
ikut bergeser.

---

## Sebelumnya — Parsing full-text scan

**Apa:** Parser berhenti membaca per-baris; semua teks digabung jadi satu
string, lalu kemunculan pola Store Code dipakai sebagai pembatas antar-baris
data.

**Kenapa:** (a) Satu baris logis bisa terpecah jadi beberapa baris fisik saat
konversi, terutama di sekitar pergantian halaman. (b) PDF bertata letak 2
kolom per halaman, dan toko di kolom kanan bisa tidak terdaftar di
`DATA_STORE`.

**Urutan yang kritis:** batas segmen diambil dari **semua** kemunculan pola
kode (valid maupun tidak) **dulu**, baru setelah itu segmen dengan kode tak
terdaftar dibuang. Kalau dibalik, data toko kolom-kanan akan tersedot jadi
bagian dari baris toko kiri dan mencemari angkanya.
