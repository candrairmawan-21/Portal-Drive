# Portal-Drive — Midnorth Data Portal

Portal internal berbasis web statis (HTML + Tailwind + vanilla JS) untuk tim
Midnorth / MR DIY Indonesia. Dipakai sebagai satu pintu masuk ke arsip file,
dashboard UPT, monitoring tugas, form pengajuan barang rusak, analisa data,
asisten AI SOP, dan Sales Intelligence Center.

Backend-nya bukan server sendiri — semuanya bertumpu pada **Google Sheets**
(dibaca sebagai CSV publik) dan **Google Apps Script Web App** (untuk aksi
tulis, mis. upload PDF laporan). Tidak ada build step: repo ini di-deploy
apa adanya sebagai static site.

---

## Dokumentasi

| Dokumen | Isi |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Struktur repo, alur data, peta modul JS, dependensi eksternal |
| [`docs/OFFICIAL_IT_REPORT.md`](docs/OFFICIAL_IT_REPORT.md) | Cara kerja fitur Upload PDF → Google Sheet, format PDF sumber, aturan parsing, anti-duplikat, batas kolom |
| [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) | Gejala umum & cara mendiagnosis (termasuk kasus "toko gagal dibaca") |
| [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Riwayat perubahan penting beserta alasannya |
| [`docs/AI_HANDOFF.md`](docs/AI_HANDOFF.md) | **Baca ini dulu** kalau kamu AI/developer baru yang melanjutkan repo ini |

---

## Struktur singkat

```
Portal-Drive-main/
├── index.html              # Seluruh UI (SPA satu file, section di-toggle via JS)
├── css/style.css           # Styling tambahan di luar Tailwind CDN
├── js/
│   ├── app.js              # Auth, navigasi sidebar, file explorer Drive
│   ├── dashboard.js        # Dashboard UPT
│   ├── monitoring.js       # Monitoring tugas & inbox
│   ├── f003-builder.js     # Form pengajuan barang rusak (F003)
│   ├── analyze.js          # Modul analisa file
│   ├── ai-sop.js           # AI SOP Assistant
│   └── sales-dashboard.js  # Sales Intelligence Center + Upload PDF Official IT Report
├── backend/
│   └── Code.gs             # Google Apps Script backend (upload PDF → Sheet)
├── docs/                   # Dokumentasi (lihat tabel di atas)
├── F003_Template.xlsx      # Template Excel untuk modul F003
└── midnorth java (1).png   # Aset logo
```

---

## Cara deploy

**Frontend:** upload isi folder ini apa adanya ke static hosting (GitHub Pages,
Netlify, dsb.). Tidak ada `npm install`, tidak ada bundler.

**Backend (`backend/Code.gs`):**
1. Buka project Apps Script yang terikat ke spreadsheet Master.
2. Ganti isi `Code.gs` dengan file di `backend/Code.gs`.
3. Aktifkan **Drive API** di Services (dipakai untuk konversi PDF → teks).
4. Deploy sebagai **Web App** (Execute as: Me, Who has access: Anyone).
5. Salin URL `/exec` hasil deploy ke konstanta `WEB_APP_URL` di
   `js/sales-dashboard.js`.

> Setiap kali `Code.gs` diubah, **harus deploy ulang** (bukan sekadar save),
> kalau tidak perubahan tidak akan aktif di URL yang dipakai frontend.

---

## Konfigurasi penting

Nilai-nilai ini harus konsisten antara frontend dan backend:

| Nilai | Lokasi frontend | Lokasi backend |
|---|---|---|
| Spreadsheet Master ID | `SPREADSHEET_ID_OFFICIAL` (sales-dashboard.js) | `SPREADSHEET_ID` (Code.gs) |
| GID `DATA_STORE` | `gidDataStore` di payload upload | `DATA_STORE_GID` |
| GID `OFFICIAL_IT_REPORT` | `gidOfficialReport` di payload upload | `OFFICIAL_REPORT_GID` |
| URL Web App | `WEB_APP_URL` | — (hasil deploy) |

---

## Batasan yang sudah diketahui

- Konversi PDF → teks memakai Google Docs, yang punya batas keras **~1 juta
  karakter** per dokumen. PDF besar otomatis dipecah di browser (lihat
  `docs/OFFICIAL_IT_REPORT.md`).
- Data ditulis ke `OFFICIAL_IT_REPORT` maksimal sampai **kolom N**; kelebihan
  kolom dibuang.
- Kredensial user masih hardcoded di `app.js` (`userDatabase`) — ini portal
  internal, bukan sistem dengan autentikasi sungguhan.
