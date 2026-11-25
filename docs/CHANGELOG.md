# Changelog

Riwayat perubahan penting beserta **alasannya**. Bagian "kenapa" sama
pentingnya dengan "apa" — banyak keputusan di repo ini tampak aneh kalau
konteksnya hilang.

Urutan dari terbaru ke terlama.

---

## 2026-11 — Tampilan tahap 1 (revisi): palet logo diganti sistem tema 3 pilihan

### Kenapa
Palet cokelat/oranye dari logo (entri di bawah) ditolak pemilik: tidak perlu terpaku pada warna
Midnorth, dan arahnya diminta lebih kreatif. Karena tidak jelas warna mana yang akan disukai,
warna dijadikan **tema yang bisa dipilih** alih-alih menebak satu palet lagi.

### Apa yang berubah
- `css/theme.css`: warna sekarang berupa variabel CSS per tema (`--n-*` netral, `--a-*` aksen,
  `--s-*` sekunder, `--hl-rgb` sorot, `--page` latar). Tiga tema: **cobalt** (default; netral
  hangat + biru kobalt + kuning sorot), **laut** (biru-abu + teal samudra + koral), **anggur**
  (mauve + magenta-plum + emas).
- `tailwind.config` di `index.html` kini membaca variabel itu (`rgb(var(--a-500) / <alpha-value>)`),
  jadi kelas lama (`bg-slate-900`, `text-amber-600`, …) tetap ada dan otomatis mengikuti tema.
- `<html data-theme>` dipasang sebelum render (tanpa kedip) dan disimpan di localStorage
  `portalTheme`. Pemilih tiga titik ada di bawah sidebar; mengganti tema memuat ulang halaman
  supaya chart ikut berwarna baru. **Pemilih ini alat uji** — hapus markup `.theme-picker` dan
  aturan CSS-nya kalau tema sudah dipilih (sisakan satu tema di `:root`).
- `sales-dashboard.js`: warna chart dibaca lewat `themeRgb_('--a-500', alpha)` (bukan hex tetap);
  titik level, badge ranking, dan tombol F003 memakai `var(--…)`.
- Skala tiap warna dibuat otomatis dari satu warna dasar (500) dengan mencampur putih/hitam;
  kontras teks sudah diperiksa ≥ 4,5:1 untuk aksen/sekunder/netral di ketiga tema.

### Tidak berubah
Sudut 8/6px, bayangan tipis, tanpa gradien & emoji, hijau neon AI SOP, warna status
(hijau/merah), serta semua logika data.

---

## 2026-11 — Tampilan tahap 1 (DIGANTIKAN oleh entri di atas untuk soal warna): palet logo, satu skala sudut/bayangan, tanpa gradien & emoji

### Kenapa
Tampilan terasa seperti "template" karena warna bawaan Tailwind (slate dingin + amber + hijau)
tidak berasal dari identitas Midnorth, sudut sangat bulat (`rounded-2xl/3xl` ±76 kali), bayangan
tebal (`shadow-` ±97 kali), gradien (18 kali), dan emoji sebagai penanda level. Fitur dan menu
tidak diubah; ini murni lapisan visual.

### Apa yang berubah
- **`css/theme.css` (BARU)** menggantikan blok inline `<style id="professional-visual-refresh">`
  di `index.html`. Berisi token (`:root`) dan aturan tampilan. Warna logo: cokelat `#6F4A2A`,
  oranye `#D4692B`, kuning `#EFAE38`.
- **`tailwind.config` (di `index.html`, tepat setelah CDN Tailwind)** memetakan ulang skala:
  `slate` = netral hangat, `amber`/`orange` = oranye logo, `indigo`/`blue`/`cyan`/`violet` =
  cokelat logo. Kelas lama (`bg-slate-900`, `text-amber-600`, dst.) TIDAK dihapus dari kode —
  hanya warnanya yang berubah. Config yang sama menetapkan sudut (kartu 8px, kontrol 6px),
  bayangan tipis (`shadow-sm` = none), dan `tracking-wider/widest` lebih rapat.
- **Gradien → warna solid:** hero Sales & Monitoring, kartu ringkasan & bar progres di
  `monitoring.js`, podium di `dashboard.js`, tombol "Live Drive" di `ai-sop.js`.
  (Gradien skeleton loading di `style.css` sengaja dipertahankan; itu animasi, bukan hiasan.)
- **Emoji level → penanda warna:** `getAchievementLevel_()` kini mengembalikan `icon` berupa
  HTML `<span class="level-dot">`, bukan emoji. Ranking BM/ABM memakai angka. Skala level
  dibedakan lewat intensitas oranye → cokelat solid untuk Level 4.
- **Warna chart** di `sales-dashboard.js` (cyan/ungu/indigo) diganti oranye/cokelat logo.
- **Angka rata (`tabular-nums`)** pada tabel & KPI; **kode toko monospace** hanya di tabel
  achievement `sales-dashboard.js` (baris `storeCode`). Tempat lain belum.
- `css/style.css`: warna latar & skeleton disamakan dengan palet; `hover-lift` -4px → -2px.

### Sengaja TIDAK diubah
- Hijau neon `#39FF14` + animasi bounce di menu AI SOP (sudah ditandai "intentionally preserve"
  oleh pemilik). Aturannya dipindah apa adanya ke `theme.css`.
- Hijau (sukses) dan merah/rose (gagal/telat) — itu warna status, bukan dekorasi.
- Logika data, GID, backend, dan urutan menu.

### Catatan verifikasi
Perubahan sudah lolos `node --check`, tetapi **belum dilihat di browser** (tidak ada akses
jaringan saat dikerjakan; Tailwind CDN dibutuhkan untuk merender). Cek manual: Sales Monitoring,
UPT (podium), Monitoring Tugas, AI SOP, dan modal login.

---

## 2026-11 — AI SOP: error "high demand" dari Gemini ditangani dengan retry & fallback model

### Bug: AI SOP selalu menampilkan "This model is currently experiencing high demand"

**Apa terjadi:** Hampir setiap pertanyaan di menu AI SOP berakhir dengan pesan
error mentah dari Gemini API.

**Akar masalah:** Pesan itu adalah HTTP 503 dari Gemini: kapasitas model sedang
penuh (sementara, di sisi Google). Yang membuatnya terasa "selalu error":
1. Frontend dan backend sama-sama menyerah di percobaan pertama, tanpa retry.
2. Backend (Apps Script) hanya memakai satu model dan mengembalikan error Gemini
   sebagai teks jawaban, sehingga retry di frontend tidak pernah terpicu.

**Perbaikan:**
- `js/ai-sop.js`: retry otomatis (maks. 4 percobaan, jeda 2s/4s/8s + jitter) khusus
  error sementara; error permanen (mis. API key salah) tidak diulang. Ada status
  "mencoba lagi (n/4)", timeout 60 detik, tombol **Coba Lagi** tanpa mengetik
  ulang, pesan error berbahasa Indonesia, dan kirim ganda dicegah.
- `js/ai-sop.js`: jawaban AI sekarang di-escape sebelum diformat (sebelumnya masuk
  `innerHTML` mentah); riwayat percakapan hanya menyimpan pertanyaan yang berhasil;
  `innerHTML +=` diganti `insertAdjacentHTML` (tidak membangun ulang seluruh chat).
- `backend/ai-sop-backend.gs` (BARU, pengganti utuh script Apps Script AI SOP):
  - Akar masalah sebenarnya: `callGemini_` lama mengembalikan error Gemini sebagai
    TEKS JAWABAN ("Error dari Gemini API: ..."), sehingga frontend mengira itu
    jawaban normal dan retry tidak pernah terpicu. Sekarang error dilempar dan
    dikirim sebagai `{error, exhausted}`.
  - Retry + exponential backoff, lalu pindah ke model cadangan (urutan bisa diubah
    lewat Script property `GEMINI_MODEL_CHAIN` tanpa deploy ulang kode).
  - Daftar file Drive di-cache 5 menit; cache upload Gemini per file (satu properti
    per file, bukan satu manifest ~9KB); anggaran waktu upload; tunggu status ACTIVE;
    deteksi URI file kedaluwarsa lalu ulang otomatis; LockService anti-upload ganda;
    API key lewat header; system_instruction + riwayat sebagai giliran asli;
    `warmUpLibrary()` / `installWarmupTrigger()` untuk menyiapkan file di latar belakang.
  - **Harus ditempel menggantikan seluruh isi Code.gs AI SOP lalu deploy ulang.**

**Jangan dibalik:** retry di frontend dan di backend sengaja sama-sama ada, dengan
anggaran waktu backend (45 dtk) < timeout frontend (90 dtk). Kalau backend dibuat
lebih lama dari frontend, browser akan menyerah duluan padahal backend masih bekerja.

---

## 2026-09 — Perbaikan lanjutan: kolom bulan tak berlabel & slicer sampai akhir tahun

### Bug: "Agustus hilang" dari slicer UPT

**Apa terjadi:** Setelah perubahan deteksi header di atas, kolom Agustus
hilang total dari dropdown padahal datanya masih ada di sheet.

**Akar masalah:** Deteksi sebelumnya hanya punya SATU jalur fallback: kalau
**seluruh** header gagal dikenali (`dashboardMonthColumns.length === 0`),
baru dipakai asumsi lama (kolom F=Juli, G=Agustus). Tapi kasus nyatanya
**sebagian** — kolom September baru diberi label teks yang jelas
("September 2026"), sedangkan kolom Juli/Agustus lama headernya generik
(mis. cuma "UPT") dari sebelum fitur deteksi otomatis ada. Karena minimal
satu kolom (September) berhasil dikenali, fallback total tidak pernah aktif,
dan kolom yang gagal dikenali (Juli, Agustus) dibuang begitu saja alih-alih
di-fallback.

**Perbaikan:** kolom yang headernya tidak dikenali sekarang TIDAK dibuang.
Bulannya ditebak dari **posisi relatif** terhadap kolom lain yang berhasil
dikenali (asumsi: satu kolom = satu bulan berurutan, sesuai cara kolom-kolom
ini memang ditambah dari waktu ke waktu). Asumsi lama (kolom pertama = Juli
tahun berjalan) sekarang jadi fallback TERAKHIR, hanya dipakai kalau
benar-benar tidak ada satu pun kolom yang teksnya dikenali.

### Slicer UPT diperluas sampai akhir tahun berjalan

**Apa:** `populateDashboardMonthSlicer_()` sekarang menggabungkan kolom nyata
dari sheet dengan sisa bulan tahun berjalan (dari bulan ini sampai Desember)
yang belum punya kolom — supaya bulan mendatang sudah bisa dipilih di slicer
sebelum kolomnya benar-benar dibuat di sheet. Default tetap selalu bulan
berjalan.

**Kenapa:** Permintaan eksplisit — supaya slicer tidak perlu terus disentuh
tiap kali kolom bulan baru ditambahkan; bulan itu sudah "siap" duluan di
dropdown (datanya 0 sampai kolomnya benar-benar ada).

**Efek samping yang disengaja:** `getSelectedUptValue()` tidak lagi jatuh ke
"bulan terbaru yang tersedia" saat bulan yang dipilih belum punya data —
sekarang menampilkan 0 apa adanya. Ini konsisten dengan slicer yang sekarang
sengaja menampilkan bulan-bulan yang belum ada datanya; diam-diam mengganti
ke bulan lain akan menyesatkan (user pilih "Desember", tapi yang tampil
angka November).

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
