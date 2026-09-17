/**
 * SMOKE TEST — Hiring-Solo
 * ============================================================================
 * Menjalankan index.html di browser asli (Chromium via Playwright), mengisi
 * data kandidat palsu lewat intercept fetch (tidak menyentuh Google Sheet
 * sungguhan), lalu mengklik keempat tab + fitur utamanya. Test GAGAL kalau ada
 * uncaught exception / console.error.
 *
 * Kenapa ada file ini: dua bug nyata di proyek ini (`copyWaLink` tidak
 * terdefinisi, header tabel Database kurang 1 kolom) lolos lama justru karena
 * tidak ada apa pun yang memvalidasi hal sesederhana "apakah app-nya masih
 * jalan setelah diedit?". Jalankan ini setiap kali selesai mengubah kode.
 *
 * CARA PAKAI:
 *   npm install playwright && npx playwright install chromium
 *   node test/smoke-test.js
 *
 * Kalau Playwright terpasang global, sesuaikan path require di bawah.
 * ============================================================================
 */

const path = require('path');
let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (e) {
    try {
        ({ chromium } = require('/home/claude/.npm-global/lib/node_modules/playwright'));
    } catch (e2) {
        console.error('Playwright tidak ditemukan. Jalankan: npm install playwright && npx playwright install chromium');
        process.exit(1);
    }
}

// Data uji sengaja mencakup kasus-kasus yang pernah jadi bug nyata:
// status kolom V KOSONG (bukan "RAW"), score null/undefined/string kosong,
// cvLink kosong vs berisi URL, screeningAwal REJECT & SKIP.
const mockData = [
    { id:'1', name:'Budi Santoso', position:'Kasir', age:22, city:'Surakarta', phone:'081234567890', gender:'Pria', lastEducation:'SMA', score:0.85, screeningAwal:'', status:'', experience:'-', cvLink:'' },
    { id:'2', name:'Sari Dewi', position:'Promotor/Pramuniaga', age:25, city:'Boyolali', phone:'081234567891', gender:'Wanita', lastEducation:'SMK', score:90, screeningAwal:'SHORTLIST', status:'', experience:'-', cvLink:'' },
    { id:'3', name:'Andi Wijaya', position:'Store Boy', age:20, city:'Sukoharjo', phone:'081234567892', gender:'Pria', lastEducation:'SMA', score:'', screeningAwal:'SHORTLIST', status:'WAITING_CV', experience:'-', cvLink:'' },
    { id:'4', name:'Rina Wati', position:'Supervisor', age:30, city:'Karanganyar', phone:'081234567893', gender:'Wanita', lastEducation:'D3', score:null, screeningAwal:'SHORTLIST', status:'REVIEW_CV', experience:'-', cvLink:'https://drive.google.com/cv4' },
    { id:'5', name:'Joko Susilo', position:'Kasir', age:28, city:'Sragen', phone:'081234567894', gender:'Pria', lastEducation:'SMA', score:undefined, screeningAwal:'SHORTLIST', status:'INTERVIEW', interviewDate:'2026-09-20', experience:'-', cvLink:'' },
    { id:'6', name:'Wati Utami', position:'Kasir', age:24, city:'Surakarta', phone:'081234567895', gender:'Wanita', lastEducation:'SMK', score:0.7, screeningAwal:'SHORTLIST', status:'HIRED', experience:'-', cvLink:'' },
    { id:'7', name:'Agus Salim', position:'Kasir', age:19, city:'Surakarta', phone:'081234567896', gender:'Pria', lastEducation:'SMA', score:0.3, screeningAwal:'REJECT', status:'', experience:'-', cvLink:'' },
    { id:'8', name:'Dewi Lestari', position:'Store Boy', age:21, city:'Surakarta', phone:'081234567897', gender:'Wanita', lastEducation:'SMA', score:0.5, screeningAwal:'SKIP', status:'', experience:'-', cvLink:'' }
];

let pass = 0, fail = 0;
function check(label, ok, extra = '') {
    if (ok) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label}${extra ? ' -> ' + extra : ''}`); }
}

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => {
        // Error jaringan ke Apps Script wajar muncul di lingkungan test (file://),
        // jadi disaring. Sisanya dianggap kegagalan sungguhan.
        if (m.type() === 'error' && !/403|CORS|ERR_FAILED|ERR_INVALID_URL|net::/.test(m.text())) {
            errors.push('[console.error] ' + m.text());
        }
    });

    await page.route('**/exec*', r => r.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(mockData)
    }));

    const indexPath = path.resolve(__dirname, '..', 'index.html');
    await page.goto('file://' + indexPath, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(1500);

    console.log('\n--- Dashboard: kartu metrik (kolom M + V) ---');
    await page.click('#nav-dashboard'); await page.waitForTimeout(400);
    const m = await page.evaluate(() => ({
        total: document.getElementById('metric-total')?.innerText,
        short: document.getElementById('metric-shortlist')?.innerText,
        proc: document.getElementById('metric-process')?.innerText,
        hired: document.getElementById('metric-hired')?.innerText
    }));
    check('Total Pelamar = 8', m.total === '8', m.total);
    check('Shortlisted = 5 (termasuk yang kolom V masih kosong)', m.short === '5', m.short);
    check('Dalam Proses = 4', m.proc === '4', m.proc);
    check('Hired = 1', m.hired === '1', m.hired);

    console.log('\n--- Dashboard: diagram track vs fill ---');
    const bars = await page.evaluate(() => ({
        t: document.querySelectorAll('#dashboard-position-bars .js-bar-track').length,
        f: document.querySelectorAll('#dashboard-position-bars .js-bar-fill').length,
        widths: [...document.querySelectorAll('#dashboard-position-bars .js-bar-fill')].map(e => e.style.width)
    }));
    check('Track & fill ada dan jumlahnya sama', bars.t === bars.f && bars.t > 0, JSON.stringify(bars));
    check('Lebar bar bervariasi (bukan semua 100%)', new Set(bars.widths).size > 1, bars.widths.join(','));

    console.log('\n--- Header: logo tidak rusak ---');
    const logo = await page.evaluate(() => ({
        svg: !!document.querySelector('header svg[aria-label="MR.DIY"]'),
        broken: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).length
    }));
    check('Logo SVG ada & tidak ada gambar rusak', logo.svg && logo.broken === 0, JSON.stringify(logo));

    console.log('\n--- Pipeline: penempatan kolom kanban ---');
    await page.click('#nav-pipeline'); await page.waitForTimeout(500);
    const c = await page.evaluate(() => ({
        s: document.getElementById('count-shortlist')?.innerText,
        w: document.getElementById('count-waiting')?.innerText,
        r: document.getElementById('count-review')?.innerText,
        i: document.getElementById('count-interview')?.innerText,
        h: document.getElementById('count-hired')?.innerText
    }));
    check('Tiap kolom berisi 1 kandidat sesuai tahapannya',
        c.s === '1' && c.w === '1' && c.r === '1' && c.i === '1' && c.h === '1', JSON.stringify(c));

    console.log('\n--- Database: header sinkron dengan body ---');
    await page.click('#nav-database'); await page.waitForTimeout(500);
    const db = await page.evaluate(() => ({
        th: document.querySelectorAll('#view-database thead th').length,
        td: document.querySelectorAll('#database-table-body tr:first-child td').length,
        rows: document.querySelectorAll('#database-table-body tr').length
    }));
    check('Jumlah header = jumlah sel per baris (6)', db.th === 6 && db.td === 6, JSON.stringify(db));
    check('Semua 8 baris tampil', db.rows === 8, String(db.rows));

    console.log('\n--- Database: search, filter, sort ---');
    await page.fill('#db-search-input', 'sari'); await page.waitForTimeout(300);
    const searched = await page.evaluate(() => document.querySelectorAll('#database-table-body tr').length);
    check('Search "sari" menyisakan 1 baris', searched === 1, String(searched));
    await page.fill('#db-search-input', ''); await page.waitForTimeout(300);
    await page.click('#view-database thead th:first-child'); await page.waitForTimeout(300);
    const icon = await page.evaluate(() => document.getElementById('db-sort-icon-name')?.className || '');
    check('Klik header Nama mengaktifkan sorting', /fa-sort-up|fa-sort-down/.test(icon), icon);

    console.log('\n--- Screening: antrean terisi & badge tahapan ---');
    await page.click('#nav-screening'); await page.waitForTimeout(600);
    const sc = await page.evaluate(() => ({
        html: document.getElementById('card-container')?.innerHTML || '',
        queue: document.getElementById('queue-count')?.innerText,
        names: typeof filteredScreeningList !== 'undefined' ? filteredScreeningList.map(c => c.name) : []
    }));
    check('Antrean tidak kosong (status kolom V kosong tetap masuk)', sc.queue !== '0', 'queue=' + sc.queue);
    check('Badge "Tahapan Saat Ini" tampil', sc.html.includes('Tahapan Saat Ini'));
    check('Nomor WA berupa tombol copy', sc.html.includes('copyWaLink('));

    console.log('\n--- Screening: default filter & urutan antrean ---');
    // mockData: hanya id 1 (Budi) yang benar-benar belum discreening (screeningAwal
    // kosong). id 8 (Dewi) berstatus SKIP -- kini TAG TERPISAH dari "Belum di Screening"
    // (lihat CHANGELOG "Redesain Slicer Progress"), jadi TIDAK ikut default.
    check('Default hanya menampilkan yang benar-benar belum discreening', sc.queue === '1', 'queue=' + sc.queue);
    check('Kandidat yang sudah Shortlist tidak muncul di default', !sc.names.includes('Sari Dewi'), sc.names.join(','));
    check('Default menampilkan kandidat yang kolom M-nya kosong', sc.names[0] === 'Budi Santoso', sc.names.join(' > '));

    console.log('\n--- Screening: timeline progress ---');
    check('Timeline "Progress Proses Kandidat" tampil', sc.html.includes('Progress Proses Kandidat'));
    const timelineSteps = ['Pelamar Masuk', 'Screening Awal', 'WA &amp; Form', 'Review CV', 'Interview', 'Hired']
        .filter(s => sc.html.includes(s)).length;
    check('Semua 6 tahap tampil di timeline', timelineSteps === 6, 'ketemu ' + timelineSteps);
    // Default queue sekarang murni kandidat berkolom-M-kosong (Budi Santoso, RAW) --
    // selalu on-track dengan tepat 1 tahap "saat ini".
    const ringCount = (sc.html.match(/ring-blue-100/g) || []).length;
    check('Timeline: tepat 1 tahap "saat ini" untuk kandidat RAW', ringCount === 1, String(ringCount));

    console.log('\n--- Screening: urutan antrean (data terbaru dulu) ---');
    await page.click('#slicer-filter-progress summary').catch(() => {});
    await page.waitForTimeout(200);
    await page.selectOption('#filter-progress', ['ALL_STAGES'], { force: true }).catch(() => {});
    await page.waitForTimeout(500);
    const ordered = await page.evaluate(() => filteredScreeningList.map(c => c.name));
    check('Urutan: data terbaru (baris bawah Sheet) tampil lebih dulu', ordered[0] === 'Dewi Lestari', ordered.join(' > '));
    check('Data paling lama (baris atas Sheet) tampil terakhir', ordered[ordered.length - 1] === 'Budi Santoso', ordered.join(' > '));

    console.log('\n--- Screening: filter progress "Shortlist" menghasilkan data ---');
    // Regresi yang pernah terjadi: gerbang tahap keras membuat filter ini selalu kosong.
    await page.selectOption('#filter-progress', ['SHORTLIST'], { force: true }).catch(() => {});
    await page.waitForTimeout(600);
    const slQueue = await page.evaluate(() => document.getElementById('queue-count')?.innerText);
    check('Filter Shortlist menampilkan kandidat (bukan 0)', slQueue !== '0', 'queue=' + slQueue);
    // Kembalikan ke default supaya pengujian tema di bawah tidak terpengaruh.
    await page.selectOption('#filter-progress', ['BELUM'], { force: true }).catch(() => {});
    await page.waitForTimeout(400);

    console.log('\n--- Slicer Domisili: kota di-generate dinamis dari master database ---');
    // mockData bawaan smoke test ini pakai kota Solo Raya (Surakarta/Boyolali/dst) --
    // yang penting di sini BUKAN kotanya spesifik, tapi bahwa opsi TIDAK LAGI hardcode
    // (dulu selalu persis 5 opsi + "Semua" apa pun isi datanya).
    const cityOptions = await page.evaluate(() =>
        Array.from(document.getElementById('filter-city').options).map(o => o.value)
    );
    const dataCities = [...new Set(mockData.map(c => c.city).filter(Boolean))].sort();
    check('Opsi kota persis sesuai kota unik di data (+ "Semua")',
        cityOptions.length === dataCities.length + 1 && cityOptions[0] === 'all',
        JSON.stringify(cityOptions));
    check('Tidak ada opsi kota kosong/duplikat', new Set(cityOptions).size === cityOptions.length);

    console.log('\n--- Slicer Progress: label bersih, tanpa jargon "Kolom ..." ---');
    const progressHTML = await page.evaluate(() => document.getElementById('filter-progress').outerHTML);
    check('Tidak ada teks "Kolom" yang bocor ke tampilan user', !progressHTML.includes('Kolom'));

    console.log('\n--- Tema Day/Night ---');
    await page.click('#theme-night'); await page.waitForTimeout(300);
    await page.click('#nav-dashboard'); await page.waitForTimeout(400);
    const night = await page.evaluate(() => {
        const f = document.querySelector('#dashboard-position-bars .js-bar-fill');
        const t = document.querySelector('#dashboard-position-bars .js-bar-track');
        return { fill: f && getComputedStyle(f).backgroundColor, track: t && getComputedStyle(t).backgroundColor };
    });
    check('Night mode: warna fill != warna track (bar terbaca)', night.fill !== night.track, JSON.stringify(night));
    await page.click('#theme-day'); await page.waitForTimeout(300);

    console.log('\n--- Error console / uncaught exception ---');
    check('Tidak ada error', errors.length === 0, errors.join(' | '));

    await browser.close();

    console.log(`\n==============================\nPASS: ${pass}   FAIL: ${fail}\n==============================`);
    process.exit(fail > 0 ? 1 : 0);
})();
