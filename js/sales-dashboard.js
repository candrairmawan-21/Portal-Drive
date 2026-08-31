/* ==========================================================================
   1. KONFIGURASI GLOBAL & MAPPING GID SHEETS
   ========================================================================== */
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz0OP_PZzwnj5LJFfus99KyLSqwiD5PFDQK6QX9Br2FTHrEFOM8pMgEXZpsLhd26ZWz/exec";

// Disinkronkan dengan SPREADSHEET_ID pada Code.gs (Single Source of Truth)
const SPREADSHEET_ID_OFFICIAL = "1P70howhagUA_H4H0cSXUWB5MjDhCKuOirVLSmh39Z_E";

let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd';
let currentSalesSource = 'SUBMISSION'; // 'SUBMISSION' atau 'OFFICIAL_IT_REPORT'

// State khusus Official IT Report. Tidak mengubah state Store Submission.
let officialRawData = [];
let officialDataHealth = {
    totalSourceRows: 0,
    validSourceRows: 0,
    selectedMonthRows: 0,
    invalidDateRows: 0,
    invalidStoreRows: 0,
    missingHeaders: []
};
let submissionComparisonData = [];
let officialRankingPanel = null;
let officialSlicerReference = [];
let currentTrendRequestId = 0;


// GID Sheet Lengkap (Termasuk Alias untuk Official IT Report)
const SHEET_GIDS = {
    'OFFICIAL_IT_REPORT': '1129267198',
    'OFFICIAL_IT': '1129267198', // Alias agar aman dari bug pemanggilan key
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
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        dateEl.innerText = "Update Terakhir: " + today;
    }
}

/**
 * Fungsi Ganti Sumber Data (Store Submission vs Official IT Report)
 */
window.switchSalesSource = function(sourceType) {
    currentSalesSource = sourceType;

    const btnSub = document.getElementById('btn-src-submission');
    const btnOff = document.getElementById('btn-src-official');
    const slicerBulan = document.getElementById('slicerBulanSales');

    if (isOfficialSource_()) {
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
        if (slicerBulan) slicerBulan.disabled = false;
        setOfficialRankingVisibility_(true);
    } else {
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
        if (slicerBulan) slicerBulan.disabled = false;
        setOfficialRankingVisibility_(false);
    }

    resetSpecificSlicer_();
    if (salesChartInstance) { try { salesChartInstance.destroy(); } catch(e) {} salesChartInstance=null; }
    fetchSalesData();
};

function initSalesSlicers() {
    const slicerBulan = document.getElementById('slicerBulanSales');
    const slicerKategori = document.getElementById('slicerKategoriSales');
    const slicerSpesifik = document.getElementById('slicerSpesifikSales');

    if (!slicerKategori || !slicerSpesifik) return;

    slicerKategori.addEventListener('change', () => {
        populateSpecificSlicer_();
        applySalesFilters();
    });

    slicerSpesifik.addEventListener('change', applySalesFilters);

    if (slicerBulan) {
        slicerBulan.addEventListener('change', async () => {
            await fetchSalesData();
            if (!isOfficialSource_() && typeof fetchAndRenderUptSalesTable === "function") {
                fetchAndRenderUptSalesTable();
            }
        });
    }

    if (isOfficialSource_()) setOfficialRankingVisibility_(true);
    else setOfficialRankingVisibility_(false);
}

function isOfficialSource_() {
    return currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT';
}

function resetSpecificSlicer_() {
    const el = document.getElementById('slicerSpesifikSales');
    if (!el) return;
    el.innerHTML = '<option value="all">-- Semua --</option>';
    el.value = 'all';
    el.disabled = true;
    el.classList.add('bg-slate-100', 'cursor-not-allowed');
}

function normalizeStoreKey_(value) {
    return String(value ?? '').trim().toUpperCase().replace(/\s+/g, '');
}

function getSlicerReferenceData_() {
    const source = officialSlicerReference.length ? officialSlicerReference : salesData;
    const map = new Map();
    source.forEach(item => {
        const code = normalizeStoreKey_(item.storeCode || item.store);
        const name = String(item.store || item.storeCode || '').trim();
        if (!code && !name) return;
        const key = code || name.toUpperCase();
        const existing = map.get(key) || { storeCode: code, store: name, bm: '-', abm: '-' };
        if (name) existing.store = name;
        if (item.bm && item.bm !== '-') existing.bm = String(item.bm).trim();
        if (item.abm && item.abm !== '-') existing.abm = String(item.abm).trim();
        map.set(key, existing);
    });
    return [...map.values()];
}

function populateSpecificSlicer_() {
    const kategori = document.getElementById('slicerKategoriSales');
    const spesifik = document.getElementById('slicerSpesifikSales');
    if (!kategori || !spesifik) return;

    const type = kategori.value || 'all';
    const previous = spesifik.value || 'all';
    spesifik.innerHTML = '<option value="all">-- Semua --</option>';

    if (type === 'all') {
        spesifik.value = 'all';
        spesifik.disabled = true;
        spesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        return;
    }

    const values = new Map();
    getSlicerReferenceData_().forEach(item => {
        let value = '', label = '';
        if (type === 'store') {
            value = normalizeStoreKey_(item.storeCode || item.store);
            label = String(item.store || item.storeCode || '').trim();
        } else if (type === 'bm') {
            value = String(item.bm || '').trim(); label = value;
        } else if (type === 'abm') {
            value = String(item.abm || '').trim(); label = value;
        }
        if (!value || value === '-' || !label || label === '-') return;
        const key = value.toLowerCase();
        if (!values.has(key)) values.set(key, { value, label });
    });

    [...values.values()].sort((a,b) => a.label.localeCompare(b.label, 'id')).forEach(item => {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = type === 'store' ? `${item.value} — ${item.label}` : item.label;
        spesifik.appendChild(option);
    });

    spesifik.disabled = values.size === 0;
    spesifik.classList.toggle('bg-slate-100', values.size === 0);
    spesifik.classList.toggle('cursor-not-allowed', values.size === 0);
    if ([...spesifik.options].some(o => o.value.toLowerCase() === previous.toLowerCase())) spesifik.value = previous;
    else spesifik.value = 'all';
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
            ? (SHEET_GIDS['OFFICIAL_IT_REPORT'] || '1129267198')
            : (SHEET_GIDS[selectedKey] || '1766415704');
        const finalUrl = `${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`;

        const response = await fetch(finalUrl, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const csvText = await response.text();
        if (!csvText.trim()) throw new Error('CSV source kosong.');

        if (isOfficialSource_()) {
            salesData = parseOfficialITCSV_(csvText);
            officialSlicerReference = salesData.map(x => ({storeCode:x.storeCode, store:x.store, bm:x.bm, abm:x.abm}));
            await fetchSubmissionComparisonData_(selectedKey);
            applyOfficialComparisonFallbacks_();
        } else {
            salesData = parseSalesCSV(csvText, 'SUBMISSION');
            submissionComparisonData = [...salesData];
        }

        populateSpecificSlicer_();
        applySalesFilters();
    } catch (error) {
        console.error('Error fetching data:', error);
        salesData = [];
        officialRawData = [];
        if (isOfficialSource_()) {
            officialDataHealth = { totalSourceRows: 0, validSourceRows: 0, selectedMonthRows: 0, invalidDateRows: 0, invalidStoreRows: 0, missingHeaders: [] };
        }
        renderSalesLoadError_(error.message || 'Gagal mengambil data.');
        applySalesFilters();
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}


async function fetchSubmissionComparisonData_(selectedKey) {
    const gid = SHEET_GIDS[selectedKey];
    if (!gid) throw new Error(`GID Store Submission untuk ${selectedKey} tidak ditemukan.`);

    const url = `${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`;
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Gagal mengambil Store Submission (${selectedKey}): HTTP ${response.status}`);

    const csvText = await response.text();
    if (!csvText.trim()) throw new Error(`Store Submission ${selectedKey} kosong.`);

    const parsed = parseSalesCSV(csvText, 'SUBMISSION');
    if (!parsed.length) throw new Error(`Store Submission ${selectedKey} tidak memiliki data yang dapat dibaca.`);

    submissionComparisonData = parsed;
    return parsed;
}


function findHeaderIndexSubmission_(headers, aliases) {
    const normalized = headers.map(h => normalizeHeader_(h));
    for (const alias of aliases) {
        const idx = normalized.indexOf(normalizeHeader_(alias));
        if (idx !== -1) return idx;
    }
    return -1;
}

function parseSalesCSV(text, sourceMode) {
    if (sourceMode === 'OFFICIAL_IT' || sourceMode === 'OFFICIAL_IT_REPORT') return parseOfficialITCSV_(text);

    const records = parseCSVRecords_(text);
    if (records.length < 2) return [];

    let headerRowIdx = records.findIndex(r => {
        const h = r.map(normalizeHeader_);
        return h.some(x => x === 'store name' || x === 'store_name' || x === 'nama toko')
            && h.some(x => x === 'mtd sales' || x === 'net sales' || x === 'sales');
    });
    if (headerRowIdx < 0) headerRowIdx = records.length > 2 ? 2 : 0;

    const headers = records[headerRowIdx];
    const idx = {
        storeCode: findHeaderIndexSubmission_(headers, ['store code','store_code','kode toko']),
        store: findHeaderIndexSubmission_(headers, ['store name','store_name','store','nama toko']),
        bm: findHeaderIndexSubmission_(headers, ['nama bm','bm','branch manager','branch_manager']),
        abm: findHeaderIndexSubmission_(headers, ['nama abm','abm','asst branch manager','assistant branch manager']),
        mtdSales: findHeaderIndexSubmission_(headers, ['net sales','net_sales','mtd sales','sales mtd']),
        mtdTarget: findHeaderIndexSubmission_(headers, ['target sales','target_sales','mtd target','sales target','target']),
        bestEstimate: findHeaderIndexSubmission_(headers, ['best estimate','best_estimate','estimate']),
        achievement: findHeaderIndexSubmission_(headers, ['achievement','ach percent','% ach','ach','achievement %']),
        salesLY: findHeaderIndexSubmission_(headers, ['sales ly','ly sales','ly']),
        sssg: findHeaderIndexSubmission_(headers, ['sssg','ach sssg']),
        projSssg: findHeaderIndexSubmission_(headers, ['projection sssg','proj sssg','projection']),
        qtySold: findHeaderIndexSubmission_(headers, ['qty sold','qty_sold','qty','quantity','quantity sold']),
        trxCount: findHeaderIndexSubmission_(headers, ['trx count','trx_count','trx','transaction count','transactions'])
    };
    const fallback = {storeCode:0, store:1, bm:2, abm:3, mtdSales:4, mtdTarget:5, qtySold:11, trxCount:12, bestEstimate:16, achievement:17, salesLY:18, sssg:20, projSssg:21};
    const getRaw = (key, row) => { const i=idx[key] >= 0 ? idx[key] : fallback[key]; return i !== undefined ? (row[i] ?? '') : ''; };
    const getStr = (key,row) => String(getRaw(key,row)).trim();
    const getNum = (key,row) => parseOfficialNumber_(getRaw(key,row));
    const result=[];

    for (let i=headerRowIdx+1;i<records.length;i++) {
        const row=records[i]; if(!row.some(v=>String(v||'').trim()!=='')) continue;
        const storeName=getStr('store',row); if(!storeName || storeName==='-') continue;
        const storeCode=normalizeStoreKey_(getStr('storeCode',row));
        const sales=getNum('mtdSales',row), target=getNum('mtdTarget',row);
        let ach=getNum('achievement',row); if(ach===0 && target>0) ach=sales/target*100;
        const qty=getNum('qtySold',row), trx=getNum('trxCount',row);
        result.push({
            storeCode, store:storeName, bm:getStr('bm',row)||'-', abm:getStr('abm',row)||'-',
            mtdSales:sales, mtdTarget:target, bestEstimate:getStr('bestEstimate',row)||'-',
            achPercent:ach, salesLY:getNum('salesLY',row), sssg:getNum('sssg',row), projSssg:getNum('projSssg',row),
            qtySold:qty, trxCount:trx, atv:trx?sales/trx:0, upt:trx?qty/trx:0
        });
    }
    return result;
}



function parseCSVLine(textLine) {
    const row = [];
    let inQuotes = false;
    let current = '';
    for (let i = 0; i < String(textLine).length; i++) {
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


/* ==========================================================================
   4. SYSTEM FILTERING SALES
   ========================================================================== */
function applySalesFilters() {
    const kategori = document.getElementById('slicerKategoriSales')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifikSales')?.value || 'all';
    let filteredSales = [...salesData];

    if (kategori !== 'all' && spesifik !== 'all') {
        const selected = String(spesifik).trim();
        const selectedNorm = normalizeStoreKey_(selected).toLowerCase();
        filteredSales = salesData.filter(item => {
            if (kategori === 'store') {
                const code = normalizeStoreKey_(item.storeCode || '').toLowerCase();
                const name = String(item.store || '').trim().toLowerCase();
                return code === selectedNorm || name === selected.toLowerCase();
            }
            if (kategori === 'bm') return String(item.bm || '').trim().toLowerCase() === selected.toLowerCase();
            if (kategori === 'abm') return String(item.abm || '').trim().toLowerCase() === selected.toLowerCase();
            return true;
        });
    }

    if (isOfficialSource_()) {
        setOfficialRankingVisibility_(true);
        renderOfficialDashboard_(filteredSales);
    } else {
        setOfficialRankingVisibility_(false);
        renderSubmissionRankingCards_(filteredSales);
        renderSalesSummaryFiltered(filteredSales);
        renderSalesTableFiltered(filteredSales);
        if (currentSalesChartMode === 'mtd') renderSalesChartFiltered(filteredSales);
        else fetchAndRenderTrendChart(kategori, spesifik);
    }
}



window.setSalesChartMode = function(mode) {
    currentSalesChartMode = mode;
    const btnMtd = document.getElementById('btnModeMtd');
    const btnTrend = document.getElementById('btnModeTrend');
    
    if (mode === 'mtd') {
        if (btnMtd) btnMtd.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        if (btnTrend) btnTrend.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    } else {
        if (btnTrend) btnTrend.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        if (btnMtd) btnMtd.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    }
    applySalesFilters();
};


/* ============================================================================
   OFFICIAL IT REPORT - DATA MODEL, COMPARISON, RANKING & VISUALIZATION
   ============================================================================ */
const OFFICIAL_HEADERS = {
    storeCode: ['store code','store_code','kode toko'],
    storeName: ['store name','store_name','store','nama toko'],
    date: ['date','tanggal','business date','transaction date'],
    netSales: ['net sales','net_sales','sales','mtd sales','mtd net sales'],
    target: ['mtd target','target sales','target_sales','sales target','target'],
    achievement: ['achievement','ach percent','% ach','ach','achievement %'],
    qtySold: ['qty sold','qty_sold','qty','quantity','quantity sold'],
    trxCount: ['trx count','trx_count','trx','transaction count','transactions'],
    bm: ['bm','branch manager','nama bm','branch_manager'],
    abm: ['abm','assistant branch manager','asst branch manager','nama abm','assistant_bm']
};

function normalizeHeader_(value) {
    return String(value ?? '').replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,' ');
}
function normalizeHeaders_(headers) { return headers.map(normalizeHeader_); }
function headerIndex_(headers, aliases) {
    const normalized = normalizeHeaders_(headers);
    for (const alias of aliases) {
        const idx = normalized.indexOf(normalizeHeader_(alias));
        if (idx !== -1) return idx;
    }
    return -1;
}
function parseOfficialNumber_(value) {
    if (value === null || value === undefined || String(value).trim() === '') return 0;
    let s = String(value).trim().replace(/[^0-9,.-]/g,'');
    if (!s) return 0;
    if (s.includes(',') && s.includes('.')) {
        if (s.lastIndexOf(',') > s.lastIndexOf('.')) s = s.replace(/\./g,'').replace(',','.');
        else s = s.replace(/,/g,'');
    } else if (s.includes(',')) {
        const p=s.split(','); s=(p.length>2 || p[p.length-1].length===3) ? s.replace(/,/g,'') : s.replace(',','.');
    } else if (s.includes('.')) {
        const p=s.split('.'); if (p.length>2 || p[p.length-1].length===3) s=s.replace(/\./g,'');
    }
    const n=Number(s); return Number.isFinite(n)?n:0;
}
function parseOfficialDate_(value) {
    const raw=String(value??'').trim(); if(!raw)return null;
    let m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()===+m[1]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[3]?d:null;}
    m=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);return d.getFullYear()===+m[3]&&d.getMonth()===+m[2]-1&&d.getDate()===+m[1]?d:null;}
    const d=new Date(raw); return Number.isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
}
function selectedMonthInfo_() {
    const key=document.getElementById('slicerBulanSales')?.value||'Aug26';
    const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    return {key,month:months[key.substring(0,3)],year:2000+parseInt(key.substring(3),10)};
}
function getOfficialField_(row, headers, aliases, fallbackIndex) {
    const idx=headerIndex_(headers,aliases);
    if(idx!==-1 && row[idx]!==undefined) return row[idx];
    return fallbackIndex!==undefined ? (row[fallbackIndex]??'') : '';
}
function parseCSVRecords_(text) {
    const records=[]; let current=''; let inQuotes=false;
    const str=String(text||'');
    for(let i=0;i<str.length;i++){
        const ch=str[i], next=str[i+1];
        if(ch==='"' && inQuotes && next==='"'){current+='""';i++;}
        else if(ch==='"'){inQuotes=!inQuotes;current+=ch;}
        else if((ch==='\n'||ch==='\r')&&!inQuotes){if(ch==='\r'&&next==='\n')i++;if(current.trim())records.push(parseCSVLine(current));current='';}
        else current+=ch;
    }
    if(current.trim())records.push(parseCSVLine(current));
    return records;
}
function parseOfficialITCSV_(text) {
    const rows=parseCSVRecords_(text); if(rows.length<2)return [];
    const headers=rows[0]; const sel=selectedMonthInfo_();
    const fallback={storeCode:0,storeName:1,date:2,netSales:4,target:5,achievement:17,qtySold:11,trxCount:12,bm:14,abm:15};
    const idx={
        storeCode:headerIndex_(headers,OFFICIAL_HEADERS.storeCode),storeName:headerIndex_(headers,OFFICIAL_HEADERS.storeName),date:headerIndex_(headers,OFFICIAL_HEADERS.date),
        netSales:headerIndex_(headers,OFFICIAL_HEADERS.netSales),target:headerIndex_(headers,OFFICIAL_HEADERS.target),achievement:headerIndex_(headers,OFFICIAL_HEADERS.achievement),
        qtySold:headerIndex_(headers,OFFICIAL_HEADERS.qtySold),trxCount:headerIndex_(headers,OFFICIAL_HEADERS.trxCount),bm:headerIndex_(headers,OFFICIAL_HEADERS.bm),abm:headerIndex_(headers,OFFICIAL_HEADERS.abm)
    };
    const missing=[]; ['storeCode','storeName','date','netSales','qtySold','trxCount','bm','abm'].forEach(k=>{if(idx[k]===-1&&fallback[k]===undefined)missing.push(k);});
    officialDataHealth={totalSourceRows:0,validSourceRows:0,selectedMonthRows:0,invalidDateRows:0,invalidStoreRows:0,missingHeaders:missing};
    if(missing.length){officialRawData=[];return [];} 

    const map=new Map(); officialRawData=[];
    for(let r=1;r<rows.length;r++){
        const row=rows[r]; if(!row.some(v=>String(v||'').trim()!==''))continue; officialDataHealth.totalSourceRows++;
        const date=parseOfficialDate_(getOfficialField_(row,headers,OFFICIAL_HEADERS.date,fallback.date));
        if(!date){officialDataHealth.invalidDateRows++;continue;}
        const code=normalizeStoreKey_(getOfficialField_(row,headers,OFFICIAL_HEADERS.storeCode,fallback.storeCode));
        const store=String(getOfficialField_(row,headers,OFFICIAL_HEADERS.storeName,fallback.storeName)||'').trim().replace(/\s+/g,' ');
        if(!code&&!store){officialDataHealth.invalidStoreRows++;continue;}
        const sales=parseOfficialNumber_(getOfficialField_(row,headers,OFFICIAL_HEADERS.netSales,fallback.netSales));
        const rawTarget=parseOfficialNumber_(getOfficialField_(row,headers,OFFICIAL_HEADERS.target,fallback.target));
        const reportedAch=parseOfficialNumber_(getOfficialField_(row,headers,OFFICIAL_HEADERS.achievement,fallback.achievement));
        const qty=parseOfficialNumber_(getOfficialField_(row,headers,OFFICIAL_HEADERS.qtySold,fallback.qtySold));
        const trx=parseOfficialNumber_(getOfficialField_(row,headers,OFFICIAL_HEADERS.trxCount,fallback.trxCount));
        const bm=String(getOfficialField_(row,headers,OFFICIAL_HEADERS.bm,fallback.bm)||'').trim()||'-';
        const abm=String(getOfficialField_(row,headers,OFFICIAL_HEADERS.abm,fallback.abm)||'').trim()||'-';
        officialDataHealth.validSourceRows++;
        const raw={storeCode:code||store.toUpperCase(),store:store||code,date,netSales:sales,rawTarget,reportedAch,qtySold:qty,trxCount:trx,bm,abm};
        officialRawData.push(raw);
        if(date.getMonth()!==sel.month||date.getFullYear()!==sel.year)continue;
        officialDataHealth.selectedMonthRows++;
        const key=code||store.toUpperCase();
        if(!map.has(key))map.set(key,{storeCode:code||store.toUpperCase(),store:store||code,bm:'-',abm:'-',mtdSales:0,mtdTarget:0,qtySold:0,trxCount:0,latestDate:null,latestReportedAch:0});
        const item=map.get(key); if(store)item.store=store; if(bm!=='-')item.bm=bm;if(abm!=='-')item.abm=abm;
        item.mtdSales+=sales; item.qtySold+=qty; item.trxCount+=trx;
    }
    return [...map.values()].map(item=>{
        item.mtdTarget=0;
        item.achPercent=0;
        item.atv=item.trxCount?item.mtdSales/item.trxCount:0;
        item.upt=item.trxCount?item.qtySold/item.trxCount:0;
        delete item.latestDate; delete item.latestReportedAch;
        return item;
    });
}
function findSubmissionForOfficial_(item) {
    const code=normalizeStoreKey_(item.storeCode), name=String(item.store||'').trim().toLowerCase();
    return submissionComparisonData.find(s=>{
        const sc=normalizeStoreKey_(s.storeCode), sn=String(s.store||'').trim().toLowerCase();
        return (code&&sc&&code===sc)||(name&&sn&&name===sn);
    })||null;
}
function applyOfficialComparisonFallbacks_() {
    salesData.forEach(item=>{
        const sub=findSubmissionForOfficial_(item);
        item.mtdTarget=sub ? (Number(sub.mtdTarget)||0) : 0;
        item.achPercent=item.mtdTarget>0 ? (Number(item.mtdSales)||0)/item.mtdTarget*100 : 0;
        item.salesLY=sub ? (Number(sub.salesLY)||0) : 0;
        item.projSssg=sub ? (Number(sub.projSssg)||0) : 0;
    });
}
function getOfficialComparison_(data) {
    let totalSales=0,totalTarget=0,totalLY=0,totalProj=0,projCount=0;
    data.forEach(item=>{totalSales+=item.mtdSales||0;totalTarget+=item.mtdTarget||0;const sub=findSubmissionForOfficial_(item);if(sub){totalLY+=sub.salesLY||0;if(Number.isFinite(sub.projSssg)){totalProj+=sub.projSssg;projCount++;}}});
    const achievement=totalTarget>0?totalSales/totalTarget*100:0;
    const achSssg=totalLY>0?(totalSales-totalLY)/totalLY*100:0;
    const projSssg=projCount?totalProj/projCount:0;
    return {totalSales,totalTarget,totalLY,achievement,achSssg,projSssg};
}
function setSummaryValue_(id,value,className){const el=document.getElementById(id);if(!el)return;el.innerText=value;if(className)el.className=className;}
function renderOfficialSummary_(data){
    const k=getOfficialComparison_(data);
    setSummaryValue_('summary-total-sales',`Rp ${Math.round(k.totalSales).toLocaleString('id-ID')}`,'text-xl font-black text-slate-800');
    setSummaryValue_('summary-total-target',`Rp ${Math.round(k.totalTarget).toLocaleString('id-ID')}`,'text-xl font-black text-slate-800');
    setSummaryValue_('summary-avg-ach',`${k.achievement.toFixed(1)}%`,k.achievement>=100?'text-xl font-black text-emerald-500':'text-xl font-black text-orange-500');
    setSummaryValue_('summary-total-ly',`Rp ${Math.round(k.totalLY).toLocaleString('id-ID')}`,'text-xl font-black text-slate-800');
    setSummaryValue_('summary-sssg',`${k.achSssg.toFixed(2)}%`,k.achSssg>=0?'text-xl font-black text-emerald-500':'text-xl font-black text-rose-500');
    setSummaryValue_('summary-proj-sssg',`${k.projSssg.toFixed(2)}%`,k.projSssg>=0?'text-xl font-black text-cyan-600':'text-xl font-black text-rose-500');
    renderOfficialRankingCards_(data); renderOfficialDataHealth_();
}
function aggregateManagerRanking_(data,field){
    const map=new Map(); data.forEach(item=>{const name=String(item[field]||'').trim();if(!name||name==='-')return;if(!map.has(name))map.set(name,{name,sales:0,target:0,stores:0});const x=map.get(name);x.sales+=item.mtdSales||0;x.target+=item.mtdTarget||0;x.stores++;});
    return [...map.values()].map(x=>({...x,achievement:x.target>0?x.sales/x.target*100:0})).sort((a,b)=>b.achievement-a.achievement);
}
function setOfficialRankingVisibility_(visible){
    const panel=document.getElementById('official-manager-ranking-panel');
    if(!panel)return;
    panel.classList.toggle('hidden',!visible);
    if(!visible) panel.innerHTML='';
}
function ensureOfficialRankingPanel_(){
    let panel=document.getElementById('official-manager-ranking-panel');if(panel)return panel;
    const anchor=document.getElementById('summary-proj-sssg');if(!anchor)return null;
    const card=anchor.closest('.grid')||anchor.closest('.flex')||anchor.parentElement?.parentElement?.parentElement;if(!card||!card.parentElement)return null;
    panel=document.createElement('div');panel.id='official-manager-ranking-panel';panel.className='mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4';card.parentElement.insertBefore(panel,card.nextSibling);return panel;
}
function formatCompactOfficial_(value){const n=Number(value||0),a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(1).replace('.0','')+'B';if(a>=1e6)return(n/1e6).toFixed(1).replace('.0','')+'M';if(a>=1e3)return(n/1e3).toFixed(1).replace('.0','')+'K';return Math.round(n).toLocaleString('id-ID');}
function managerRankingHtml_(title,data,accent){
    if(!data.length)return `<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div class="font-black text-slate-800">${title}</div><div class="text-xs text-slate-400 py-4">Belum ada mapping ${title}.</div></div>`;
    const rows=data.slice(0,5).map((x,i)=>`<div class="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0"><span class="w-7 h-7 rounded-lg ${i===0?'bg-amber-50 text-amber-600':'bg-slate-100 text-slate-500'} flex items-center justify-center text-xs font-black">${i+1}</span><div class="min-w-0 flex-1"><div class="text-xs font-black text-slate-700 truncate">${escapeHtml_(x.name)}</div><div class="text-[9px] font-semibold text-slate-400">${x.stores} store • Sales Rp ${formatCompactOfficial_(x.sales)} / Target Rp ${formatCompactOfficial_(x.target)}</div></div><div class="text-sm font-black ${x.achievement>=100?'text-emerald-600':'text-orange-600'}">${x.achievement.toFixed(1)}%</div></div>`).join('');
    return `<div class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div class="flex items-center justify-between mb-2"><div class="font-black text-slate-800">${title}</div><span class="text-[10px] font-black ${accent} uppercase tracking-wider">Top 5</span></div>${rows}</div>`;
}
function renderOfficialRankingCards_(data){const panel=ensureOfficialRankingPanel_();if(!panel)return;panel.classList.remove('hidden');panel.innerHTML=managerRankingHtml_('Ranking BM',aggregateManagerRanking_(data,'bm'),'text-cyan-600')+managerRankingHtml_('Ranking ABM',aggregateManagerRanking_(data,'abm'),'text-violet-600');}
function renderSubmissionRankingCards_(data){const panel=ensureOfficialRankingPanel_();if(!panel)return;panel.classList.remove('hidden');panel.innerHTML=managerRankingHtml_('Ranking BM',aggregateManagerRanking_(data,'bm'),'text-orange-600')+managerRankingHtml_('Ranking ABM',aggregateManagerRanking_(data,'abm'),'text-rose-600');}
function escapeHtml_(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}
function renderOfficialDataHealth_(){
    let node=document.getElementById('official-it-data-health'),count=document.getElementById('table-record-count');
    if(!node&&count?.parentElement){node=document.createElement('div');node.id='official-it-data-health';node.className='mt-2 text-[10px] font-semibold';count.parentElement.appendChild(node);}if(!node)return;
    const h=officialDataHealth;
    node.className='mt-2 text-[10px] font-semibold '+((h.invalidDateRows||h.invalidStoreRows||h.missingHeaders.length)?'text-amber-500':'text-slate-400');
    node.textContent=h.missingHeaders.length?`Format Official IT tidak sesuai. Kolom wajib hilang: ${h.missingHeaders.join(', ')}.`:`Audit: ${h.selectedMonthRows} row bulan terpilih • ${h.validSourceRows}/${h.totalSourceRows} row source valid${h.invalidDateRows||h.invalidStoreRows?` • ${h.invalidDateRows} tanggal invalid • ${h.invalidStoreRows} store invalid`:''}.`;
}
function renderOfficialTable_(data){
    renderSalesTableFiltered(data);
    renderOfficialDataHealth_();
}

function getCanonicalStoreOrder_(data) {
    const ref = submissionComparisonData.length ? submissionComparisonData : data;
    const order = new Map();
    ref.forEach((item, index) => {
        const key = normalizeStoreKey_(item.storeCode || item.store);
        if (key && !order.has(key)) order.set(key, index);
    });
    return [...data].sort((a, b) => {
        const ak = normalizeStoreKey_(a.storeCode || a.store);
        const bk = normalizeStoreKey_(b.storeCode || b.store);
        const ai = order.has(ak) ? order.get(ak) : 999999;
        const bi = order.has(bk) ? order.get(bk) : 999999;
        return ai - bi || String(a.store || '').localeCompare(String(b.store || ''), 'id');
    });
}

function renderOfficialChart_(data){
    const ctx=document.getElementById('salesTargetChart');if(!ctx)return;if(salesChartInstance)salesChartInstance.destroy();
    const sorted=getCanonicalStoreOrder_(data);
    salesChartInstance=new Chart(ctx,{type:'bar',data:{labels:sorted.map(i=>i.store),datasets:[
        {type:'line',label:'Achievement (%)',data:sorted.map(i=>i.achPercent||0),borderColor:'#0891b2',backgroundColor:'#0891b2',borderWidth:2.5,pointRadius:4,pointBackgroundColor:'#fff',pointBorderColor:'#0891b2',pointBorderWidth:2,fill:false,tension:.35,yAxisID:'y1'},
        {type:'bar',label:'MTD Target',data:sorted.map(i=>i.mtdTarget||0),backgroundColor:'rgba(124,58,237,.78)',borderColor:'#7c3aed',borderWidth:1,borderRadius:6,yAxisID:'y'},
        {type:'bar',label:'MTD Sales',data:sorted.map(i=>i.mtdSales||0),backgroundColor:'rgba(6,182,212,.88)',borderColor:'#0891b2',borderWidth:1,borderRadius:6,yAxisID:'y'}
    ]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:38}},interaction:{mode:'index',intersect:false},scales:{x:{grid:{display:false},ticks:{maxRotation:55,minRotation:35,autoSkip:false}},y:{beginAtZero:true,ticks:{callback:v=>'Rp '+formatCompactOfficial_(v)}},y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>v+'%'}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>c.dataset.label==='Achievement (%)'?`${c.dataset.label}: ${Number(c.raw||0).toFixed(1)}%`:`${c.dataset.label}: Rp ${Math.round(c.raw||0).toLocaleString('id-ID')}`}}}},plugins:[{id:'officialAchievementLabels',afterDatasetsDraw:chart=>{const ds=chart.data.datasets[0],meta=chart.getDatasetMeta(0);if(meta.hidden)return;meta.data.forEach((el,i)=>{const c=chart.ctx;c.save();c.fillStyle='#0e7490';c.font='bold 10px "Plus Jakarta Sans",sans-serif';c.textAlign='center';c.textBaseline='bottom';c.fillText(Number(ds.data[i]||0).toFixed(1)+'%',el.x,el.y-7);c.restore();});}}]});
}
function renderOfficialTrendChart_(data){
    const ctx=document.getElementById('salesTargetChart');if(!ctx)return;if(salesChartInstance)salesChartInstance.destroy();
    const sel=selectedMonthInfo_(),allowed=new Set(data.map(i=>normalizeStoreKey_(i.storeCode||i.store))),daily=new Map();
    officialRawData.forEach(r=>{if(r.date.getMonth()!==sel.month||r.date.getFullYear()!==sel.year)return;if(!allowed.has(normalizeStoreKey_(r.storeCode||r.store)))return;const d=r.date.getDate();if(!daily.has(d))daily.set(d,{sales:0});daily.get(d).sales+=r.netSales||0;});
    const days=new Date(sel.year,sel.month+1,0).getDate(),labels=[],sales=[];let running=0;for(let d=1;d<=days;d++){running+=(daily.get(d)?.sales||0);labels.push(String(d));sales.push(running);}
    salesChartInstance=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Cumulative MTD Sales',data:sales,borderColor:'#0891b2',backgroundColor:'rgba(6,182,212,.10)',borderWidth:3,pointRadius:3,fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>'Rp '+formatCompactOfficial_(v)}}},plugins:{legend:{position:'bottom'}}}});
}
function renderOfficialDashboard_(data){renderOfficialSummary_(data);renderOfficialTable_(data);if(currentSalesChartMode==='mtd')renderOfficialChart_(data);else renderOfficialTrendChart_(data);}
function renderSalesLoadError_(message){if(salesChartInstance){salesChartInstance.destroy();salesChartInstance=null;}const tbody=document.getElementById('sales-table-body');if(tbody)tbody.innerHTML=`<tr><td colspan="8" class="text-center py-8 text-sm font-bold text-rose-500">${escapeHtml_(message)}</td></tr>`;const count=document.getElementById('table-record-count');if(count)count.textContent='Data gagal dimuat';['summary-total-sales','summary-total-target','summary-avg-ach','summary-total-ly','summary-sssg','summary-proj-sssg'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='-';});}

/* ==========================================================================
   5. SUMMARY METRICS & CARDS
   ========================================================================== */
function renderSalesSummaryFiltered(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0;
    let totalSSSG = 0, totalProjSSSG = 0;
    let count = 0;

    data.forEach(item => {
        totalSales += item.mtdSales || 0;
        totalTarget += item.mtdTarget || 0;
        totalLY += item.salesLY || 0;
        totalSSSG += item.sssg || 0;
        totalProjSSSG += item.projSssg || 0;
        count++;
    });
    
    const avgAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    const avgSSSG = count > 0 ? (totalSSSG / count) : 0;
    const avgProjSSSG = count > 0 ? (totalProjSSSG / count) : 0;
    
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    setTxt('summary-total-sales', "Rp " + totalSales.toLocaleString('id-ID'));
    setTxt('summary-total-target', "Rp " + totalTarget.toLocaleString('id-ID'));
    setTxt('summary-avg-ach', avgAch + "%");
    setTxt('summary-total-ly', "Rp " + totalLY.toLocaleString('id-ID'));
    
    const elSSSG = document.getElementById('summary-sssg');
    const elProjSSSG = document.getElementById('summary-proj-sssg');
    
    if (elSSSG) {
        elSSSG.innerText = avgSSSG.toFixed(2) + "%";
        elSSSG.className = avgSSSG >= 0 ? "text-xl font-black text-emerald-500" : "text-xl font-black text-rose-500";
    }
    if (elProjSSSG) {
        elProjSSSG.innerText = avgProjSSSG.toFixed(2) + "%";
        elProjSSSG.className = avgProjSSSG >= 0 ? "text-xl font-black text-amber-500" : "text-xl font-black text-rose-500";
    }
}

/* ==========================================================================
   6. GRAFIK (WARNA ROSE RED & ORANGE MENYALA + LABEL PERSENTASE POLYGON)
   ========================================================================== */
function renderSalesChartFiltered(data) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    
    if (salesChartInstance) salesChartInstance.destroy();
    const sortedData = getCanonicalStoreOrder_(data);
    
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedData.map(item => item.store),
            datasets: [
                {
                    type: 'line',
                    label: 'Achievement (%)',
                    data: sortedData.map(item => item.achPercent || 0),
                    backgroundColor: '#6366f1', 
                    borderColor: '#6366f1', 
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    fill: false, 
                    tension: 0.35, 
                    yAxisID: 'y1' 
                },
                {
                    type: 'bar',
                    label: 'MTD Target',
                    backgroundColor: 'rgba(244, 63, 94, 0.85)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: sortedData.map(item => item.mtdTarget || 0),
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'MTD Sales',
                    backgroundColor: 'rgba(249, 115, 22, 0.9)',
                    borderColor: '#f97316',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: sortedData.map(item => item.mtdSales || 0),
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 40 } },
            scales: {
                x: { grid: { display: false } },
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true },
                y1: { type: 'linear', display: false, position: 'right', beginAtZero: true }
            },
            plugins: { legend: { position: 'bottom' } }
        },
        plugins: [{
            id: 'polygonPercentageLabels',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    if (dataset.type === 'line') { 
                        const meta = chart.getDatasetMeta(i);
                        if (!meta.hidden) {
                            meta.data.forEach((element, index) => {
                                ctx.fillStyle = '#4f46e5'; 
                                ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                const dataString = Number(dataset.data[index]).toFixed(1) + '%';
                                ctx.fillText(dataString, element.x, element.y - 8); 
                            });
                        }
                    }
                });
            }
        }]
    });
}

function monthKeyFromDate_(date) {
    const names=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${names[date.getMonth()]}${String(date.getFullYear()).slice(-2)}`;
}
function getLastSixMonthKeys_() {
    const now=new Date();
    const result=[];
    for(let offset=5;offset>=0;offset--){ const d=new Date(now.getFullYear(),now.getMonth()-offset,1); result.push(monthKeyFromDate_(d)); }
    return result;
}

async function fetchAndRenderTrendChart(kategori, spesifik) {
    const loader=document.getElementById('sales-loading'); if(loader)loader.classList.remove('hidden');
    const ctx=document.getElementById('salesTargetChart'); if(!ctx){if(loader)loader.classList.add('hidden');return;}
    const requestId=++currentTrendRequestId;
    try {
        const monthKeys=getLastSixMonthKeys_();
        const validData=(await Promise.all(monthKeys.map(async mKey=>{
            const gid=SHEET_GIDS[mKey]; if(!gid)return null;
            try {
                const res=await fetch(`${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`,{cache:'no-store'});
                if(!res.ok)throw new Error(`HTTP ${res.status}`);
                const parsed=parseSalesCSV(await res.text(),'SUBMISSION');
                let totalS=0,totalT=0;
                const selected=kategori!=='all'&&spesifik!=='all'?String(spesifik).trim().toLowerCase():null;
                parsed.forEach(i=>{
                    if(selected){
                        if(kategori==='store' && normalizeStoreKey_(i.storeCode||i.store).toLowerCase()!==normalizeStoreKey_(selected).toLowerCase() && String(i.store||'').trim().toLowerCase()!==selected)return;
                        if(kategori==='bm' && String(i.bm||'').trim().toLowerCase()!==selected)return;
                        if(kategori==='abm' && String(i.abm||'').trim().toLowerCase()!==selected)return;
                    }
                    totalS+=i.mtdSales||0; totalT+=i.mtdTarget||0;
                });
                return {month:mKey,achPercent:totalT>0?totalS/totalT*100:0};
            }catch(e){console.warn('Trend gagal',mKey,e);return null;}
        }))).filter(Boolean);
        if(requestId!==currentTrendRequestId)return;
        if(salesChartInstance)salesChartInstance.destroy();
        salesChartInstance=new Chart(ctx,{type:'line',data:{labels:validData.map(x=>x.month),datasets:[{label:'Trend Achievement (%)',data:validData.map(x=>x.achPercent),borderColor:'#f97316',backgroundColor:'rgba(249,115,22,.10)',borderWidth:3,pointRadius:5,pointBackgroundColor:'#fff',pointBorderColor:'#f97316',pointBorderWidth:2,fill:true,tension:.3}]},options:{responsive:true,maintainAspectRatio:false,layout:{padding:{top:37}},interaction:{mode:'index',intersect:false},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>v+'%'}}},plugins:{legend:{position:'bottom'}}}});
    } catch(e) { console.error('Trend error',e); }
    finally { if(loader)loader.classList.add('hidden'); }
}


/* ==========================================================================
   7. TABEL SALES STORE
   ========================================================================== */
function renderSalesTableFiltered(data) {
    const tbody=document.getElementById('sales-table-body'), count=document.getElementById('table-record-count');
    if(count)count.textContent=`Menampilkan ${data.length} Toko`; if(!tbody)return;
    const thead=tbody.previousElementSibling;
    if(thead)thead.innerHTML=`<tr>
        <th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th>
        <th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Sales</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Target</th>
        <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ach %</th>
        <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Sales LY</th>
        <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ach SSSG</th>
        <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Proj SSSG</th>
    </tr>`;
    if(!data.length){tbody.innerHTML=`<tr><td colspan="8" class="text-center py-8 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`;return;}
    const sorted=getCanonicalStoreOrder_(data);
    tbody.innerHTML=sorted.map((item,index)=>{
        const ach=Number(item.achPercent||0), sssg=Number(item.sssg||0), proj=Number(item.projSssg||0);
        const badge=ach>=100?'bg-emerald-50 text-emerald-600 border-emerald-200':ach>=80?'bg-amber-50 text-amber-600 border-amber-200':'bg-rose-50 text-rose-600 border-rose-200';
        const sssgCls=sssg>=0?'text-emerald-600':'text-rose-500', projCls=proj>=0?'text-cyan-600':'text-rose-500';
        return `<tr class="${index%2?'bg-slate-50/60':'bg-white'} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
            <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index+1}</td>
            <td class="px-5 py-4"><p class="font-bold text-sm text-slate-800">${escapeHtml_(item.store)}</p><p class="text-[10px] font-bold text-slate-400 uppercase">${escapeHtml_(item.storeCode||'-')}</p></td>
            <td class="px-5 py-4 text-right text-sm font-bold text-slate-700">Rp ${Math.round(item.mtdSales||0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Math.round(item.mtdTarget||0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center"><span class="px-3 py-1.5 rounded-xl text-[11px] font-black border ${badge}">${ach.toFixed(2)}%</span></td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${Math.round(item.salesLY||0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center text-sm font-black ${sssgCls}">${sssg.toFixed(2)}%</td>
            <td class="px-5 py-4 text-center text-sm font-black ${projCls}">${proj.toFixed(2)}%</td>
        </tr>`;
    }).join('');
}

/* ==========================================================================
   8. MODAL HANDLER & UPLOAD PDF OFFICIAL IT REPORT
   ========================================================================== */
window.openUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.remove('hidden');

    const input = document.getElementById('officialPdfInput');
    if (input) {
        input.value = '';
        input.multiple = true; // izinkan pilih lebih dari 1 file PDF sekaligus
    }

    const display = document.getElementById('pdfFileNameDisplay');
    if (display) display.textContent = "Klik atau seret file .PDF laporan ke sini (bisa pilih lebih dari 1 sekaligus)";

    const progContainer = document.getElementById('uploadProgressContainer');
    if (progContainer) progContainer.classList.add('hidden');

    const progressBar = document.getElementById('uploadProgressBar');
    if (progressBar) progressBar.style.width = '0%';

    const progressPct = document.getElementById('uploadProgressPct');
    if (progressPct) progressPct.textContent = '0%';

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
    if (!display) return;
    if (input.files && input.files.length > 0) {
        if (input.files.length === 1) {
            display.textContent = `📄 File terpilih: ${input.files[0].name}`;
        } else {
            const names = Array.from(input.files).map(f => f.name).join(', ');
            display.textContent = `📄 ${input.files.length} file terpilih: ${names}`;
        }
    } else {
        display.textContent = "Klik atau seret file .PDF laporan ke sini (bisa pilih lebih dari 1 sekaligus)";
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

/**
 * Upload PDF Official IT Report — MENDUKUNG MULTI-FILE.
 * Setiap file diproses berurutan; kalau ukurannya besar (mis. rekap
 * bulanan), file itu otomatis dipecah jadi beberapa bagian dulu (lihat
 * splitPdfIntoChunks_) sebelum diunggah. Kegagalan pada 1 file TIDAK
 * menghentikan file lain dalam batch yang sama — errornya dikumpulkan
 * dan dilaporkan di akhir, sementara file yang berhasil tetap tersimpan.
 */
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

    if (!input || !input.files || input.files.length === 0) {
        alert("Silakan pilih file PDF terlebih dahulu!");
        return;
    }

    const files = Array.from(input.files);
    // Tanggal per-baris tetap diambil dari isi PDF itu sendiri (setiap baris
    // punya tanggalnya sendiri, penting untuk PDF bulanan yang mencakup
    // banyak tanggal sekaligus) — input ini cuma label/metadata untuk log.
    const reportDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

    if (statusBox) statusBox.classList.add('hidden');
    if (progContainer) progContainer.classList.remove('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = "Mengunggah...";
    setProgress(5, files.length > 1 ? `Memeriksa ${files.length} file PDF...` : "Memeriksa ukuran PDF...");

    const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const aggregate = { count: 0, skippedCount: 0, duplicateCount: 0 };
    // Toko yang "hilang" di 1 chunk/file sangat mungkin justru ketemu di
    // chunk/file lain dalam batch yang sama — union foundStoreCodes dari
    // SEMUA file & chunk dulu, baru status hilang dihitung di akhir.
    const foundCodesUnion = new Set();
    let registeredStoreCodes = null;
    const fileErrors = []; // { fileName, message } — file yang gagal tidak menghentikan file lain dalam batch

    const trackResult = (result) => {
        aggregate.count += result.count || 0;
        aggregate.skippedCount += result.skippedCount || 0;
        aggregate.duplicateCount += result.duplicateCount || 0;
        (result.foundStoreCodes || []).forEach(c => foundCodesUnion.add(c));
        if (!registeredStoreCodes && result.registeredStoreCodes) registeredStoreCodes = result.registeredStoreCodes;
    };

    for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        const fileLabel = files.length > 1 ? `File ${fi + 1}/${files.length} (${file.name}): ` : '';
        const fileMeta = { batchId, fileIndex: fi + 1, totalFiles: files.length };
        const rangeStart = 5 + Math.round((fi / files.length) * 90);
        const rangeEnd = 5 + Math.round(((fi + 1) / files.length) * 90);
        const rangeSpan = rangeEnd - rangeStart;

        try {
            // 1. Cek jumlah halaman & pecah otomatis kalau terlalu besar untuk
            //    1x konversi (Google Docs yang dipakai backend untuk baca teks
            //    PDF punya batas ~1 juta karakter — PDF bulanan bisa jauh
            //    melebihi itu). Kalau pdf-lib gagal dimuat (mis. offline),
            //    lanjut sebagai upload tunggal — backend tetap punya penjaga.
            let splitInfo;
            try {
                splitInfo = await splitPdfIntoChunks_(file);
            } catch (splitErr) {
                console.warn("Gagal memeriksa/memecah PDF, lanjut sebagai upload tunggal:", splitErr);
                splitInfo = { totalPages: null, chunks: null };
            }

            if (!splitInfo.chunks) {
                // File cukup kecil (atau pdf-lib gagal dimuat) -> upload langsung, 1 request.
                setProgress(rangeStart + Math.round(rangeSpan * 0.3), `${fileLabel}Membaca dan mengirim file PDF...`);
                const base64Content = await readFileAsDataURL_(file);
                setProgress(rangeStart + Math.round(rangeSpan * 0.6), `${fileLabel}Melakukan lookup Store Code dan menyimpan ke Master...`);
                const result = await uploadPdfPayload_(file.name, base64Content, reportDate,
                    Object.assign({ chunkIndex: 1, totalChunks: 1 }, fileMeta));
                trackResult(result);
            } else {
                // File besar (mis. laporan bulanan) -> otomatis dipecah jadi
                // beberapa bagian dan diunggah berurutan. Aman diulang kalau
                // gagal di tengah: anti-duplikat Store Code + Tanggal di
                // backend otomatis melewati data yang sudah berhasil masuk.
                const total = splitInfo.chunks.length;
                for (const chunk of splitInfo.chunks) {
                    const pct = rangeStart + Math.round((chunk.index / total) * rangeSpan);
                    setProgress(pct, `${fileLabel}bagian ${chunk.index}/${total} (halaman ${chunk.startPage}-${chunk.endPage})...`);

                    const dataUrl = pdfBytesToDataURL_(chunk.bytes);
                    const chunkFileName = `${file.name} (hal ${chunk.startPage}-${chunk.endPage})`;
                    const result = await uploadPdfPayload_(chunkFileName, dataUrl, reportDate,
                        Object.assign({ chunkIndex: chunk.index, totalChunks: total }, fileMeta));
                    trackResult(result);
                }
            }
        } catch (fileErr) {
            // File ini gagal -> catat errornya, tapi LANJUT ke file berikutnya
            // dalam batch (jangan sampai 1 file rusak menggagalkan semuanya).
            console.error(`Gagal upload file ${file.name}:`, fileErr);
            fileErrors.push({ fileName: file.name, message: fileErr.message || String(fileErr) });
        }
    }

    try {
        setProgress(100, "Selesai!");

        const parts = [`${aggregate.count} baris data berhasil disimpan ke Master`];
        if (aggregate.duplicateCount > 0) parts.push(`${aggregate.duplicateCount} duplikat dilewati`);
        if (aggregate.skippedCount > 0) parts.push(`${aggregate.skippedCount} baris dilewati (kode toko tidak valid/tidak terdaftar)`);

        // Status hilang yang SEBENARNYA: toko terdaftar yang TIDAK ketemu
        // di SATUPUN chunk/file dari batch ini (bukan cuma 1 bagian tertentu).
        if (registeredStoreCodes) {
            const trulyMissing = registeredStoreCodes.filter(c => !foundCodesUnion.has(c));
            if (trulyMissing.length > 0) {
                parts.push(`⚠️ ${trulyMissing.length} toko TIDAK ketemu di seluruh file: ${trulyMissing.join(', ')}`);
            }
        }

        if (fileErrors.length > 0) {
            parts.push(`❌ ${fileErrors.length} dari ${files.length} file GAGAL diproses: ` +
                fileErrors.map(e => `${e.fileName} (${e.message})`).join('; '));
        }

        const filePrefix = files.length > 1 ? `${files.length} file diproses. ` : '';
        const overallOk = fileErrors.length === 0;

        showStatus(overallOk, filePrefix + parts.join(', ') + '.');

        if (overallOk) {
            if (btnText) btnText.textContent = "Berhasil Disimpan";
            setTimeout(() => {
                closeUploadPdfModal();
                if (typeof currentSalesSource !== 'undefined' && (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT')) {
                    fetchSalesData();
                }
            }, 2500);
        } else {
            // Ada file yang gagal -> jangan auto-close, biar pesan errornya
            // sempat dibaca. Aman diulang: file yang sudah sukses tidak akan
            // dobel berkat anti-duplikat Store Code + Tanggal di backend.
            if (progContainer) progContainer.classList.add('hidden');
            if (btnSubmit) btnSubmit.disabled = false;
            if (btnText) btnText.textContent = "Coba Lagi";
            if (typeof currentSalesSource !== 'undefined' && (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') && aggregate.count > 0) {
                fetchSalesData();
            }
        }

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
