/* ==========================================================================
   1. REGULASI DATA & VARIABEL DASHBOARD UPT
   ========================================================================== */
const DASHBOARD_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=425930614&single=true&output=csv';
let dashboardData = [];
let chartInstance = null;

/* ==========================================================================
   2. PENGAMBIL DATA UPT (FETCH LOGIC)
   ========================================================================== */
async function fetchDashboardData() {
    const container = document.getElementById('dashboard-loading');
    if (container) container.classList.remove('hidden');

    try {
        const response = await fetch(DASHBOARD_API_URL);
        const csvText = await response.text();
        dashboardData = parseDashboardCSV(csvText);
        
        initSlicers();
        applyDashboardFilters();
        if (typeof fetchAndRenderUptSalesTable === "function") {
            fetchAndRenderUptSalesTable();
        }
    } catch (error) {
        console.error('Error memuat data dashboard:', error);
    } finally {
        if (container) container.classList.add('hidden');
    }
}

function parseDashboardCSV(text) {
    let lines = text.split('\n');
    if (lines.length === 0) return [];
    
    let result = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        let row = []; let inQuotes = false; let currentStr = "";
        
        for (let char of lines[i]) {
            if (char === '"') { inQuotes = !inQuotes; } 
            else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; } 
            else { currentStr += char; }
        }
        row.push(currentStr.trim());
        
        if (row.length >= 6) {
            result.push({
                namaBM: row[0].replace(/[\r"]/g, ""),
                namaABM: row[1].replace(/[\r"]/g, ""),
                namaStore: row[2].replace(/[\r"]/g, ""),
                nik: row[3].replace(/[\r"]/g, ""),
                namaStaff: row[4].replace(/[\r"]/g, ""),
                uptJuly: parseFloat(row[5].replace(/[\r"]/g, "")) || 0,
                // Pembacaan Kolom G (index 6) Sheet Summary khusus untuk nilai UPT Periode Agustus
                uptAugust: parseFloat((row[6] || '').replace(/[\r"]/g, "")) || parseFloat(row[5].replace(/[\r"]/g, "")) || 0
            });
        }
    }
    return result;
}

/* ==========================================================================
   3. SISTEM FILTERING & SLICERS
   ========================================================================== */
function initSlicers() {
    const slicerKategori = document.getElementById('slicerKategori');
    const slicerSpesifik = document.getElementById('slicerSpesifik');

    if (!slicerKategori || !slicerSpesifik) return;

    const newSlicerKategori = slicerKategori.cloneNode(true);
    slicerKategori.parentNode.replaceChild(newSlicerKategori, slicerKategori);

    const newSlicerSpesifik = slicerSpesifik.cloneNode(true);
    slicerSpesifik.parentNode.replaceChild(newSlicerSpesifik, slicerSpesifik);

    newSlicerKategori.addEventListener('change', function() {
        const kategori = this.value;
        const targetSpesifik = document.getElementById('slicerSpesifik');
        targetSpesifik.innerHTML = '<option value="all">-- Semua --</option>';
        
        if (kategori === 'all') {
            targetSpesifik.disabled = true;
            targetSpesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        } else {
            targetSpesifik.disabled = false;
            targetSpesifik.classList.remove('bg-slate-100', 'cursor-not-allowed');
            
            let uniqueItems = new Set();
            dashboardData.forEach(item => {
                if (kategori === 'bm' && item.namaBM && item.namaBM !== "-") uniqueItems.add(item.namaBM.trim());
                if (kategori === 'abm' && item.namaABM && item.namaABM !== "-") uniqueItems.add(item.namaABM.trim());
            });

            Array.from(uniqueItems).sort().forEach(name => {
                targetSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applyDashboardFilters();
        if (typeof fetchAndRenderUptSalesTable === "function") fetchAndRenderUptSalesTable();
    });

    document.getElementById('slicerBulan')?.addEventListener('change', () => {
        applyDashboardFilters();
        if (typeof fetchAndRenderUptSalesTable === "function") fetchAndRenderUptSalesTable();
    });
    
    document.getElementById('slicerSpesifik')?.addEventListener('change', () => {
        applyDashboardFilters();
        if (typeof fetchAndRenderUptSalesTable === "function") fetchAndRenderUptSalesTable();
    });
}

function getSelectedUptValue(item) {
    const selectedMonth = document.getElementById('slicerBulan')?.value || 'august';
    return selectedMonth === 'august' ? (item.uptAugust || item.uptJuly || 0) : (item.uptJuly || 0);
}

function applyDashboardFilters() {
    const kategori = document.getElementById('slicerKategori')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifik')?.value || 'all';

    let filteredData = [...dashboardData];

    if (kategori === 'bm') {
        if (spesifik !== 'all') {
            filteredData = filteredData.filter(item => 
                item.namaBM && item.namaBM.toLowerCase().trim() === spesifik.toLowerCase().trim()
            );
        }
    } else if (kategori === 'abm') {
        if (spesifik !== 'all') {
            filteredData = filteredData.filter(item => 
                item.namaABM && item.namaABM.toLowerCase().trim() === spesifik.toLowerCase().trim()
            );
        }
    }

    renderPodiumTop3(filteredData);
    renderPodiumBottom3(filteredData);
}

/* ==========================================================================
   4. PENGGAMBARAN ELEMEN VISUAL (PODIUM & DIAGRAM BATANG)
   ========================================================================== */
function renderPodiumTop3(data) {
    const container = document.getElementById('podium-top-content');
    if (!container) return;

    let sorted = [...data].sort((a, b) => getSelectedUptValue(b) - getSelectedUptValue(a));
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0, uptAugust: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0, uptAugust: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0, uptAugust: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'top');
}

function renderPodiumBottom3(data) {
    const container = document.getElementById('podium-bottom-content');
    if (!container) return;

    let validData = data.filter(item => getSelectedUptValue(item) > 0);
    if (validData.length === 0) validData = data;

    let sorted = [...validData].sort((a, b) => getSelectedUptValue(a) - getSelectedUptValue(b));
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0, uptAugust: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0, uptAugust: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0, uptAugust: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'bottom');
}

function generatePodiumHTML(p1, p2, p3, type) {
    const isTop = type === 'top';
    const colorClass = isTop 
        ? { bar1: 'from-amber-500 to-amber-400', txt1: 'text-amber-600', badge1: 'from-amber-500 to-orange-500' }
        : { bar1: 'from-rose-500 to-rose-400', txt1: 'text-rose-600', badge1: 'from-rose-500 to-red-600' };

    const iconSvg = isTop 
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-amber-500 animate-bounce" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-rose-500 animate-bounce" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    return `
        <div class="flex items-end justify-center gap-2 sm:gap-4 pt-12 pb-2 max-w-md mx-auto w-full">
            <div class="flex flex-col items-center flex-1 w-0">
                <div class="text-center mb-2 w-full px-0.5">
                    <p class="font-extrabold text-[11px] sm:text-xs text-slate-700 leading-tight min-h-[2rem] flex items-center justify-center break-words content-center">${p2.namaStaff}</p>
                    <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase truncate mt-0.5">${p2.namaStore}</p>
                    <span class="inline-block mt-1 text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${getSelectedUptValue(p2)}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-slate-200 to-slate-100 h-20 rounded-t-2xl border-t-2 border-slate-300 flex items-center justify-center relative shadow-sm">
                    <span class="text-2xl font-black text-slate-400">2</span>
                </div>
            </div>
            <div class="flex flex-col items-center flex-1 transform -translate-y-4 w-0">
                <div class="text-center mb-2 w-full px-0.5">
                    <div class="flex justify-center mb-1">${iconSvg}</div>
                    <p class="font-black text-xs sm:text-sm text-slate-800 leading-tight min-h-[2rem] flex items-center justify-center break-words content-center">${p1.namaStaff}</p>
                    <p class="text-[9px] sm:text-[10px] ${colorClass.txt1} font-extrabold uppercase truncate mt-0.5">${p1.namaStore}</p>
                    <span class="inline-block mt-1 text-xs font-black text-white bg-gradient-to-r ${colorClass.badge1} px-2.5 py-0.5 rounded-lg shadow-sm">${getSelectedUptValue(p1)}</span>
                </div>
                <div class="w-full bg-gradient-to-t ${colorClass.bar1} h-28 rounded-t-2xl border-t-2 border-white/20 flex items-center justify-center relative shadow-md">
                    <span class="text-3xl font-black text-white drop-shadow-sm">1</span>
                </div>
            </div>
            <div class="flex flex-col items-center flex-1 w-0">
                <div class="text-center mb-2 w-full px-0.5">
                    <div class="h-5"></div>
                    <p class="font-extrabold text-[11px] sm:text-xs text-slate-700 leading-tight min-h-[2rem] flex items-center justify-center break-words content-center">${p3.namaStaff}</p>
                    <p class="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase truncate mt-0.5">${p3.namaStore}</p>
                    <span class="inline-block mt-1 text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${getSelectedUptValue(p3)}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-orange-100 to-orange-50/40 h-14 rounded-t-2xl border-t-2 border-orange-200 flex items-center justify-center relative shadow-sm">
                    <span class="text-xl font-black text-orange-400">3</span>
                </div>
            </div>
        </div>
    `;
}

function renderChartPerforma(chartData) {
    const ctx = document.getElementById('bmChart');
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.map(item => item.store),
            datasets: [
                {
                    label: 'MTD UPT',
                    data: chartData.map(item => parseFloat(item.mtdUpt) || 0),
                    backgroundColor: 'rgba(99, 102, 241, 0.85)',
                    borderRadius: 6,
                    borderSkipped: false
                },
                {
                    label: 'Target UPT Lv 1',
                    data: chartData.map(item => parseFloat(item.targetUpt) || 0),
                    backgroundColor: 'rgba(203, 213, 225, 0.85)',
                    borderRadius: 6,
                    borderSkipped: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'top', 
                    labels: { boxWidth: 12, font: { weight: '700', family: "'Plus Jakarta Sans', sans-serif" } } 
                } 
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, weight: '600' } } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}
/* ==========================================================================
   ADD-ON: Ambil UPT (kolom H/I/J) dari sumber Sales dan render tabel UPT di Dashboard
   Letakkan setelah fungsi renderChartPerforma(...) atau di bagian bawah file.
   ========================================================================== */

const SALES_FALLBACK_BASE_URL = typeof SALES_BASE_URL !== 'undefined' ? SALES_BASE_URL : 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';

// Fallback mapping kalau sales-dashboard.js belum didefinisikan di global scope.
// Jika sales-dashboard.js diload terlebih dahulu, window.SHEET_GIDS akan dipakai.
const SALES_GIDS_FALLBACK = {
    'Oct26': '1682478488', 
    'Sep26': '432381843', 
    'Aug26': '1766415704', 
    'Jul26': '1248782513', 
    'Jun26': '511605214', 
    'May26': '2012772985',
    'Apr26': '544207481', 
    'Mar26': '90936589', 
    'Feb26': '472876079',
    'Jan26': '171319040', 
    'Dec25': '236016326', 
    'Nov25': '564328385'
};

// Pemetaan sederhana dari nilai slicer di Dashboard (mis. 'august') ke key sheet yang dipakai sales-dashboard ('Aug26').
const MONTH_SLICER_TO_SALES_KEY = {
    'august': 'Aug26',
    'july': 'Jul26',
    'june': 'Jun26',
    'may': 'May26',
    'april': 'Apr26',
    'march': 'Mar26',
    'february': 'Feb26',
    'january': 'Jan26',
    'december': 'Dec25',
    'november': 'Nov25',
    'october': 'Oct26',
    'september': 'Sep26'
};

function getDefaultSalesMonthKey() {
    // Coba ambil dari slicerBulan jika ada
    const slicer = document.getElementById('slicerBulan');
    if (slicer && slicer.value) {
        const val = slicer.value.toLowerCase();
        if (MONTH_SLICER_TO_SALES_KEY[val]) return MONTH_SLICER_TO_SALES_KEY[val];
        // jika value sudah dalam format seperti 'Aug26', kembalikan langsung
        if (/^[A-Za-z]{3}\d{2}$/.test(slicer.value)) return slicer.value;
    }

    // fallback: bulan saat ini (format: 'Aug26')
    const now = new Date();
    const monthAbbr = now.toLocaleString('en-US', { month: 'short' }); // e.g. "Aug"
    const yy = String(now.getFullYear()).slice(-2); // "26"
    return `${monthAbbr}${yy}`;
}

function parseLineCSVCells(line) {
    // parser CSV sederhana yang aman terhadap koma di dalam quotes
    const cells = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if (ch === ',' && !inQuotes) {
            cells.push(cur.trim());
            cur = '';
            continue;
        }
        cur += ch;
    }
    cells.push(cur.trim());
    return cells.map(c => c.replace(/^"|"$/g, '').trim());
}

async function fetchAndRenderUptSalesTable() {
    const tbody = document.getElementById('upt-sales-table-body');
    if (!tbody) return;

    // Tentukan key bulan sheet sales
    const salesKey = getDefaultSalesMonthKey();

    // Ambil base url & gids dari sales-dashboard (jika tersedia), kalau tidak gunakan fallback
    const baseUrl = (typeof SALES_BASE_URL !== 'undefined') ? SALES_BASE_URL : SALES_FALLBACK_BASE_URL;
    const gidsSource = (typeof SHEET_GIDS !== 'undefined') ? SHEET_GIDS : SALES_GIDS_FALLBACK;

    const gid = gidsSource[salesKey] || gidsSource['Aug26'] || Object.values(gidsSource)[0];
    const finalUrl = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}gid=${gid}&t=${Date.now()}`;

    // Tampilkan placeholder loading di tabel
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-slate-400">Memuat data UPT untuk ${salesKey}...</td></tr>`;

    try {
        const res = await fetch(finalUrl);
        if (!res.ok) throw new Error('Gagal mengambil sumber data sales (HTTP ' + res.status + ')');
        const txt = await res.text();
        const lines = txt.split(/\r?\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data di sheet ini.</td></tr>`;
            return;
        }

        // Jika file punya header di baris pertama, kita mulai dari baris 1 (index 1) untuk data.
        // Kolom yang diminta: B (index 1) = store, H (index 7)=UPT, I (8)=Target, J (9)=%Ach
        const rows = [];
        for (let i = 1; i < lines.length; i++) {
            const cells = parseLineCSVCells(lines[i]);
            // Pastikan ada minimal kolom index 9
            if (cells.length < 2) continue; // minimal store harus ada
            const store = cells[1] || '-';
            // Ambil nilai dari index 7/8/9 jika ada, else 0 / '-'
            const uptRaw = cells[7] || '';
            const targetRaw = cells[8] || '';
            const achRaw = cells[9] || '';

            const parseNum = s => {
                if (!s) return 0;
                const n = parseFloat(String(s).replace(/[^0-9.-]+/g, ''));
                return isNaN(n) ? 0 : n;
            };
            const upt = parseNum(uptRaw);
            const target = parseNum(targetRaw);
            // achievement mungkin sudah persen atau angka; pastikan angka (0-100)
            let ach = parseNum(achRaw);
            if (ach > 100 && target > 0) { // kalau ach disimpan dalam absolute (rare), coba hitung
                ach = target > 0 ? (upt / target) * 100 : 0;
            }

            // Lewati baris tanpa nama toko
            if (!store || store === '-' || store.toLowerCase().includes('store') || store.toLowerCase().includes('nama')) continue;

            rows.push({
                store: store,
                mtdUpt: upt,
                targetUpt: target,
                achPercent: ach
            });
        }

        if (rows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data UPT yang valid di sheet ini.</td></tr>`;
            return;
        }

        // Render tabel di Dashboard UPT (kolom: No, Store, MTD UPT, Target UPT Lv1, %Ach)
        // Urutkan berdasarkan MTD UPT descending
        const sorted = rows.sort((a, b) => (b.mtdUpt || 0) - (a.mtdUpt || 0));
        tbody.innerHTML = sorted.map((r, idx) => `
            <tr class="${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} border-b border-slate-100">
                <td class="px-5 py-4 text-center text-xs font-bold text-slate-400">${idx + 1}</td>
                <td class="px-5 py-4">
                    <p class="font-bold text-sm text-slate-800">${r.store}</p>
                </td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Number(r.mtdUpt || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Number(r.targetUpt || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center text-sm font-black ${ (r.achPercent||0) >= 100 ? 'text-emerald-500' : (r.achPercent||0) >= 80 ? 'text-amber-500' : 'text-rose-500' }">
                    ${(Number(r.achPercent || 0)).toFixed(2)}%
                </td>
            </tr>
        `).join('');

        // Panggil renderChartPerforma dengan data yang cocok (field 'store', 'mtdUpt', 'targetUpt')
        if (typeof renderChartPerforma === 'function') {
            // Batasi jumlah label untuk chart (mis. top 12) agar chart tidak terlalu padat
            const chartData = sorted.slice(0, 12).map(r => ({ store: r.store, mtdUpt: r.mtdUpt, targetUpt: r.targetUpt }));
            renderChartPerforma(chartData);
        }

    } catch (err) {
        console.error('fetchAndRenderUptSalesTable error:', err);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-rose-600">Gagal memuat data UPT: ${err.message}</td></tr>`;
    }
}

// Pastikan fungsi terpanggil saat inisialisasi halaman dan saat slicer bulan berubah.
// fetchDashboardData() sudah memanggil fetchAndRenderUptSalesTable() jika fungsi ditemukan,
// namun untuk jaminan, tambahkan pemanggilan awal (jika dashboard sudah dimuat).
document.addEventListener('DOMContentLoaded', () => {
    // Delay kecil agar elemen slicer sudah di-initialize oleh initSlicers
    setTimeout(() => {
        if (typeof fetchAndRenderUptSalesTable === 'function') fetchAndRenderUptSalesTable();
    }, 300);
});
