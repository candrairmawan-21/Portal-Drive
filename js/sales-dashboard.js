/* ==========================================================================
   1. KONFIGURASI GLOBAL & MAPPING GID SHEETS
   ========================================================================== */
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz0OP_PZzwnj5LJFfus99KyLSqwiD5PFDQK6QX9Br2FTHrEFOM8pMgEXZpsLhd26ZWz/exec";
const SPREADSHEET_ID_OFFICIAL = "1P70howhagUA_H4H0cSXUWB5MjDhCKuOirVLSmh39Z_E";

let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd';
let currentSalesSource = 'SUBMISSION';

// State khusus Official IT Report.
let officialRawData = [];
let officialDataHealth = {
    totalSourceRows: 0,
    validSourceRows: 0,
    selectedMonthRows: 0,
    invalidDateRows: 0,
    invalidStoreRows: 0,
    missingHeaders: []
};

// Data Submission dipakai sebagai sumber Sales LY dan Projection SSSG pada Official IT.
let submissionComparisonData = [];

const SHEET_GIDS = {
    'OFFICIAL_IT_REPORT': '1129267198',
    'OFFICIAL_IT': '1129267198',
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

// Header Official IT. Fallback index mengikuti struktur source saat ini:
// A Store Code, B Store Name, C Date, E Net Sales, F Target, L Qty Sold, M Trx, O BM, P ABM.
const OFFICIAL_HEADERS = {
    storeCode: ['store code', 'store_code', 'kode toko'],
    storeName: ['store name', 'store_name', 'store', 'nama toko'],
    date: ['date', 'tanggal', 'business date', 'transaction date'],
    netSales: ['net sales', 'net_sales', 'sales', 'mtd sales', 'mtd net sales'],
    mtdTarget: ['mtd target', 'target sales', 'target_sales', 'sales target', 'target'],
    qtySold: ['qty sold', 'qty_sold', 'qty', 'quantity', 'quantity sold'],
    trxCount: ['trx count', 'trx_count', 'trx', 'transaction count', 'transactions'],
    bm: ['bm', 'branch manager', 'nama bm', 'branch_manager'],
    abm: ['abm', 'assistant branch manager', 'asst branch manager', 'nama abm', 'assistant_bm']
};

/* ==========================================================================
   2. INITIALIZATION & SOURCE SWITCHER
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    displayUpdateDate();
    initSalesSlicers();
    fetchSalesData();
});

function displayUpdateDate() {
    const dateEl = document.getElementById('update-date');
    if (dateEl) {
        const today = new Date().toLocaleDateString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
        dateEl.innerText = 'Update Terakhir: ' + today;
    }
}

function isOfficialSource_() {
    return currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT';
}

window.switchSalesSource = function(sourceType) {
    currentSalesSource = sourceType;

    const btnSub = document.getElementById('btn-src-submission');
    const btnOff = document.getElementById('btn-src-official');
    const slicerBulan = document.getElementById('slicerBulanSales');

    if (isOfficialSource_()) {
        if (btnOff) btnOff.className = 'px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all';
        if (btnSub) btnSub.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all';
        if (slicerBulan) slicerBulan.disabled = false;
        syncOfficialSlicerState_();
    } else {
        if (btnSub) btnSub.className = 'px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all';
        if (btnOff) btnOff.className = 'px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all';
        if (slicerBulan) slicerBulan.disabled = false;
        syncSubmissionSlicerState_();
    }

    fetchSalesData();
};

function initSalesSlicers() {
    const slicerBulan = document.getElementById('slicerBulanSales');
    const slicerKategori = document.getElementById('slicerKategoriSales');
    const slicerSpesifik = document.getElementById('slicerSpesifikSales');

    if (slicerKategori) {
        slicerKategori.addEventListener('change', () => {
            populateSpecificSlicer_();
            applySalesFilters();
        });
    }

    if (slicerSpesifik) slicerSpesifik.addEventListener('change', applySalesFilters);

    if (slicerBulan) {
        slicerBulan.addEventListener('change', async () => {
            await fetchSalesData();
            if (!isOfficialSource_() && typeof fetchAndRenderUptSalesTable === 'function') {
                fetchAndRenderUptSalesTable();
            }
        });
    }

    syncSubmissionSlicerState_();
}

function syncOfficialSlicerState_() {
    const kategori = document.getElementById('slicerKategoriSales');
    if (!kategori) return;

    // Official IT kini mempunyai BM/ABM pada kolom O/P.
    Array.from(kategori.options).forEach(option => {
        option.disabled = false;
        option.hidden = false;
    });
}

function syncSubmissionSlicerState_() {
    const kategori = document.getElementById('slicerKategoriSales');
    if (!kategori) return;

    Array.from(kategori.options).forEach(option => {
        option.disabled = false;
        option.hidden = false;
    });
}

function populateSpecificSlicer_() {
    const kategori = document.getElementById('slicerKategoriSales');
    const spesifik = document.getElementById('slicerSpesifikSales');
    if (!kategori || !spesifik) return;

    const type = kategori.value || 'all';
    const previous = spesifik.value;
    spesifik.innerHTML = '<option value="all">-- Semua --</option>';

    if (type === 'all') {
        spesifik.disabled = true;
        spesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        return;
    }

    const items = new Map();
    salesData.forEach(item => {
        let key = '';
        let label = '';

        if (type === 'store') {
            key = String(item.storeCode || item.store || '').trim();
            label = String(item.store || key).trim();
        } else if (type === 'bm') {
            key = String(item.bm || '').trim();
            label = key;
        } else if (type === 'abm') {
            key = String(item.abm || '').trim();
            label = key;
        }

        if (key && key !== '-' && label && label !== '-') {
            items.set(key.toLowerCase(), { value: key, label });
        }
    });

    Array.from(items.values())
        .sort((a, b) => a.label.localeCompare(b.label, 'id'))
        .forEach(item => {
            const option = document.createElement('option');
            option.value = item.value;
            option.textContent = type === 'store' && item.value !== item.label
                ? `${item.value} — ${item.label}`
                : item.label;
            spesifik.appendChild(option);
        });

    spesifik.disabled = items.size === 0;
    spesifik.classList.toggle('bg-slate-100', items.size === 0);
    spesifik.classList.toggle('cursor-not-allowed', items.size === 0);

    if (previous && Array.from(spesifik.options).some(o => o.value === previous)) {
        spesifik.value = previous;
    } else {
        spesifik.value = 'all';
    }
}

/* ==========================================================================
   3. DATA FETCHING & SMART PARSER CSV
   ========================================================================== */
async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        const selectedKey = document.getElementById('slicerBulanSales')?.value || 'Aug26';
        const gid = isOfficialSource_()
            ? SHEET_GIDS.OFFICIAL_IT_REPORT
            : (SHEET_GIDS[selectedKey] || '1766415704');

        const url = `${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const csvText = await response.text();
        if (!csvText.trim()) throw new Error('CSV source kosong.');

        if (isOfficialSource_()) {
            salesData = parseOfficialITCSV_(csvText);
            // Sales LY / Projection SSSG berasal dari Store Submission bulan yang sama.
            await fetchSubmissionComparisonData_(selectedKey);
        } else {
            salesData = parseSubmissionCSV_(csvText);
            submissionComparisonData = [...salesData];
        }

        populateSpecificSlicer_();
        applySalesFilters();
    } catch (error) {
        console.error('Error fetching sales data:', error);
        salesData = [];
        officialRawData = [];
        if (isOfficialSource_()) {
            officialDataHealth = {
                totalSourceRows: 0, validSourceRows: 0, selectedMonthRows: 0,
                invalidDateRows: 0, invalidStoreRows: 0, missingHeaders: []
            };
        }
        renderSalesLoadError_(error.message || 'Gagal mengambil data.');
        applySalesFilters();
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function normalizeHeader_(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function parseNumber_(value) {
    if (value === null || value === undefined || value === '') return 0;
    let s = String(value).trim().replace(/[^0-9,.-]/g, '');
    if (!s) return 0;

    if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
            s = s.replace(/\./g, '').replace(',', '.');
        } else {
            s = s.replace(/,/g, '');
        }
    } else if (s.includes(',')) {
        const parts = s.split(',');
        s = (parts.length > 2 || parts[parts.length - 1].length === 3)
            ? s.replace(/,/g, '')
            : s.replace(',', '.');
    } else if (s.includes('.')) {
        const parts = s.split('.');
        if (parts.length > 2 || parts[parts.length - 1].length === 3) s = s.replace(/\./g, '');
    }

    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
}

function parseDate_(value) {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const raw = String(value).trim();

    let m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (m) {
        const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        return d.getFullYear() === Number(m[1]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]) ? d : null;
    }

    m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if (m) {
        const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return d.getFullYear() === Number(m[3]) && d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[1]) ? d : null;
    }

    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function parseCSVLine(textLine) {
    const row = [];
    let inQuotes = false;
    let current = '';

    for (let i = 0; i < textLine.length; i++) {
        const ch = textLine[i];
        const next = textLine[i + 1];

        if (ch === '"' && inQuotes && next === '"') {
            current += '"';
            i++;
        } else if (ch === '"') {
            inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
            row.push(current.trim());
            current = '';
        } else {
            current += ch;
        }
    }

    row.push(current.trim());
    return row.map(v => v.replace(/^"|"$/g, '').trim());
}

function parseCSVRows_(text) {
    // Google Sheets CSV biasanya tidak memiliki embedded newline pada cell,
    // tetapi parser ini tetap menghormati quote saat membentuk logical rows.
    const rows = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const next = text[i + 1];

        if (ch === '"' && inQuotes && next === '"') {
            current += ch + next;
            i++;
        } else if (ch === '"') {
            inQuotes = !inQuotes;
            current += ch;
        } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            if (ch === '\r' && next === '\n') i++;
            if (current.trim()) rows.push(parseCSVLine(current));
            current = '';
        } else {
            current += ch;
        }
    }

    if (current.trim()) rows.push(parseCSVLine(current));
    return rows;
}

function headerIndex_(headers, aliases) {
    const normalized = headers.map(normalizeHeader_);
    for (const alias of aliases) {
        const idx = normalized.indexOf(normalizeHeader_(alias));
        if (idx !== -1) return idx;
    }
    return -1;
}

function getField_(row, headers, aliases, fallbackIndex, options = {}) {
    const idx = headerIndex_(headers, aliases);
    if (idx !== -1 && row[idx] !== undefined) return row[idx];
    if (options.allowFallback !== false && fallbackIndex !== undefined && row[fallbackIndex] !== undefined) {
        return row[fallbackIndex];
    }
    return '';
}

function selectedMonthInfo_() {
    const key = document.getElementById('slicerBulanSales')?.value || 'Aug26';
    const monthMap = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const month = monthMap[key.substring(0, 3)];
    const year = Number(`20${key.substring(3)}`);
    return { key, month, year };
}

function parseOfficialITCSV_(text) {
    const rows = parseCSVRows_(text);
    if (rows.length < 2) return [];

    const headers = rows[0];
    const selected = selectedMonthInfo_();
    const idx = {
        storeCode: headerIndex_(headers, OFFICIAL_HEADERS.storeCode),
        storeName: headerIndex_(headers, OFFICIAL_HEADERS.storeName),
        date: headerIndex_(headers, OFFICIAL_HEADERS.date),
        netSales: headerIndex_(headers, OFFICIAL_HEADERS.netSales),
        mtdTarget: headerIndex_(headers, OFFICIAL_HEADERS.mtdTarget),
        qtySold: headerIndex_(headers, OFFICIAL_HEADERS.qtySold),
        trxCount: headerIndex_(headers, OFFICIAL_HEADERS.trxCount),
        bm: headerIndex_(headers, OFFICIAL_HEADERS.bm),
        abm: headerIndex_(headers, OFFICIAL_HEADERS.abm)
    };

    // Posisi fallback untuk struktur Official IT yang saat ini dipakai.
    const fallback = { storeCode: 0, storeName: 1, date: 2, netSales: 4, mtdTarget: 5, qtySold: 11, trxCount: 12, bm: 14, abm: 15 };
    const missingHeaders = [];
    Object.keys(idx).forEach(key => {
        if (idx[key] === -1 && fallback[key] === undefined) missingHeaders.push(key);
    });

    officialDataHealth = {
        totalSourceRows: 0, validSourceRows: 0, selectedMonthRows: 0,
        invalidDateRows: 0, invalidStoreRows: 0, missingHeaders
    };

    if (missingHeaders.length) {
        officialRawData = [];
        return [];
    }

    const map = new Map();
    officialRawData = [];

    for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row.some(v => String(v || '').trim() !== '')) continue;
        officialDataHealth.totalSourceRows++;

        const rawDate = getField_(row, headers, OFFICIAL_HEADERS.date, fallback.date);
        const date = parseDate_(rawDate);
        if (!date) {
            officialDataHealth.invalidDateRows++;
            continue;
        }

        const storeCode = String(getField_(row, headers, OFFICIAL_HEADERS.storeCode, fallback.storeCode) || '').trim().toUpperCase().replace(/\s+/g, '');
        const storeName = String(getField_(row, headers, OFFICIAL_HEADERS.storeName, fallback.storeName) || '').trim().replace(/\s+/g, ' ');
        if (!storeCode && !storeName) {
            officialDataHealth.invalidStoreRows++;
            continue;
        }

        const netSales = parseNumber_(getField_(row, headers, OFFICIAL_HEADERS.netSales, fallback.netSales));
        const mtdTarget = parseNumber_(getField_(row, headers, OFFICIAL_HEADERS.mtdTarget, fallback.mtdTarget));
        const qtySold = parseNumber_(getField_(row, headers, OFFICIAL_HEADERS.qtySold, fallback.qtySold));
        const trxCount = parseNumber_(getField_(row, headers, OFFICIAL_HEADERS.trxCount, fallback.trxCount));
        const bm = String(getField_(row, headers, OFFICIAL_HEADERS.bm, fallback.bm) || '').trim();
        const abm = String(getField_(row, headers, OFFICIAL_HEADERS.abm, fallback.abm) || '').trim();

        officialDataHealth.validSourceRows++;

        officialRawData.push({
            storeCode: storeCode || storeName, store: storeName || storeCode, date,
            netSales, mtdTarget, qtySold, trxCount, bm: bm || '-', abm: abm || '-'
        });

        if (date.getMonth() !== selected.month || date.getFullYear() !== selected.year) continue;
        officialDataHealth.selectedMonthRows++;

        const key = storeCode || storeName.toUpperCase();
        if (!map.has(key)) {
            map.set(key, {
                storeCode: storeCode || storeName, store: storeName || storeCode,
                bm: bm || '-', abm: abm || '-',
                mtdSales: 0, mtdTarget: 0, qtySold: 0, trxCount: 0,
                achPercent: 0, salesLY: 0, sssg: 0, projSssg: 0
            });
        }

        const item = map.get(key);
        if (storeName) item.store = storeName;
        if (bm && bm !== '-') item.bm = bm;
        if (abm && abm !== '-') item.abm = abm;
        item.mtdSales += netSales;
        item.mtdTarget += mtdTarget;
        item.qtySold += qtySold;
        item.trxCount += trxCount;
    }

    return Array.from(map.values()).map(item => {
        item.achPercent = item.mtdTarget > 0 ? (item.mtdSales / item.mtdTarget) * 100 : 0;
        item.atv = item.trxCount > 0 ? item.mtdSales / item.trxCount : 0;
        item.upt = item.trxCount > 0 ? item.qtySold / item.trxCount : 0;
        return item;
    });
}

function parseSubmissionCSV_(text) {
    const rows = parseCSVRows_(text);
    if (rows.length < 2) return [];

    // Submission lama menggunakan row ke-3 sebagai header.
    const headerRowIdx = rows.length > 2 ? 2 : 0;
    const headers = rows[headerRowIdx];
    const result = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row.some(v => String(v || '').trim() !== '')) continue;

        const store = String(getField_(row, headers, ['store name', 'store_name', 'store', 'nama toko'], 1) || '').trim();
        if (!store || store === '-') continue;

        const sales = parseNumber_(getField_(row, headers, ['net sales', 'net_sales', 'mtd sales', 'sales mtd'], 4));
        const target = parseNumber_(getField_(row, headers, ['target sales', 'target_sales', 'mtd target', 'target'], 5));
        let ach = parseNumber_(getField_(row, headers, ['achievement', 'ach percent', '% ach', 'ach'], 17));
        if (ach === 0 && target > 0) ach = (sales / target) * 100;

        result.push({
            storeCode: String(getField_(row, headers, ['store code', 'store_code', 'kode toko'], 0) || '').trim(),
            store,
            bm: String(getField_(row, headers, ['nama bm', 'bm', 'branch manager'], 2) || '-').trim(),
            abm: String(getField_(row, headers, ['nama abm', 'abm', 'asst branch manager'], 3) || '-').trim(),
            mtdSales: sales, mtdTarget: target, achPercent: ach,
            bestEstimate: String(getField_(row, headers, ['best estimate', 'best_estimate', 'estimate'], 16) || '-').trim(),
            salesLY: parseNumber_(getField_(row, headers, ['sales ly', 'ly sales', 'ly'], 18)),
            sssg: parseNumber_(getField_(row, headers, ['sssg', 'ach sssg'], 20)),
            projSssg: parseNumber_(getField_(row, headers, ['projection sssg', 'proj sssg', 'projection'], 21))
        });
    }

    return result;
}

async function fetchSubmissionComparisonData_(selectedKey) {
    try {
        const gid = SHEET_GIDS[selectedKey];
        if (!gid) { submissionComparisonData = []; return; }
        const response = await fetch(`${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        submissionComparisonData = parseSubmissionCSV_(await response.text());
    } catch (error) {
        console.warn('Sales LY / Projection SSSG Submission tidak dapat dimuat:', error);
        submissionComparisonData = [];
    }
}

function parseSalesCSV(text, sourceMode) {
    return sourceMode === 'OFFICIAL_IT' || sourceMode === 'OFFICIAL_IT_REPORT'
        ? parseOfficialITCSV_(text)
        : parseSubmissionCSV_(text);
}

/* ==========================================================================
   4. SYSTEM FILTERING SALES
   ========================================================================== */
function applySalesFilters() {
    const kategori = document.getElementById('slicerKategoriSales')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifikSales')?.value || 'all';
    let filtered = [...salesData];

    if (kategori !== 'all' && spesifik !== 'all') {
        const selected = String(spesifik).toLowerCase();
        filtered = salesData.filter(item => {
            if (kategori === 'store') return String(item.storeCode || item.store || '').toLowerCase() === selected || String(item.store || '').toLowerCase() === selected;
            if (kategori === 'bm') return String(item.bm || '').toLowerCase() === selected;
            if (kategori === 'abm') return String(item.abm || '').toLowerCase() === selected;
            return true;
        });
    }

    if (isOfficialSource_()) {
        renderOfficialDashboard_(filtered);
    } else {
        renderSalesSummaryFiltered(filtered);
        renderSalesTableFiltered(filtered);
        if (currentSalesChartMode === 'mtd') renderSalesChartFiltered(filtered);
        else fetchAndRenderTrendChart(kategori, spesifik);
    }
}

window.setSalesChartMode = function(mode) {
    currentSalesChartMode = mode === 'trend' ? 'trend' : 'mtd';
    const btnMtd = document.getElementById('btnModeMtd');
    const btnTrend = document.getElementById('btnModeTrend');

    if (currentSalesChartMode === 'mtd') {
        if (btnMtd) btnMtd.className = 'px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all';
        if (btnTrend) btnTrend.className = 'px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all';
    } else {
        if (btnTrend) btnTrend.className = 'px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all';
        if (btnMtd) btnMtd.className = 'px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all';
    }
    applySalesFilters();
};

/* ==========================================================================
   5. SUMMARY METRICS & CARDS
   ========================================================================== */
function findSubmissionForOfficial_(item) {
    const code = String(item.storeCode || '').trim().toLowerCase();
    const name = String(item.store || '').trim().toLowerCase();
    return submissionComparisonData.find(s => {
        const sCode = String(s.storeCode || '').trim().toLowerCase();
        const sName = String(s.store || '').trim().toLowerCase();
        return (code && sCode && code === sCode) || (name && sName && name === sName);
    }) || null;
}

function getOfficialComparison_(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0;
    let weightedProjNumerator = 0, weightedProjDenominator = 0;

    data.forEach(item => {
        totalSales += item.mtdSales || 0;
        totalTarget += item.mtdTarget || 0;

        const submission = findSubmissionForOfficial_(item);
        if (submission) {
            const ly = submission.salesLY || 0;
            totalLY += ly;
            if (ly > 0 && Number.isFinite(submission.projSssg)) {
                weightedProjNumerator += submission.projSssg * ly;
                weightedProjDenominator += ly;
            }
        }
    });

    const achievement = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    const achSssg = totalLY > 0 ? ((totalSales - totalLY) / totalLY) * 100 : 0;
    const projSssg = weightedProjDenominator > 0
        ? weightedProjNumerator / weightedProjDenominator
        : 0;

    return { totalSales, totalTarget, totalLY, achievement, achSssg, projSssg };
}

function setSummaryValue_(id, value, className) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerText = value;
    if (className) el.className = className;
}

function updateSummaryLabel_(valueId, labels) {
    const valueEl = document.getElementById(valueId);
    if (!valueEl) return;
    const card = valueEl.closest('.rounded-2xl, .rounded-xl, .bg-white') || valueEl.parentElement;
    if (!card) return;
    const elements = card.querySelectorAll('p,span,div,h1,h2,h3,h4,h5,h6');
    for (const el of elements) {
        if (el === valueEl) continue;
        const text = String(el.textContent || '').trim();
        if (labels.some(label => text === label)) return;
    }
}

function renderOfficialSummary_(data) {
    const kpi = getOfficialComparison_(data);

    setSummaryValue_('summary-total-sales', `Rp ${Math.round(kpi.totalSales).toLocaleString('id-ID')}`, 'text-xl font-black text-slate-800');
    setSummaryValue_('summary-total-target', `Rp ${Math.round(kpi.totalTarget).toLocaleString('id-ID')}`, 'text-xl font-black text-slate-800');
    setSummaryValue_('summary-avg-ach', `${kpi.achievement.toFixed(1)}%`, kpi.achievement >= 100 ? 'text-xl font-black text-emerald-500' : 'text-xl font-black text-orange-500');
    setSummaryValue_('summary-total-ly', `Rp ${Math.round(kpi.totalLY).toLocaleString('id-ID')}`, 'text-xl font-black text-slate-800');
    setSummaryValue_('summary-sssg', `${kpi.achSssg.toFixed(2)}%`, kpi.achSssg >= 0 ? 'text-xl font-black text-emerald-500' : 'text-xl font-black text-rose-500');
    setSummaryValue_('summary-proj-sssg', `${kpi.projSssg.toFixed(2)}%`, kpi.projSssg >= 0 ? 'text-xl font-black text-cyan-600' : 'text-xl font-black text-rose-500');

    renderOfficialRankingCards_(data);
    renderOfficialDataHealth_();
}

function renderSalesSummaryFiltered(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0, totalSSSG = 0, totalProjSSSG = 0;
    data.forEach(item => {
        totalSales += item.mtdSales || 0;
        totalTarget += item.mtdTarget || 0;
        totalLY += item.salesLY || 0;
        totalSSSG += item.sssg || 0;
        totalProjSSSG += item.projSssg || 0;
    });
    const count = data.length;
    const avgAch = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    const avgSSSG = count ? totalSSSG / count : 0;
    const avgProjSSSG = count ? totalProjSSSG / count : 0;

    setSummaryValue_('summary-total-sales', `Rp ${Math.round(totalSales).toLocaleString('id-ID')}`);
    setSummaryValue_('summary-total-target', `Rp ${Math.round(totalTarget).toLocaleString('id-ID')}`);
    setSummaryValue_('summary-avg-ach', `${avgAch.toFixed(1)}%`);
    setSummaryValue_('summary-total-ly', `Rp ${Math.round(totalLY).toLocaleString('id-ID')}`);
    setSummaryValue_('summary-sssg', `${avgSSSG.toFixed(2)}%`, avgSSSG >= 0 ? 'text-xl font-black text-emerald-500' : 'text-xl font-black text-rose-500');
    setSummaryValue_('summary-proj-sssg', `${avgProjSSSG.toFixed(2)}%`, avgProjSSSG >= 0 ? 'text-xl font-black text-amber-500' : 'text-xl font-black text-rose-500');
}

/* ==========================================================================
   5A. OFFICIAL IT RANKING CARDS
   ========================================================================== */
function aggregateManagerRanking_(data, field) {
    const map = new Map();
    data.forEach(item => {
        const name = String(item[field] || '').trim();
        if (!name || name === '-') return;
        if (!map.has(name)) map.set(name, { name, sales: 0, target: 0, stores: 0 });
        const x = map.get(name);
        x.sales += item.mtdSales || 0;
        x.target += item.mtdTarget || 0;
        x.stores++;
    });
    return Array.from(map.values())
        .map(x => ({ ...x, achievement: x.target > 0 ? (x.sales / x.target) * 100 : 0 }))
        .sort((a, b) => b.achievement - a.achievement);
}

function ensureOfficialRankingPanel_() {
    let panel = document.getElementById('official-manager-ranking-panel');
    if (panel) return panel;

    const anchor = document.getElementById('summary-proj-sssg');
    if (!anchor) return null;
    const card = anchor.closest('.grid') || anchor.closest('.flex') || anchor.parentElement?.parentElement?.parentElement;
    if (!card || !card.parentElement) return null;

    panel = document.createElement('div');
    panel.id = 'official-manager-ranking-panel';
    panel.className = 'mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4';
    card.parentElement.insertBefore(panel, card.nextSibling);
    return panel;
}

function managerRankingHtml_(title, data, accentClass) {
    if (!data.length) {
        return `<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div class="flex items-center justify-between mb-3"><div class="font-black text-slate-800">${title}</div><span class="text-[10px] font-bold text-slate-400">No data</span></div><div class="text-xs text-slate-400 py-3">Belum ada mapping ${title} pada data Official IT.</div></div>`;
    }

    const rows = data.slice(0, 5).map((x, i) => {
        const badge = i === 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500';
        const achClass = x.achievement >= 100 ? 'text-emerald-600' : 'text-orange-600';
        return `<div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
            <span class="w-7 h-7 rounded-lg ${badge} flex items-center justify-center text-xs font-black">${i + 1}</span>
            <div class="min-w-0 flex-1"><div class="text-xs font-black text-slate-700 truncate">${escapeHtml_(x.name)}</div><div class="text-[9px] font-semibold text-slate-400">${x.stores} store • Sales Rp ${formatCompact_(x.sales)} / Target Rp ${formatCompact_(x.target)}</div></div>
            <div class="text-sm font-black ${achClass}">${x.achievement.toFixed(1)}%</div>
        </div>`;
    }).join('');

    return `<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div class="flex items-center justify-between mb-2"><div class="font-black text-slate-800">${title}</div><span class="text-[10px] font-black ${accentClass} uppercase tracking-wider">Top 5</span></div>${rows}
    </div>`;
}

function renderOfficialRankingCards_(data) {
    const panel = ensureOfficialRankingPanel_();
    if (!panel) return;
    const bm = aggregateManagerRanking_(data, 'bm');
    const abm = aggregateManagerRanking_(data, 'abm');
    panel.innerHTML = managerRankingHtml_('Ranking BM', bm, 'text-cyan-600') + managerRankingHtml_('Ranking ABM', abm, 'text-violet-600');
}

/* ==========================================================================
   6. GRAFIK
   ========================================================================== */
function formatCompact_(value) {
    const n = Number(value || 0);
    const abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1).replace('.0', '') + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(1).replace('.0', '') + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1).replace('.0', '') + 'K';
    return Math.round(n).toLocaleString('id-ID');
}

function renderOfficialChart_(data) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();

    const sorted = [...data].sort((a, b) => (b.achPercent || 0) - (a.achPercent || 0));
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(item => item.store),
            datasets: [
                { type: 'line', label: 'Achievement (%)', data: sorted.map(item => item.achPercent || 0), backgroundColor: '#06b6d4', borderColor: '#0891b2', borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderColor: '#0891b2', pointBorderWidth: 2, fill: false, tension: .35, yAxisID: 'y1' },
                { type: 'bar', label: 'MTD Target', data: sorted.map(item => item.mtdTarget || 0), backgroundColor: 'rgba(139,92,246,.78)', borderColor: '#7c3aed', borderWidth: 1, borderRadius: 6, yAxisID: 'y' },
                { type: 'bar', label: 'MTD Sales', data: sorted.map(item => item.mtdSales || 0), backgroundColor: 'rgba(6,182,212,.88)', borderColor: '#0891b2', borderWidth: 1, borderRadius: 6, yAxisID: 'y' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 38 } },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false }, ticks: { maxRotation: 55, minRotation: 35, autoSkip: false } },
                y: { beginAtZero: true, ticks: { callback: value => 'Rp ' + formatCompact_(value) } },
                y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: value => value + '%' } }
            },
            plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: c => c.dataset.label === 'Achievement (%)' ? `${c.dataset.label}: ${Number(c.raw || 0).toFixed(1)}%` : `${c.dataset.label}: Rp ${Math.round(c.raw || 0).toLocaleString('id-ID')}` } } }
        },
        plugins: [{
            id: 'officialAchievementLabels',
            afterDatasetsDraw: chart => {
                const chartCtx = chart.ctx;
                const dataset = chart.data.datasets[0];
                const meta = chart.getDatasetMeta(0);
                if (meta.hidden) return;
                meta.data.forEach((element, index) => {
                    chartCtx.save();
                    chartCtx.fillStyle = '#0e7490';
                    chartCtx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                    chartCtx.textAlign = 'center';
                    chartCtx.textBaseline = 'bottom';
                    chartCtx.fillText(Number(dataset.data[index] || 0).toFixed(1) + '%', element.x, element.y - 7);
                    chartCtx.restore();
                });
            }
        }]
    });
}

function renderSalesChartFiltered(data) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.store),
            datasets: [
                { type: 'line', label: 'Achievement (%)', data: data.map(item => item.achPercent || 0), backgroundColor: '#6366f1', borderColor: '#6366f1', borderWidth: 2.5, pointRadius: 5, pointBackgroundColor: '#fff', pointBorderColor: '#6366f1', pointBorderWidth: 2, fill: false, tension: .35, yAxisID: 'y1' },
                { type: 'bar', label: 'MTD Target', data: data.map(item => item.mtdTarget || 0), backgroundColor: 'rgba(244,63,94,.85)', borderColor: '#f43f5e', borderWidth: 1, borderRadius: 6, yAxisID: 'y' },
                { type: 'bar', label: 'MTD Sales', data: data.map(item => item.mtdSales || 0), backgroundColor: 'rgba(249,115,22,.9)', borderColor: '#f97316', borderWidth: 1, borderRadius: 6, yAxisID: 'y' }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 40 } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true }, y1: { display: false, beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderOfficialTrendChart_(data) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();

    const selected = selectedMonthInfo_();
    const allowed = new Set(data.map(item => item.storeCode || item.store));
    const daily = new Map();

    officialRawData.forEach(row => {
        if (row.date.getMonth() !== selected.month || row.date.getFullYear() !== selected.year) return;
        if (allowed.size === 0 || !allowed.has(row.storeCode)) return;
        const day = row.date.getDate();
        if (!daily.has(day)) daily.set(day, { sales: 0, target: 0 });
        daily.get(day).sales += row.netSales || 0;
        daily.get(day).target += row.mtdTarget || 0;
    });

    const days = new Date(selected.year, selected.month + 1, 0).getDate();
    const labels = [], sales = [], target = [], ach = [];
    let runningSales = 0, runningTarget = 0;

    for (let d = 1; d <= days; d++) {
        const x = daily.get(d) || { sales: 0, target: 0 };
        runningSales += x.sales;
        runningTarget += x.target;
        labels.push(String(d));
        sales.push(runningSales);
        target.push(runningTarget);
        ach.push(runningTarget > 0 ? runningSales / runningTarget * 100 : 0);
    }

    salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets: [
            { label: 'Cumulative MTD Sales', data: sales, borderColor: '#0891b2', backgroundColor: 'rgba(6,182,212,.10)', borderWidth: 3, pointRadius: 3, fill: true, tension: .3, yAxisID: 'y' },
            { label: 'Cumulative MTD Target', data: target, borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,.05)', borderWidth: 2.5, pointRadius: 3, fill: false, tension: .3, yAxisID: 'y' },
            { label: 'Achievement (%)', data: ach, borderColor: '#f59e0b', backgroundColor: '#f59e0b', borderWidth: 2.5, pointRadius: 3, fill: false, tension: .3, yAxisID: 'y1' }
        ] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, scales: { x: { grid: { display: false }, title: { display: true, text: 'Tanggal' } }, y: { beginAtZero: true, ticks: { callback: value => 'Rp ' + formatCompact_(value) } }, y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false }, ticks: { callback: value => value + '%' } } }, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderOfficialDashboard_(data) {
    renderOfficialSummary_(data);
    renderOfficialTable_(data);
    if (currentSalesChartMode === 'mtd') renderOfficialChart_(data);
    else renderOfficialTrendChart_(data);
}

async function fetchAndRenderTrendChart(kategori, spesifik) {
    // Submission trend lama dipertahankan.
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');
    try {
        const monthKeys = ['Oct26', 'Sep26', 'Aug26', 'Jul26', 'Jun26', 'May26'].reverse();
        const validData = (await Promise.all(monthKeys.map(async mKey => {
            const gid = SHEET_GIDS[mKey];
            if (!gid) return null;
            try {
                const res = await fetch(`${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return null;
                const parsed = parseSubmissionCSV_(await res.text());
                let s = 0, t = 0;
                parsed.forEach(i => { s += i.mtdSales || 0; t += i.mtdTarget || 0; });
                return { month: mKey, achPercent: t > 0 ? s / t * 100 : 0 };
            } catch { return null; }
        }))).filter(Boolean);

        const ctx = document.getElementById('salesTargetChart');
        if (!ctx) return;
        if (salesChartInstance) salesChartInstance.destroy();
        salesChartInstance = new Chart(ctx, { type: 'line', data: { labels: validData.map(x => x.month), datasets: [{ label: 'Trend Achievement (%)', data: validData.map(x => x.achPercent), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.1)', borderWidth: 3, pointRadius: 5, fill: true, tension: .3 }] }, options: { responsive: true, maintainAspectRatio: false, layout: { padding: { top: 37 } }, plugins: { legend: { position: 'bottom' } } } });
    } finally { if (loader) loader.classList.add('hidden'); }
}

/* ==========================================================================
   7. TABEL SALES STORE
   ========================================================================== */
function escapeHtml_(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderOfficialTable_(data) {
    const tbody = document.getElementById('sales-table-body');
    const countLabel = document.getElementById('table-record-count');
    if (countLabel) countLabel.textContent = `Menampilkan ${data.length} Toko`;
    if (!tbody) return;

    const thead = tbody.previousElementSibling;
    if (thead) thead.innerHTML = `<tr>
        <th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th>
        <th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Sales</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Target</th>
        <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ach %</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Qty</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Trx</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">ATV / UPT</th>
    </tr>`;

    if (!data.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-sm font-bold text-slate-400">Tidak ada data Official IT untuk bulan/filter yang dipilih.</td></tr>`;
        return;
    }

    const sorted = [...data].sort((a, b) => (b.achPercent || 0) - (a.achPercent || 0));
    tbody.innerHTML = sorted.map((item, index) => {
        const ach = item.achPercent || 0;
        const badge = ach >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ach >= 80 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200';
        return `<tr class="${index % 2 ? 'bg-slate-50/60' : 'bg-white'} border-b border-slate-100 hover:bg-cyan-50/40 transition-colors">
            <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
            <td class="px-5 py-4"><p class="font-bold text-sm text-slate-800">${escapeHtml_(item.store)}</p><p class="text-[10px] font-bold text-slate-400 uppercase">${escapeHtml_(item.storeCode || '-')}</p></td>
            <td class="px-5 py-4 text-right text-sm font-bold text-slate-700">Rp ${Math.round(item.mtdSales || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Math.round(item.mtdTarget || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center"><span class="px-3 py-1.5 rounded-xl text-[11px] font-black border ${badge}">${ach.toFixed(2)}%</span></td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${Math.round(item.qtySold || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${Math.round(item.trxCount || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right"><p class="text-xs font-bold text-cyan-600">Rp ${Math.round(item.atv || 0).toLocaleString('id-ID')}</p><p class="text-[11px] font-semibold text-violet-500">UPT: ${Number(item.upt || 0).toFixed(2)}</p></td>
        </tr>`;
    }).join('');
}

function renderSalesTableFiltered(data) {
    const tbody = document.getElementById('sales-table-body');
    const countLabel = document.getElementById('table-record-count');
    if (countLabel) countLabel.textContent = `Menampilkan ${data.length} Toko`;
    if (!tbody) return;
    const thead = tbody.previousElementSibling;
    if (thead) thead.innerHTML = `<tr><th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th><th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Sales</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Target</th><th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Est.</th><th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ach %</th></tr>`;
    if (!data.length) { tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`; return; }
    const sorted = [...data].sort((a, b) => (b.achPercent || 0) - (a.achPercent || 0));
    tbody.innerHTML = sorted.map((item, index) => {
        const ach = item.achPercent || 0;
        const badge = ach >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : ach >= 80 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200';
        return `<tr class="${index % 2 ? 'bg-slate-50/60' : 'bg-white'} border-b border-slate-100 hover:bg-amber-50/30 transition-colors"><td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td><td class="px-5 py-4"><p class="font-bold text-sm text-slate-800">${escapeHtml_(item.store)}</p><p class="text-[10px] font-bold text-slate-400 uppercase">${escapeHtml_(item.storeCode || '-')}</p></td><td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Math.round(item.mtdSales || 0).toLocaleString('id-ID')}</td><td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Math.round(item.mtdTarget || 0).toLocaleString('id-ID')}</td><td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${escapeHtml_(item.bestEstimate || '-')}</td><td class="px-5 py-4 text-center"><span class="px-3 py-1.5 rounded-xl text-[11px] font-black border ${badge}">${ach.toFixed(2)}%</span></td></tr>`;
    }).join('');
}

function renderOfficialDataHealth_() {
    let node = document.getElementById('official-it-data-health');
    const count = document.getElementById('table-record-count');
    if (!node && count?.parentElement) {
        node = document.createElement('div');
        node.id = 'official-it-data-health';
        node.className = 'mt-2 text-[10px] font-semibold';
        count.parentElement.appendChild(node);
    }
    if (!node) return;

    const h = officialDataHealth;
    if (h.missingHeaders.length) {
        node.className = 'mt-2 text-[10px] font-bold text-rose-500';
        node.textContent = `Format Official IT tidak sesuai. Header tidak ditemukan: ${h.missingHeaders.join(', ')}.`;
    } else if (h.invalidDateRows || h.invalidStoreRows) {
        node.className = 'mt-2 text-[10px] font-semibold text-amber-500';
        node.textContent = `Audit: ${h.selectedMonthRows} row bulan terpilih • ${h.validSourceRows}/${h.totalSourceRows} row valid • ${h.invalidDateRows} tanggal invalid • ${h.invalidStoreRows} store invalid.`;
    } else {
        node.className = 'mt-2 text-[10px] font-semibold text-slate-400';
        node.textContent = `Audit: ${h.selectedMonthRows} row bulan terpilih • ${h.validSourceRows}/${h.totalSourceRows} row source valid.`;
    }
}

function renderSalesLoadError_(message) {
    if (salesChartInstance) { salesChartInstance.destroy(); salesChartInstance = null; }
    const tbody = document.getElementById('sales-table-body');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-sm font-bold text-rose-500">${escapeHtml_(message)}</td></tr>`;
    const count = document.getElementById('table-record-count');
    if (count) count.textContent = 'Data gagal dimuat';
    ['summary-total-sales','summary-total-target','summary-avg-ach','summary-total-ly','summary-sssg','summary-proj-sssg'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '-';
    });
}

/* ==========================================================================
   8. MODAL HANDLER & UPLOAD PDF OFFICIAL IT REPORT
   ========================================================================== */
window.openUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.remove('hidden');
    
    const input = document.getElementById('officialPdfInput');
    if (input) input.value = '';
    
    const display = document.getElementById('pdfFileNameDisplay');
    if (display) display.textContent = "Klik atau seret file .PDF laporan ke sini";
    
    const progContainer = document.getElementById('uploadProgressContainer');
    if (progContainer) progContainer.classList.add('hidden');
    
    const statusBox = document.getElementById('pdfUploadStatus');
    if (statusBox) statusBox.classList.add('hidden');
    
    const btnSubmit = document.getElementById('btnSubmitPdf');
    if (btnSubmit) btnSubmit.disabled = false;
    
    const btnText = document.getElementById('btnSubmitText');
    if (btnText) btnText.textContent = "Proses Upload";

    const dateInput = document.getElementById('officialReportDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.add('hidden');
};

window.previewPdfSelection = function(input) {
    const display = document.getElementById('pdfFileNameDisplay');
    if (input.files && input.files[0] && display) {
        display.textContent = `📄 File terpilih: ${input.files[0].name}`;
    } else if (display) {
        display.textContent = "Klik atau seret file .PDF laporan ke sini";
    }
};

/**
 * Helper: Membaca file PDF dan mengonversinya ke format Data URL (Base64)
 * agar backend Google Apps Script dapat melakukan parsing, konversi,
 * lookup ke sheet DATA_STORE berdasarkan Store Code (Kolom A), 
 * dan menyimpan hasilnya ke Google Sheet Master.
 */
function readFileAsDataURL_(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Gagal membaca file dari perangkat."));
        reader.readAsDataURL(file);
    });
}

/* ==========================================================================
   8b. PEMECAH PDF OTOMATIS UNTUK LAPORAN BESAR (mis. rekap bulanan)
   --------------------------------------------------------------------------
   Backend membaca teks PDF lewat konversi ke Google Docs, yang punya batas
   keras ~1 juta karakter per dokumen. PDF laporan harian (±50 halaman)
   jauh di bawah itu, tapi PDF bulanan bisa 1000+ halaman dan berjuta-juta
   karakter -> konversi gagal/kepotong diam-diam kalau dikirim utuh.
   Solusinya: PDF dipecah di sini (browser) jadi beberapa bagian berukuran
   aman pakai pdf-lib (pustaka PDF yang sudah teruji luas), lalu setiap
   bagian diunggah berurutan ke endpoint yang sama seperti biasa. Backend
   punya pengecekan anti-duplikat (Store Code + Tanggal), jadi proses ini
   aman diulang kalau salah satu bagian gagal di tengah jalan.
   ========================================================================== */
const PDF_CHUNK_MAX_PAGES = 150; // ≈770rb karakter/chunk, aman di bawah batas ~1 juta Google Docs

function loadPdfLibScript_() {
    return new Promise((resolve, reject) => {
        if (window.PDFLib) return resolve(window.PDFLib);
        const existing = document.querySelector('script[data-pdf-lib]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.PDFLib));
            existing.addEventListener('error', () => reject(new Error("Gagal memuat pustaka pemecah PDF (pdf-lib).")));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        script.dataset.pdfLib = "true";
        script.onload = () => resolve(window.PDFLib);
        script.onerror = () => reject(new Error("Gagal memuat pustaka pemecah PDF (pdf-lib). Periksa koneksi internet."));
        document.head.appendChild(script);
    });
}

/**
 * Cek jumlah halaman PDF; kalau melebihi PDF_CHUNK_MAX_PAGES, pecah jadi
 * beberapa PDF terpisah (masing-masing maks PDF_CHUNK_MAX_PAGES halaman).
 * Kalau file cukup kecil, `chunks` dikembalikan null (tidak perlu dipecah,
 * upload berjalan seperti biasa 1x request).
 */
async function splitPdfIntoChunks_(file) {
    const { PDFDocument } = await loadPdfLibScript_();
    const arrayBuffer = await file.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
    const totalPages = srcDoc.getPageCount();

    if (totalPages <= PDF_CHUNK_MAX_PAGES) {
        return { totalPages, chunks: null };
    }

    const chunks = [];
    const numChunks = Math.ceil(totalPages / PDF_CHUNK_MAX_PAGES);
    for (let i = 0; i < numChunks; i++) {
        const startPage = i * PDF_CHUNK_MAX_PAGES;
        const endPage = Math.min(startPage + PDF_CHUNK_MAX_PAGES, totalPages);
        const pageIndices = [];
        for (let p = startPage; p < endPage; p++) pageIndices.push(p);

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(pg => newDoc.addPage(pg));
        const bytes = await newDoc.save();

        chunks.push({ index: i + 1, total: numChunks, startPage: startPage + 1, endPage, bytes });
    }
    return { totalPages, chunks };
}

/** Konversi Uint8Array (hasil pdf-lib) jadi Data URL base64, batch per 32KB
 *  supaya tidak overflow call stack untuk file yang cukup besar. */
function pdfBytesToDataURL_(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return `data:application/pdf;base64,${btoa(binary)}`;
}

/** Kirim satu payload PDF (utuh atau 1 chunk) ke backend dan validasi hasilnya. */
async function uploadPdfPayload_(fileName, dataUrl, reportDate, extraMeta) {
    const payload = Object.assign({
        action: "UPLOAD_PDF_OFFICIAL",
        fileName,
        fileData: dataUrl,
        reportDate,
        gidDataStore: "1124553459",
        gidOfficialReport: "1129267198"
    }, extraMeta || {});

    const response = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Server merespons dengan status HTTP ${response.status}. Periksa deployment Web App GAS.`);
    }

    const rawText = await response.text();
    let result;
    try {
        result = JSON.parse(rawText);
    } catch (parseErr) {
        throw new Error("Respons server bukan JSON yang valid. Cuplikan: " + rawText.slice(0, 120));
    }

    if (!result.success) {
        const stageLabel = result.stage ? ` [tahap: ${result.stage}]` : '';
        throw new Error((result.message || "Gagal memproses data di Google Sheet.") + stageLabel);
    }

    return result;
}

window.submitOfficialPdf = async function() {
    const input = document.getElementById('officialPdfInput');
    const dateInput = document.getElementById('officialReportDate');
    const statusBox = document.getElementById('pdfUploadStatus');
    const btnSubmit = document.getElementById('btnSubmitPdf');
    const btnText = document.getElementById('btnSubmitText');
    const progContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPct = document.getElementById('uploadProgressPct');
    const statusText = document.getElementById('uploadStatusText');

    const setProgress = (pct, label) => {
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPct) progressPct.textContent = `${pct}%`;
        if (statusText && label) statusText.textContent = label;
    };

    const showStatus = (isSuccess, message) => {
        if (!statusBox) return;
        statusBox.className = isSuccess
            ? "block text-center p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-3"
            : "block text-center p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-3";
        statusBox.textContent = message;
        statusBox.classList.remove('hidden');
    };

    if (!input || !input.files || !input.files[0]) {
        alert("Silakan pilih file PDF terlebih dahulu!");
        return;
    }

    const file = input.files[0];
    // Tanggal per-baris tetap diambil dari isi PDF itu sendiri (setiap baris
    // punya tanggalnya sendiri, penting untuk PDF bulanan yang mencakup
    // banyak tanggal sekaligus) — input ini cuma label/metadata untuk log.
    const reportDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

    if (statusBox) statusBox.classList.add('hidden');
    if (progContainer) progContainer.classList.remove('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = "Mengunggah...";
    setProgress(5, "Memeriksa ukuran PDF...");

    try {
        // 1. Cek jumlah halaman & pecah otomatis kalau terlalu besar untuk
        //    1x konversi (Google Docs yang dipakai backend untuk baca teks
        //    PDF punya batas ~1 juta karakter — PDF bulanan bisa jauh
        //    melebihi itu). Kalau pdf-lib gagal dimuat (mis. offline),
        //    lanjut sebagai upload tunggal seperti biasa — backend tetap
        //    punya penjaga & akan menolak dengan pesan jelas kalau kebesaran.
        let splitInfo;
        try {
            splitInfo = await splitPdfIntoChunks_(file);
        } catch (splitErr) {
            console.warn("Gagal memeriksa/memecah PDF, lanjut sebagai upload tunggal:", splitErr);
            splitInfo = { totalPages: null, chunks: null };
        }

        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const aggregate = { count: 0, skippedCount: 0, duplicateCount: 0 };
        // Toko yang "hilang" di 1 chunk sangat mungkin justru ketemu di chunk
        // lain (laporan bulanan biasa mencakup ribuan toko lintas cabang,
        // tersebar di rentang halaman berbeda) — union foundStoreCodes dari
        // SEMUA chunk dulu, baru status hilang dihitung di akhir, supaya
        // tidak menyesatkan seperti kalau dilihat per-chunk saja.
        const foundCodesUnion = new Set();
        let registeredStoreCodes = null;

        const trackResult = (result) => {
            aggregate.count += result.count || 0;
            aggregate.skippedCount += result.skippedCount || 0;
            aggregate.duplicateCount += result.duplicateCount || 0;
            (result.foundStoreCodes || []).forEach(c => foundCodesUnion.add(c));
            if (!registeredStoreCodes && result.registeredStoreCodes) registeredStoreCodes = result.registeredStoreCodes;
        };

        if (!splitInfo.chunks) {
            // File cukup kecil (atau pdf-lib gagal dimuat) -> upload langsung, 1 request.
            setProgress(30, "Membaca dan mengirim file PDF...");
            const base64Content = await readFileAsDataURL_(file);
            setProgress(60, "Melakukan lookup Store Code dan menyimpan ke Master...");
            const result = await uploadPdfPayload_(file.name, base64Content, reportDate, { batchId, chunkIndex: 1, totalChunks: 1 });
            trackResult(result);
        } else {
            // File besar (mis. laporan bulanan) -> otomatis dipecah jadi
            // beberapa bagian dan diunggah berurutan. Aman diulang kalau
            // gagal di tengah: anti-duplikat Store Code + Tanggal di
            // backend otomatis melewati data yang sudah berhasil masuk.
            const total = splitInfo.chunks.length;
            for (const chunk of splitInfo.chunks) {
                const pct = 10 + Math.round((chunk.index / total) * 80);
                setProgress(pct, `Mengunggah bagian ${chunk.index} dari ${total} (halaman ${chunk.startPage}-${chunk.endPage})...`);

                const dataUrl = pdfBytesToDataURL_(chunk.bytes);
                const chunkFileName = `${file.name} (hal ${chunk.startPage}-${chunk.endPage})`;
                const result = await uploadPdfPayload_(chunkFileName, dataUrl, reportDate, {
                    batchId, chunkIndex: chunk.index, totalChunks: total
                });
                trackResult(result);
            }
        }

        setProgress(100, "Selesai!");

        const parts = [`${aggregate.count} baris data berhasil disimpan ke Master`];
        if (aggregate.duplicateCount > 0) parts.push(`${aggregate.duplicateCount} duplikat dilewati`);
        if (aggregate.skippedCount > 0) parts.push(`${aggregate.skippedCount} baris dilewati (kode toko tidak valid/tidak terdaftar)`);

        // Status hilang yang SEBENARNYA: toko terdaftar yang TIDAK ketemu
        // di SATUPUN chunk dari batch ini (bukan cuma 1 chunk tertentu).
        if (registeredStoreCodes) {
            const trulyMissing = registeredStoreCodes.filter(c => !foundCodesUnion.has(c));
            if (trulyMissing.length > 0) {
                parts.push(`⚠️ ${trulyMissing.length} toko TIDAK ketemu di seluruh file: ${trulyMissing.join(', ')}`);
            }
        }

        const prefix = splitInfo.chunks ? `PDF (${splitInfo.totalPages} halaman) otomatis dipecah jadi ${splitInfo.chunks.length} bagian. ` : '';

        showStatus(true, prefix + parts.join(', ') + '.');
        if (btnText) btnText.textContent = "Berhasil Disimpan";

        setTimeout(() => {
            closeUploadPdfModal();
            if (typeof currentSalesSource !== 'undefined' && (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT')) {
                fetchSalesData();
            }
        }, 2200);

    } catch (error) {
        console.error("Upload Error:", error);
        if (progContainer) progContainer.classList.add('hidden');
        showStatus(false, "Gagal: " + (error.message || "Terjadi kesalahan koneksi.") +
            " Aman untuk klik \"Coba Lagi\" — data yang sudah berhasil tersimpan tidak akan dobel " +
            "(sistem otomatis melewati Store Code + Tanggal yang sama).");
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = "Coba Lagi";
    }
};
