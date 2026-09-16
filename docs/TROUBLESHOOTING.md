# Troubleshooting

---

## "Ada beberapa toko yang gagal dibaca dari PDF"

Gejala paling sering dilaporkan. Ini alur diagnosisnya — **jangan langsung
mengubah regex**, karena penyebabnya sering bukan di regex.

### Langkah 1 — cek kolom "Diagnostik Toko Hilang" di `UPLOAD_LOG`

`buildMissingCodeSnippets_()` mencari kode toko yang hilang di teks mentah
dengan pencarian **longgar** (substring biasa, tanpa aturan boundary ketat),
lalu menampilkan potongan teks di sekitarnya. Hasilnya membedakan dua
kemungkinan yang sangat berbeda:

**A. Snippet berbunyi "TIDAK ADA SAMA SEKALI di teks hasil konversi"**

Kodenya memang tidak muncul di teks yang berhasil dibaca. Ini **bukan** soal
regex. Kemungkinan penyebab:

- PDF-nya kebesaran dan konversi terpotong diam-diam (cek jumlah halaman vs
  `PDF_CHUNK_MAX_PAGES`; pastikan pemecahan otomatis benar-benar jalan — kalau
  `pdf-lib` gagal dimuat, file dikirim utuh)
- Konversi PDF → teks Google Docs memang merusak/menghilangkan karakter pada
  kode toko tersebut
- Tokonya memang tidak ada di rentang halaman bagian (chunk) ini — **cek dulu
  ringkasan akhir di dashboard**, bukan satu baris log

**B. Snippet menampilkan potongan teks berisi kodenya**

Kodenya ada, tapi tidak lolos aturan boundary. Perhatikan apakah ada karakter
tersisip, spasi aneh, atau kode yang menempel ke angka lain. Kalau ya, ini
memang kandidat penyesuaian regex — dan snippet-nya memberi tahu persis
polanya seperti apa.

### Langkah 2 — pastikan bukan artefak per-chunk

Ini jebakan yang paling sering menyesatkan. Kolom "Kode Toko Tidak Ketemu di
PDF" di `UPLOAD_LOG` **hanya berlaku untuk satu bagian (chunk) file itu**.
Laporan bulanan mencakup ribuan toko lintas cabang yang tersebar di rentang
halaman berbeda — wajar kalau sebuah toko "hilang" di chunk 3 tapi ada di
chunk 7.

Status hilang yang **sebenarnya** hanya ditampilkan di ringkasan akhir
dashboard setelah semua bagian selesai (`⚠️ N toko TIDAK ketemu di seluruh
file`), karena di situ `foundStoreCodes` dari semua file & chunk sudah
di-union.

### Langkah 3 — cek `DATA_STORE`

Toko yang tidak terdaftar di `DATA_STORE` memang sengaja dibuang (dihitung
sebagai `skippedCount`, bukan error). Pastikan kode toko di kolom A
`DATA_STORE` ejaannya persis sama dengan yang di PDF. `normalizeCode_()`
sudah menangani spasi, huruf kecil, penomoran di depan (`1)`, `01.`), dan
tanda baca nyasar di belakang — tapi tidak menangani salah ketik.

### Langkah 4 — periksa `rawTextPreview`

Respons API membawa 3000 karakter pertama teks hasil konversi. Kalau isinya
kosong atau kacau, masalahnya di tahap konversi, bukan parsing.

---

## Upload gagal di tengah jalan

**Aman diulang.** Anti-duplikat Store Code + Tanggal membuat bagian yang
sudah berhasil masuk otomatis dilewati. Klik "Coba Lagi".

---

## Error "User rate limit exceeded"

Kuota OCR Google habis. Fallback OCR hanya terpanggil kalau `convert:true`
menghasilkan teks kosong/nyaris kosong (< 3 baris) — indikasi PDF hasil scan
gambar. Tunggu beberapa saat lalu coba lagi.

Kalau ini sering terjadi padahal PDF-nya bukan hasil scan, curigai konversi
normal yang gagal diam-diam.

---

## Error "Proses upload lain sedang berjalan"

`LockService` timeout setelah 30 detik. Ada upload lain yang sedang menulis.
Tunggu sebentar lalu ulangi. Kalau terus terjadi padahal tidak ada yang
mengupload, kemungkinan ada eksekusi yang menggantung — cek Executions di
Apps Script.

---

## Data masuk ke kolom O dan seterusnya

Seharusnya tidak terjadi lagi sejak `MAX_OUTPUT_COLUMNS` dipasang. Kalau masih
ada:

1. Pastikan `Code.gs` versi terbaru sudah di-**deploy ulang**, bukan sekadar
   di-save. Save saja tidak mengubah apa yang dijalankan URL `/exec`.
2. Baris yang meluber kemungkinan **data lama** dari sebelum batas ini ada.
   Skrip hanya membersihkan baris yang sedang ia proses — baris lama akan
   ikut bersih saat ter-update oleh upload berikutnya, atau bisa dibersihkan
   manual dengan menghapus kolom O ke kanan di sheet.

---

## Perubahan `Code.gs` tidak terasa efeknya

Hampir selalu karena belum deploy ulang. Di Apps Script: **Deploy → Manage
deployments → Edit → Version: New version → Deploy**. Kalau membuat deployment
*baru* (bukan edit yang lama), URL-nya berubah dan `WEB_APP_URL` di
`sales-dashboard.js` harus ikut diperbarui.

---

## Modal upload tidak bereaksi / ikon tidak muncul

Ikon Lucide di-render lewat `lucide.createIcons()` yang harus dipanggil ulang
setiap kali ada elemen baru dimasukkan ke DOM. Kalau ikon hilang setelah
render dinamis, kemungkinan pemanggilan itu terlewat.

---

## Dashboard menampilkan data lama

Sheet dibaca sebagai CSV publik, yang punya cache di sisi Google. Perubahan di
sheet bisa butuh beberapa menit untuk terlihat. Ini bukan bug di frontend.

---

## Dashboard masih menampilkan bulan lama padahal data bulan baru sudah ada

### Dashboard UPT

Kolom bulan ditemukan otomatis dari **baris header** sheet Summary. Kalau bulan
baru tidak muncul:

1. **Cek header kolomnya.** Kolom bulan harus ada di index 5 (kolom F) ke kanan,
   dan headernya harus mengandung nama bulan yang bisa dikenali — Indonesia atau
   Inggris, lengkap atau singkatan ("UPT September", "September 2026", "Sep-26",
   "2026-09"). Header kosong atau cuma angka tidak akan terdeteksi.
2. **Cek console.** Kalau muncul `Header bulan tidak terdeteksi di sheet
   Summary`, berarti tidak ada satu pun kolom yang lolos deteksi dan sistem
   memakai fallback kolom F/G.
3. **Cache CSV.** Sheet dibaca sebagai CSV publik yang di-cache Google; kolom
   baru bisa butuh beberapa menit untuk terlihat.

Kalau kolom bulan berjalan memang belum ada di sheet, dashboard sengaja
menampilkan bulan **terbaru yang tersedia** — bukan kosong.

### Sales

Daftar bulan berasal dari `SHEET_GIDS` di `js/sales-dashboard.js`, bukan dari
HTML. Kalau bulan berjalan tidak muncul, GID-nya belum ditambahkan.

Gejalanya jelas: muncul catatan kuning di bawah dropdown (`Data <bulan> belum
tersedia — menampilkan bulan terbaru yang ada`) dan peringatan di console yang
menyebutkan key mana yang perlu ditambahkan.

**Cara menambah:** buka sheet bulan tersebut, ambil angka setelah `#gid=` di
URL-nya, lalu tambahkan satu baris ke `SHEET_GIDS`:

```js
'Nov26': '1234567890',
```

Dropdown akan langsung memuatnya — tidak perlu menyentuh `index.html`.

> GID tidak bisa diturunkan otomatis dari nama bulan; angka itu ditentukan
> Google saat tab sheet dibuat. Ini satu-satunya langkah manual yang tersisa
> dalam alur bulanan.
