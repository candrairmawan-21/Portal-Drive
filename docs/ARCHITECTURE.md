# Arsitektur Portal-Drive

## Prinsip dasar

1. **Tidak ada server sendiri.** Frontend adalah static site. Semua data
   tinggal di Google Sheets.
2. **Baca = CSV publik.** Sheet di-publish ke web sebagai CSV, lalu di-`fetch`
   langsung dari browser. Cepat, tanpa auth, tapi berarti data yang dibaca
   bersifat publik-bagi-yang-tahu-URL.
3. **Tulis = Apps Script Web App.** Aksi yang butuh menulis (upload PDF)
   dikirim sebagai POST JSON ke endpoint `/exec`.
4. **Tidak ada build step.** Tidak ada bundler, tidak ada transpile. Semua
   library dimuat dari CDN. Edit file → refresh browser → langsung terlihat.

## Alur data

```
                 ┌──────────────────────────┐
   BACA (CSV)    │   Google Sheets (publik)  │
  ───────────────►  - Portal files registry  │
                 │  - Dashboard UPT          │
                 │  - Monitoring tugas       │
                 │  - Sales submission       │
                 │  - OFFICIAL_IT_REPORT     │
                 └──────────────────────────┘
                              ▲
                              │ tulis
                 ┌────────────┴─────────────┐
   TULIS (POST)  │  Apps Script Web App     │
  ───────────────►  backend/Code.gs         │
                 │  - konversi PDF→teks     │
                 │  - lookup DATA_STORE     │
                 │  - anti-duplikat         │
                 │  - tulis ke Master       │
                 │  - catat UPLOAD_LOG      │
                 └──────────────────────────┘
```

## Kenapa CSV untuk baca, Apps Script untuk tulis?

CSV publik jauh lebih cepat dan tidak kena kuota Apps Script, jadi cocok untuk
pembacaan yang sering (dashboard auto-refresh). Tapi CSV read-only, jadi begitu
butuh menulis (dan butuh logic: lookup, validasi, anti-duplikat), harus lewat
Apps Script. Pemisahan ini disengaja — jangan memindahkan pembacaan dashboard
ke Apps Script kecuali ada alasan kuat, karena akan langsung memakan kuota.

## Peta modul JS

Semua file di `js/` dimuat oleh `index.html` dan berbagi satu global scope.
Tidak ada module system — perhatikan tabrakan nama variabel global saat
menambah kode.

| File | Baris | Tanggung jawab |
|---|---|---|
| `app.js` | ~590 | Login (`userDatabase` hardcoded), navigasi sidebar, file explorer Drive (grid/list), breadcrumb, modal password |
| `dashboard.js` | ~470 | Dashboard UPT: fetch CSV, render KPI, Chart.js |
| `monitoring.js` | ~864 | Monitoring tugas & inbox, accordion dengan state persist saat auto-refresh, update status via Apps Script terpisah |
| `f003-builder.js` | ~498 | Form pengajuan barang rusak F003, generate Excel dari `F003_Template.xlsx` |
| `analyze.js` | ~491 | Modul analisa: bandingkan file DB vs file kedua |
| `ai-sop.js` | ~168 | AI SOP Assistant, menyimpan histori 6 giliran terakhir, anti-CORS via Apps Script |
| `sales-dashboard.js` | ~1719 | Sales Intelligence Center: dua sumber data (Submission vs Official IT Report), chart, tabel perbandingan, **dan seluruh alur Upload PDF** |

`sales-dashboard.js` adalah file terbesar dan paling aktif berubah. Bagian
Upload PDF ada di section 8 / 8b di dalamnya.

## Dependensi eksternal (semua dari CDN)

| Library | Dipakai untuk |
|---|---|
| Tailwind CSS | Seluruh styling |
| Lucide | Ikon (`lucide.createIcons()` dipanggil ulang tiap render) |
| Chart.js | Grafik dashboard & sales |
| SheetJS (xlsx) | Baca/tulis Excel di modul F003 & analyze |
| pdf-lib | Memecah PDF besar di browser sebelum diunggah |

`pdf-lib` dimuat **lazy** (hanya saat upload PDF dijalankan) lewat
`loadPdfLibScript_()`. Kalau gagal dimuat (offline), upload tetap jalan sebagai
file tunggal dan backend yang akan menolak kalau kebesaran.

## Catatan tentang `index.html`

File ini besar (~1,8 MB) karena memuat aset base64 (favicon, dsb.) langsung di
dalamnya. Jangan reformat/prettify seluruh file — cari section yang relevan dan
edit setempat saja.
