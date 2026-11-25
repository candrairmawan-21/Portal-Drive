# AI Handoff — Portal-Drive

> Dokumen ini ditujukan untuk **AI assistant atau developer baru** yang
> melanjutkan repo ini. Baca sampai habis sebelum menulis kode. Banyak
> keputusan di sini terlihat aneh kalau konteksnya hilang, dan beberapa di
> antaranya sudah pernah "diperbaiki" secara salah sebelumnya.

---

## 1. Ringkasan 30 detik

Portal internal static site (HTML + Tailwind + vanilla JS) untuk tim Midnorth
/ MR DIY Indonesia. Tidak ada server, tidak ada build step. Data tinggal di
Google Sheets: **dibaca** sebagai CSV publik, **ditulis** lewat Google Apps
Script Web App (`backend/Code.gs`).

Fitur paling kompleks dan paling sering berubah: **Upload PDF laporan →
Google Sheet** di `js/sales-dashboard.js` + `backend/Code.gs`.

---

## 2. Urutan baca yang disarankan

1. `README.md` — gambaran umum & cara deploy
2. `docs/ARCHITECTURE.md` — struktur & peta modul
3. `docs/OFFICIAL_IT_REPORT.md` — **wajib** kalau menyentuh fitur upload PDF
4. `docs/CHANGELOG.md` — kenapa kode jadi seperti sekarang
5. `docs/TROUBLESHOOTING.md` — saat ada laporan bug

---

## 3. Hal yang HARUS dipahami sebelum mengubah apa pun

### 3.1 Jangan ubah urutan filter di `extractStoreRowsFromText_()`

Parser mengambil batas segmen dari **semua** kemunculan pola Store Code —
valid maupun tidak terdaftar — **baru setelah itu** membuang segmen yang
kodenya tidak ada di `DATA_STORE`.

Kelihatannya tidak efisien ("kenapa tidak filter dulu saja?"). Jangan dibalik.
PDF-nya bertata letak 2 kolom per halaman; toko di kolom kanan sering tidak
terdaftar. Kalau difilter lebih dulu, data toko kolom-kanan akan tersedot jadi
bagian dari baris toko kiri sebelumnya dan **mencemari angka penjualannya**
secara diam-diam.

### 3.2 Jangan ganti parsing full-text jadi per-baris

Satu baris logis di PDF bisa terpecah jadi beberapa baris fisik saat konversi,
terutama di sekitar pergantian halaman. Pendekatan full-text scan sengaja
dipilih supaya kebal terhadap itu. Parsing per-baris akan terlihat lebih rapi
dan akan langsung memunculkan bug "toko hilang" yang dulu sudah selesai.

### 3.3 Jangan hapus pemecahan PDF di frontend

Google Docs (dipakai di balik `convert:true`) punya batas keras **~1 juta
karakter**. PDF bulanan bisa 7,7 juta karakter. Yang berbahaya: konversi
**tidak error** — teksnya cuma terpotong diam-diam.

Memecah di backend tidak mungkin, karena backend harus menerima file utuhnya
dulu, dan file utuh itu sendiri sudah terlalu besar.

### 3.4 Jangan sederhanakan `valuesEqual_()`

Fungsi ini sengaja toleran terhadap perbedaan **tipe** yang nilainya sebenarnya
sama: Date vs Date beda instance tapi hari sama; angka `42383500` vs string
`"42383500"`; `""` vs `null` vs `undefined`.

Kalau diganti jadi `===` biasa, **setiap** upload ulang akan salah terdeteksi
sebagai "data berubah" dan menimpa seluruh sheet tanpa perlu.

### 3.5 Jangan sisipkan kolom baru di tengah `LOG_CANONICAL_HEADER`

Selalu tambahkan di **ujung array**. Header `UPLOAD_LOG` bersifat self-healing
dan mencocokkan berdasarkan nama; menyisipkan di tengah akan membuat data
historis bergeser dan salah label. Ini pernah terjadi.

### 3.6 Upload multi-file harus tetap berurutan

Jangan "optimasi" jadi `Promise.all()`. Apps Script punya `LockService` dengan
timeout 30 detik dan batas eksekusi. Paralel akan membuat upload saling
menggagalkan.

### 3.7 Warna, sudut, dan bayangan hanya diatur di DUA tempat

Tampilan memakai palet logo Midnorth (cokelat `#6F4A2A`, oranye `#D4692B`, kuning `#EFAE38`).
Sumber kebenarannya:

1. `tailwind.config` di `index.html` (tepat setelah `<script src="…cdn.tailwindcss.com">`):
   skala warna, `borderRadius`, `boxShadow`, `letterSpacing`.
2. `css/theme.css`: variabel `:root` dan aturan khusus (sidebar, tabel, KPI, modal).

Yang perlu diketahui sebelum menyentuh tampilan:

- **Nama kelas Tailwind sengaja tidak sama dengan warna aslinya.** `slate` = netral hangat,
  `amber`/`orange` = oranye logo, `indigo`/`blue`/`cyan`/`violet` = cokelat logo. Jangan
  "memperbaiki" kelas ini ke warna lain atau mengganti nama kelasnya; ubah skalanya di config.
- `amber-500` (`#BF5A1F`) adalah oranye logo yang **sengaja digelapkan** agar teks putih di
  atasnya lolos kontras 4,5:1. Oranye logo asli ada di `amber-400`.
- **Jangan menulis hex baru** di JS/HTML kalau sudah ada token atau kelas yang cocok. Kalau
  perlu warna baru, tambahkan ke config/`:root`, lalu pakai.
- **Sudut:** kartu 8px (`rounded-2xl/3xl`), kontrol 6px (`rounded-lg/xl`). `rounded-full` hanya
  untuk pil status kecil dan bar progres. **Bayangan:** hanya `shadow-sm`(none) s.d. `shadow-2xl`
  yang tipis; kartu dibedakan dengan garis tipis, bukan bayangan.
- **Tanpa gradien dekoratif.** Tombol utama solid. Satu-satunya gradien yang masih ada adalah
  animasi `.skeleton` di `style.css`.
- **Penanda level bukan emoji.** `getAchievementLevel_()` mengembalikan `icon` berupa HTML
  (`<span class="level-dot">`); jangan mengembalikannya ke emoji. Hati-hati kalau `icon`
  dipakai di tempat yang menganggapnya teks biasa (mis. ekspor Excel); saat ini hanya dipakai
  di tabel achievement.
- **Hijau neon `#39FF14` di AI SOP sengaja dipertahankan** (keputusan pemilik). Jangan ikut
  "diselaraskan" ke palet.
- Hijau = sukses, merah/rose = gagal atau telat. Itu warna status, jangan diubah jadi palet.
- Blok `<style id="professional-visual-refresh">` yang lama sudah dihapus; isinya pindah ke
  `css/theme.css`. Jangan menambah blok `<style>` baru di `index.html`.
- Cache: setelah mengubah `theme.css` atau `style.css`, naikkan angka `?v…` di tag `<link>`.

---

## 4. Jebakan yang paling sering menyesatkan

### "Toko X tidak ketemu di PDF"

Kolom **"Kode Toko Tidak Ketemu di PDF" di `UPLOAD_LOG` hanya berlaku
per-chunk**, bukan per-file utuh. Laporan bulanan mencakup ribuan toko lintas
cabang yang tersebar di rentang halaman berbeda — sangat wajar sebuah toko
"hilang" di chunk 3 tapi ada di chunk 7.

Status hilang yang **sebenarnya** cuma ada di ringkasan akhir dashboard
(`⚠️ N toko TIDAK ketemu di seluruh file`), setelah `foundStoreCodes` dari
semua file & chunk di-union.

Sebelum menyimpulkan ada bug parsing, **selalu cek yang ini dulu.** Lihat
`docs/TROUBLESHOOTING.md` untuk alur diagnosis lengkap.

### "Perubahan `Code.gs` tidak ada efeknya"

Hampir selalu karena belum **deploy ulang**. Save saja tidak mengubah apa yang
dijalankan URL `/exec`.

### "Data masih masuk ke kolom O+"

Batas kolom hanya berlaku untuk baris yang **sedang diproses**. Baris lama dari
sebelum batas ini ada akan ikut bersih saat ter-update oleh upload berikutnya —
bukan sekaligus. Pembersihan menyeluruh harus manual di sheet.

---

## 5. Konvensi kode

- **Bahasa komentar & UI: Indonesia.** Pertahankan. Tim penggunanya berbahasa
  Indonesia.
- **Komentar menjelaskan "kenapa", bukan "apa".** Kode di repo ini penuh
  komentar panjang yang menjelaskan alasan keputusan. Itu disengaja — jangan
  dipangkas jadi ringkas.
- Fungsi privat di Apps Script diakhiri underscore (`namaFungsi_`), mengikuti
  konvensi Apps Script agar tidak muncul di daftar fungsi yang bisa dipanggil.
- Fungsi yang dipanggil dari atribut HTML (`onclick`, `onchange`) harus
  dideklarasikan sebagai `window.namaFungsi = ...`.
- Tidak ada module system di frontend — semua file `js/` berbagi satu global
  scope. Hati-hati tabrakan nama variabel global.
- `index.html` besar (~1,8 MB) karena memuat aset base64. **Jangan
  reformat/prettify seluruh file** — edit setempat saja.

---

## 6. Preferensi pemilik repo

Berdasarkan sesi-sesi sebelumnya:

- Ingin **daftar eksplisit file mana yang berubah** vs mana yang bisa
  dibiarkan, setiap kali ada perubahan.
- Kadang menerima paket kode dari sesi AI lain — **verifikasi dulu terhadap
  source yang sebenarnya** sebelum mengadopsi. Jangan asumsikan kode yang
  disodorkan sesuai dengan isi repo saat ini.
- Prioritas pada kecepatan/responsivitas sistem.
- Lebih suka membangun di dalam sistem yang sudah ada daripada pindah stack.
- Hijau neon di menu AI SOP adalah pilihan sadar, bukan sisa template.
- Menyetujui perubahan tampilan **bertahap** (tahap 1 selesai: palet & komponen dasar). Jangan
  mengerjakan semua rekomendasi sekaligus.

---

## 7. Checklist sebelum menyerahkan perubahan

- [ ] `node --check` pada file JS yang diubah (untuk `Code.gs`, salin dulu ke
      `.js` — Node tidak mengenali ekstensi `.gs`)
- [ ] Kalau `Code.gs` berubah: ingatkan pemilik untuk **deploy ulang**
- [ ] Kalau payload API berubah: pastikan frontend & backend diperbarui
      bersamaan
- [ ] Kalau konstanta konfigurasi berubah: cek tabel sinkronisasi di `README.md`
- [ ] Update `docs/CHANGELOG.md` dengan **apa** dan **kenapa**
- [ ] Beri daftar eksplisit file yang berubah vs yang tidak disentuh
- [ ] Kalau menyentuh tampilan: cek di browser untuk Sales Monitoring, UPT (podium), Monitoring
      Tugas, AI SOP, dan modal login (perubahan tahap 1 hanya diperiksa lewat `node --check`)
- [ ] Naikkan `?v…` pada `<link>` CSS yang berubah

---

## 8. Yang belum dikerjakan / kandidat perbaikan

- **Kredensial hardcoded** di `app.js` (`userDatabase`). Portal internal, tapi
  tetap bukan praktik yang baik.
- **Pembersihan kolom O+ menyeluruh** untuk data historis belum ada — saat ini
  bertahap mengikuti update.
- **`sales-dashboard.js` sudah ~1.700 baris.** Kandidat dipecah (bagian upload
  PDF bisa jadi file sendiri), tapi harus hati-hati karena tidak ada module
  system.
- **Belum ada retry otomatis** kalau satu chunk gagal — user harus klik "Coba
  Lagi" manual (aman, karena anti-duplikat).
- **Belum ada tes otomatis** sama sekali. Verifikasi masih manual lewat upload
  file sungguhan.

### Roadmap tampilan & fitur (disetujui bertahap)

- **Tahap 1 — SELESAI:** palet logo, skala sudut/bayangan, tanpa gradien/emoji, `tabular-nums`.
  Sisa kecil tahap 1: kode toko monospace baru di satu tabel; warna hex abu dingin
  (`#f1f5f9` dst.) masih ada di `<style>` yang disuntik `sales-dashboard.js` (ranking BM/ABM).
- **Tahap 2 — belum:** Beranda "Hari ini" (sales MTD, UPT, tugas jatuh tempo, pengumuman) dan
  navigasi bawah untuk HP. Saat ini menu pertama masih File Manager.
- **Tahap 3 — belum:** daftar bulan/GID dipindah ke tab "Config" di Google Sheet (sekarang
  `SHEET_GIDS` di `sales-dashboard.js` — sudah satu tempat, tetapi tiap bulan baru masih perlu
  edit kode + unggah ke GitHub). Dashboard membaca tab `DATA_STORE` yang **sudah ada** sebagai
  master toko, bukan membuat tab baru.
- **Tahap 4 — belum:** kunci versi library CDN (`lucide@latest`, `xlsx-latest`, dan Tailwind
  CDN). Mengganti Tailwind CDN dengan CSS hasil build akan menambah build step dan bertentangan
  dengan prinsip di `ARCHITECTURE.md` — jangan dikerjakan tanpa persetujuan eksplisit.
- Setelahnya (tanpa urutan): pengumuman & memo, kalender operasional, perbaikan AI SOP
  (👍/👎, saran pertanyaan, kuis), pencarian global, halaman peringkat.
- **Periksa dulu:** README menyebut `backend/Code.gs`, tetapi berkas itu tidak ada di salinan
  repo yang dipakai pada sesi tahap 1 (hanya `ai-sop-backend.gs`). Minta berkasnya sebelum
  menyentuh fitur upload PDF.
