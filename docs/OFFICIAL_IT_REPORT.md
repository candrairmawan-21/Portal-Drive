# Fitur Upload PDF → OFFICIAL_IT_REPORT

Fitur paling kompleks di repo ini. Dokumen ini menjelaskan cara kerjanya
end-to-end, keputusan desain yang diambil, dan kenapa.

---

## 1. Apa yang dilakukan

User mengunggah PDF laporan **"TRANSACTION DETAILS ANALYSIS REPORT"** dari
sistem kasir/ERP. Sistem:

1. (Opsional) memecah PDF besar jadi beberapa bagian di browser
2. Mengirim tiap bagian ke Apps Script
3. Apps Script mengonversi PDF → teks lewat Google Docs
4. Mencari Store Code, lookup nama toko ke sheet `DATA_STORE`
5. Menulis hasilnya ke sheet `OFFICIAL_IT_REPORT`
6. Mencatat riwayat ke sheet `UPLOAD_LOG`

---

## 2. Format PDF sumber

Tiap baris data punya bentuk seperti ini:

```
001) BB1001 XGST 25/08/2026 42,383,500 40,873,000 140,000 0 8,000
     1,510,500 0 ALL 1581 370 110,468
```

Urutannya: `No urut) | Store Code | Desc | Tanggal | Gross | Net | ... | Qty`

**Dua hal penting tentang PDF ini:**

**a) Tata letak 2 kolom per halaman.** Toko "kiri" dan toko "kanan" tercetak
berdampingan pada baris cetak yang sama. Toko di kolom kanan bisa jadi bukan
bagian dari grup toko kita (tidak ada di `DATA_STORE`).

**b) Satu baris logis bisa terpecah jadi beberapa baris fisik** saat dikonversi
ke teks — terutama di sekitar pergantian halaman.

Kedua hal ini yang membentuk strategi parsing di bawah.

---

## 3. Strategi parsing: full-text scan, bukan per-baris

Parser **tidak** membaca teks baris-per-baris. Sebagai gantinya
(`extractStoreRowsFromText_` di `Code.gs`):

1. Semua baris digabung jadi **satu string panjang**.
2. Regex `STORE_CODE_RE` (`2 huruf + 4 angka`) mencari **semua** kemunculan
   pola kode toko.
3. Batas antar-baris data ditentukan oleh posisi kemunculan kode berikutnya
   — **apapun kodenya, valid atau tidak**.
4. **Baru setelah itu** segmen dengan kode yang tidak terdaftar di
   `DATA_STORE` dibuang.

**Kenapa urutannya harus begitu?** Kalau kode tak terdaftar difilter lebih
dulu, data milik toko kolom-kanan (yang tidak terdaftar) akan ikut tersedot
jadi bagian dari baris toko kiri sebelumnya — mencemari angkanya. Dengan
memakai semua kemunculan pola sebagai pembatas dulu, segmen tetap terpotong
rapi di tempat yang benar.

Pendekatan full-text ini juga otomatis kebal terhadap masalah (b) di atas:
baris yang terpecah jadi beberapa baris fisik tetap terbaca utuh, karena
parser tidak peduli di mana newline-nya berada.

**Batasnya:** parser tidak kebal kalau karakter **pada kode tokonya sendiri**
berubah/hilang saat konversi. Kalau itu terjadi, kode tersebut tidak akan
cocok dengan regex dan tokonya akan dilaporkan "tidak ketemu". Lihat
`docs/TROUBLESHOOTING.md`.

---

## 4. PDF besar: pemecahan otomatis

Google Docs (yang dipakai di balik `convert:true` untuk membaca teks PDF)
punya **batas keras ~1 juta karakter per dokumen**.

| Jenis laporan | Halaman | Perkiraan karakter | Muat? |
|---|---|---|---|
| Harian | ~50 | jauh di bawah batas | ✅ |
| Bulanan | 1.500+ | ~7,7 juta | ❌ gagal/kepotong diam-diam |

Yang berbahaya: kegagalan ini **senyap**. Konversi tidak error, teksnya cuma
terpotong — jadi data seolah "hilang" tanpa pesan apa pun.

**Solusi:** PDF dipecah **di browser** pakai `pdf-lib`
(`splitPdfIntoChunks_`), maksimal `PDF_CHUNK_MAX_PAGES = 150` halaman per
bagian (≈770rb karakter, aman di bawah batas). Tiap bagian diunggah berurutan
ke endpoint yang **sama** — backend tidak perlu tahu bahwa sebuah upload
adalah bagian dari file yang lebih besar.

Backend tetap punya **lapisan pertahanan kedua**: `estimatePdfPageCount_` +
`MAX_PAGES_PER_UPLOAD = 160` menolak file kebesaran dengan pesan jelas. Ini
untuk kasus orang memanggil endpoint langsung tanpa lewat dashboard.

---

## 5. Upload multi-file

Input file ber-atribut `multiple`. User bisa memilih beberapa PDF sekaligus
(mis. TrxSales Juli + Agustus).

- File diproses **berurutan, bukan paralel** — supaya tidak menabrak batas
  eksekusi/kuota Apps Script dan supaya `LockService` di backend tidak
  terus-terusan bentrok.
- Tiap file tetap melewati pemecahan otomatis per-chunk kalau halamannya banyak.
- Semua file dalam satu sesi berbagi satu `batchId`.
- Payload membawa `fileIndex` / `totalFiles` (posisi file) dan
  `chunkIndex` / `totalChunks` (posisi bagian dalam file itu). Keduanya
  dicatat ke `UPLOAD_LOG`.
- Progress bar dibagi rata antar file; label menampilkan `[File 2/3] ...`.

---

## 6. Anti-duplikat & update-jika-berbeda

Kunci unik: **Store Code + Tanggal**. Tanggal diambil dari **isi baris PDF
itu sendiri**, bukan dari input tanggal di form — penting karena PDF bulanan
mencakup banyak tanggal sekaligus. Input tanggal di form hanya label untuk log.

Saat memproses tiap baris:

| Kondisi | Aksi | Dihitung sebagai |
|---|---|---|
| Kunci belum ada | Insert baris baru di akhir sheet | `count` |
| Kunci ada, isi **identik** | Dilewati | `duplicateCount` |
| Kunci ada, isi **berbeda** | Timpa baris lama di tempat (in-place) | `updatedCount` |

Perbandingan isi memakai `valuesEqual_`, yang toleran terhadap perbedaan
**tipe** yang nilainya sebenarnya sama (Date vs Date beda instance tapi hari
sama; angka `42383500` vs string `"42383500"`; `""` vs `null`). Tanpa ini,
setiap upload ulang akan salah terdeteksi sebagai "berubah".

Konsekuensi penting: **upload aman diulang**. Kalau gagal di tengah, tinggal
ulangi — bagian yang sudah masuk otomatis dilewati.

Kalau kombinasi Store Code + Tanggal yang sama muncul **lebih dari sekali
dalam satu PDF** (mis. baris kembar akibat tata letak 2 kolom), keputusan
diambil dari kemunculan **paling terakhir**, bukan menumpuk beberapa operasi
untuk kunci yang sama. Ini dilakukan lewat `pendingByKey`.

Seluruh blok tulis dibungkus `LockService` (timeout 30 detik) supaya aman
dari upload paralel.

---

## 7. Batas kolom: maksimal kolom N

`MAX_OUTPUT_COLUMNS = 14` (kolom A s.d. N).

Sebelumnya lebar output dinamis mengikuti jumlah token yang ditemukan, jadi
baris dengan token lebih banyak dari biasanya bisa meluber ke kolom O dst.
Sekarang setiap baris dipotong lewat `truncateToMaxColumns_()` — kolom ke-15
dan seterusnya **dibuang sepenuhnya**, tidak disimpan di tempat lain.

Dipasang di **dua jalur tulis**, jadi tidak ada celah:

- **Baris baru:** dipotong di `buildOutputRow_()` sebelum di-append.
- **Baris update:** `writeWidth` dibatasi
  `Math.min(Math.max(existingWidth, newWidth), MAX_OUTPUT_COLUMNS)`.

Perhatikan bagian update: kalau baris lama ditulis **sebelum** batas ini ada
(mungkin lebih lebar dari 14 kolom), sisa kolom di luar batas akan ikut
**dikosongkan** saat baris itu ter-update. Jadi sheet "bersih" secara bertahap
seiring baris ter-refresh oleh upload berikutnya — bukan sekaligus.

> Kalau ingin membersihkan kolom O+ untuk **semua** baris lama sekaligus,
> itu harus dilakukan manual di sheet (hapus kolom O ke kanan), karena skrip
> hanya menyentuh baris yang memang sedang diproses.

Layout kolom:

| Kolom | Isi |
|---|---|
| A | Store Code (hasil normalisasi) |
| B | Store Name (hasil lookup `DATA_STORE`) |
| C..N | Nilai lain dari baris PDF, urut apa adanya (Tanggal, Gross, Net, dst) |

Field "Desc" dari PDF sengaja dibuang karena selalu identik dengan Store Name
hasil lookup — kalau tidak, akan muncul dobel.

---

## 8. Sheet UPLOAD_LOG

Setiap eksekusi dicatat, sukses maupun gagal. Logging dibungkus `try/catch`
terpisah — kegagalan mencatat log **tidak boleh** menggagalkan upload.

Header bersifat **self-healing**: kolom baru otomatis ditambah di **ujung
kanan**, tidak pernah disisipkan di tengah, supaya baris historis tidak
bergeser/salah label.

`LOG_HEADER_ALIASES` memetakan nama header lama ke nama kanonik (mis.
`"Toko Tidak Ketemu di PDF"` → `"Kode Toko Tidak Ketemu di PDF"`). Tanpa ini,
variasi penamaan lama akan dianggap kolom baru dan membuat kolom dobel —
masalah yang pernah benar-benar terjadi.

⚠️ **Kolom "Kode Toko Tidak Ketemu di PDF" di UPLOAD_LOG bersifat per-chunk,
bukan per-file.** Toko yang tidak ketemu di satu bagian sangat mungkin justru
ketemu di bagian lain. Untuk status hilang yang **sebenarnya**, lihat ringkasan
akhir di dashboard setelah semua bagian selesai — frontend meng-union
`foundStoreCodes` dari semua file & chunk dulu, baru menghitung selisihnya.

---

## 9. Payload API

```json
{
  "action": "UPLOAD_PDF_OFFICIAL",
  "fileName": "TrxSales_2026-08.pdf (hal 1-150)",
  "fileData": "data:application/pdf;base64,...",
  "reportDate": "2026-09-16",
  "gidDataStore": "1124553459",
  "gidOfficialReport": "1129267198",
  "batchId": "1758000000000-a1b2c3",
  "chunkIndex": 1,
  "totalChunks": 11,
  "fileIndex": 1,
  "totalFiles": 2
}
```

Respons sukses membawa `count`, `skippedCount`, `duplicateCount`,
`updatedCount`, `foundStoreCodes`, `registeredStoreCodes`, `missingStoreCodes`,
`missingStoreCodeSnippets`, `sampleRows`, dan `rawTextPreview` (3000 karakter
pertama, berguna untuk diagnosis).

Respons gagal membawa `message` dan `stage` — nilai `stage` yang mungkin:
`convert_pdf`, `load_data_store`, `find_sheet`, `extract_rows`,
`acquire_lock`, `insert_data`.
