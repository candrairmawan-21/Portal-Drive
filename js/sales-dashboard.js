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

    if (sourceType === 'OFFICIAL_IT' || sourceType === 'OFFICIAL_IT_REPORT') {
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
        if (slicerBulan) slicerBulan.disabled = false; // Tetap aktif agar bisa pilih bulan
    } else {
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
        if (slicerBulan) slicerBulan.disabled = false;
    }

    fetchSalesData();
};

function initSalesSlicers() {
    const slicerBulan = document.getElementById('slicerBulanSales');
    const slicerKategori = document.getElementById('slicerKategoriSales');
    const slicerSpesifik = document.getElementById('slicerSpesifikSales');

    if (!slicerKategori || !slicerSpesifik) return;

    slicerKategori.addEventListener('change', function() {
        const kategori = this.value;
        slicerSpesifik.innerHTML = '<option value="all">-- Semua --</option>';
        
        if (kategori === 'all') {
            slicerSpesifik.disabled = true;
            slicerSpesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        } else {
            slicerSpesifik.disabled = false;
            slicerSpesifik.classList.remove('bg-slate-100', 'cursor-not-allowed');
            
            let uniqueItems = new Set();
            salesData.forEach(item => {
                if (kategori === 'store' && item.store && item.store !== "-") {
                    uniqueItems.add(item.store.trim());
                } else if (kategori === 'bm' && item.bm && item.bm !== "-") {
                    uniqueItems.add(item.bm.trim());
                } else if (kategori === 'abm' && item.abm && item.abm !== "-") {
                    uniqueItems.add(item.abm.trim());
                }
            });

            Array.from(uniqueItems).sort().forEach(name => {
                slicerSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applySalesFilters();
    });

    slicerSpesifik.addEventListener('change', applySalesFilters);
    if (slicerBulan) {
        slicerBulan.addEventListener('change', () => {
            fetchSalesData();
            if (typeof fetchAndRenderUptSalesTable === "function") fetchAndRenderUptSalesTable();
        });
    }
}

/* ==========================================================================
   3. DATA FETCHING & SMART PARSER CSV
   ========================================================================== */
async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        let finalUrl = '';
        
        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            const gid = SHEET_GIDS['OFFICIAL_IT_REPORT'] || '1129267198';
            // Gunakan SALES_BASE_URL agar terhindar dari pemblokiran CORS browser
            finalUrl = `${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`;
        } else {
            // Menggunakan link publikasi pub?output=csv untuk data bulanan
            const selectedKey = document.getElementById('slicerBulanSales')?.value || 'Aug26';
            let gid = SHEET_GIDS[selectedKey] || '1766415704';
            finalUrl = `${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`;
        }
        
        const response = await fetch(finalUrl);
        const csvText = await response.text();
        
        salesData = parseSalesCSV(csvText, currentSalesSource);
        applySalesFilters();
    } catch (error) { 
        console.error('Error fetching data:', error); 
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function parseSalesCSV(text, sourceMode) {
    let lines = text.split('\n');
    if (lines.length < 2) return [];
    
    let headerRowIdx = (sourceMode === 'OFFICIAL_IT' || sourceMode === 'OFFICIAL_IT_REPORT') ? 0 : (lines.length > 2 ? 2 : 0);
    let headers = parseCSVLine(lines[headerRowIdx]).map(h => h.trim().toLowerCase());
    let result = [];
    
    // Persiapan Filter Bulan untuk Official IT
    const selectedMonthStr = document.getElementById('slicerBulanSales')?.value || 'Aug26';
    const monthsMap = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
    const filterMonth = monthsMap[selectedMonthStr.substring(0, 3)];
    const filterYear = parseInt("20" + selectedMonthStr.substring(3));

    let officialMap = {};
    
    for (let i = headerRowIdx + 1; i < lines.length; i++) { 
        if (!lines[i].trim()) continue;
        let row = parseCSVLine(lines[i]);

        let getVal = (headerNames, fallbackIndex) => {
            for (let hName of headerNames) {
                let idx = headers.indexOf(hName.toLowerCase());
                if (idx !== -1 && row[idx] !== undefined) {
                    return parseFloat(String(row[idx]).replace(/[^0-9.-]+/g, "")) || 0;
                }
            }
            return parseFloat(String(row[fallbackIndex] || "").replace(/[^0-9.-]+/g, "")) || 0;
        };

        let getStr = (headerNames, fallbackIndex) => {
            for (let hName of headerNames) {
                let idx = headers.indexOf(hName.toLowerCase());
                if (idx !== -1 && row[idx] !== undefined) return String(row[idx]).trim();
            }
            return String(row[fallbackIndex] || "-").trim();
        };

        if (sourceMode === 'OFFICIAL_IT' || sourceMode === 'OFFICIAL_IT_REPORT') {
            // Cek Kolom C (Date)
            let dateStr = getStr(['date', 'tanggal'], 2);
            let rowDate = null;
            let dateParts = dateStr.split(/[-/]/);
            
            // Format fleksibel DD/MM/YYYY atau YYYY-MM-DD
            if (dateParts.length === 3) {
                if (dateParts[0].length === 4) {
                    rowDate = new Date(dateParts[0], parseInt(dateParts[1]) - 1, dateParts[2]);
                } else {
                    rowDate = new Date(dateParts[2], parseInt(dateParts[1]) - 1, dateParts[0]);
                }
            } else {
                rowDate = new Date(dateStr);
            }

            // Skip jika data tidak valid atau beda bulan
            if (rowDate && !isNaN(rowDate.getTime())) {
                if (rowDate.getMonth() !== filterMonth || rowDate.getFullYear() !== filterYear) {
                    continue; 
                }
            } else {
                continue;
            }

            let storeCode = getStr(['store code', 'kode toko'], 0);
            let storeName = getStr(['store name', 'store', 'nama toko'], 1);
            if (!storeName || storeName === "" || storeName === "-") continue;

            let netSales = getVal(['net sales', 'sales'], 4);
            let qtySold = getVal(['qty sold', 'qty'], 11);
            let trxCount = getVal(['trx count', 'trx'], 12);

            if (!officialMap[storeName]) {
                officialMap[storeName] = {
                    storeCode: storeCode,
                    store: storeName,
                    bm: "-",
                    abm: "-",
                    mtdSales: 0,
                    qtySold: 0,
                    trxCount: 0,
                    // Field standar agar chart tidak rusak
                    mtdTarget: 0, achPercent: 0, bestEstimate: "-", salesLY: 0, sssg: 0, projSssg: 0
                };
            }

            // Sum / Agregasi
            officialMap[storeName].mtdSales += netSales;
            officialMap[storeName].qtySold += qtySold;
            officialMap[storeName].trxCount += trxCount;

        } else {
            // LOGIC LAMA UNTUK STORE SUBMISSION (Mode Default)
            let storeName = getStr(['store name', 'store_name', 'store', 'nama toko'], 1);
            if (!storeName || storeName === "" || storeName === "-") continue; 

            let mtdSalesVal = getVal(['net sales', 'net_sales', 'mtd sales', 'sales mtd'], 4);
            let mtdTargetVal = getVal(['target sales', 'target_sales', 'mtd target', 'target'], 5);
            let achVal = getVal(['achievement', 'ach percent', '% ach', 'ach'], 17);

            if (achVal === 0 && mtdTargetVal > 0) {
                achVal = (mtdSalesVal / mtdTargetVal) * 100;
            }

            result.push({
                storeCode: getStr(['store code', 'store_code', 'kode toko'], 0),
                store: storeName,
                bm: getStr(['nama bm', 'bm', 'branch manager'], 2),
                abm: getStr(['nama abm', 'abm', 'asst branch manager'], 3),
                mtdSales: mtdSalesVal,
                mtdTarget: mtdTargetVal,
                bestEstimate: getStr(['best estimate', 'best_estimate', 'estimate'], 16),
                achPercent: achVal,
                salesLY: getVal(['sales ly', 'ly sales', 'ly'], 18),
                sssg: getVal(['sssg', 'ach sssg'], 20),
                projSssg: getVal(['projection sssg', 'proj sssg', 'projection'], 21)
            });
        }
    }

    // Hitung ATV dan UPT & Push ke Result jika Official IT
    if (sourceMode === 'OFFICIAL_IT' || sourceMode === 'OFFICIAL_IT_REPORT') {
        for (let key in officialMap) {
            let item = officialMap[key];
            item.atv = item.trxCount > 0 ? item.mtdSales / item.trxCount : 0;
            item.upt = item.trxCount > 0 ? item.qtySold / item.trxCount : 0;
            result.push(item);
        }
    }

    return result;
}

function parseCSVLine(textLine) {
    let row = [];
    let inQuotes = false;
    let currentStr = "";
    for (let char of textLine) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; }
        else currentStr += char;
    }
    row.push(currentStr.trim());
    return row.map(cell => cell.replace(/^"|"$/g, '').trim());
}

/* ==========================================================================
   4. SYSTEM FILTERING SALES
   ========================================================================== */
function applySalesFilters() {
    const kategori = document.getElementById('slicerKategoriSales')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifikSales')?.value || 'all';

    let filteredSales = [...salesData]; 

    if (kategori !== 'all' && spesifik !== 'all') {
        filteredSales = salesData.filter(item => {
            if (kategori === 'bm') return item.bm.toLowerCase() === spesifik.toLowerCase();
            if (kategori === 'abm') return item.abm.toLowerCase() === spesifik.toLowerCase();
            if (kategori === 'store') return item.store.toLowerCase() === spesifik.toLowerCase();
            return true;
        });
    }

    renderSalesSummaryFiltered(filteredSales);
    renderSalesTableFiltered(filteredSales);

    if (currentSalesChartMode === 'mtd') {
        renderSalesChartFiltered(filteredSales);
    } else {
        fetchAndRenderTrendChart(kategori, spesifik);
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
    
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.store),
            datasets: [
                {
                    type: 'line',
                    label: 'Achievement (%)',
                    data: data.map(item => item.achPercent || 0),
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
                    data: data.map(item => item.mtdTarget || 0),
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'MTD Sales',
                    backgroundColor: 'rgba(249, 115, 22, 0.9)',
                    borderColor: '#f97316',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdSales || 0),
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

async function fetchAndRenderTrendChart(kategori, spesifik) {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;

    try {
        const monthKeys = ['Oct26', 'Sep26', 'Aug26', 'Jul26', 'Jun26', 'May26'].reverse(); 
        let promises = monthKeys.map(async (mKey) => {
            const gid = SHEET_GIDS[mKey];
            if (!gid) return null;
            try {
                const res = await fetch(`${SALES_BASE_URL}&gid=${gid}`);
                const parsed = parseSalesCSV(await res.text(), 'SUBMISSION');
                let totalS = 0, totalT = 0;
                parsed.forEach(i => { totalS += i.mtdSales; totalT += i.mtdTarget; });
                return { month: mKey, achPercent: totalT > 0 ? (totalS / totalT) * 100 : 0 };
            } catch (e) { return null; }
        });

        let validData = (await Promise.all(promises)).filter(item => item !== null);
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validData.map(item => item.month),
                datasets: [{
                    label: 'Trend Achievement (%)',
                    data: validData.map(item => item.achPercent),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#f97316',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                layout: { padding: { top: 37 } }
            },
            plugins: [{
                id: 'trendPolygonLabels',
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            ctx.fillStyle = '#c2410c';
                            ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                            ctx.textAlign = 'center';
                            const val = Number(chart.data.datasets[0].data[index]).toFixed(1) + '%';
                            ctx.fillText(val, element.x, element.y - 10);
                        });
                    }
                }
            }]
        });
    } catch (e) { console.error(e); } 
    finally { if (loader) loader.classList.add('hidden'); }
}

/* ==========================================================================
   7. TABEL SALES STORE
   ========================================================================== */
function renderSalesTableFiltered(data) {
    const tbody = document.getElementById('sales-table-body');
    const countLabel = document.getElementById('table-record-count');
    
    if (countLabel) {
        countLabel.textContent = `Menampilkan ${data.length} Toko`;
    }

    if (!tbody) return;

    // Dinamis update Tabel Header (thead)
    const thead = tbody.previousElementSibling; 
    if (thead) {
        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            thead.innerHTML = `<tr>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th>
                <th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Total Sales</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">QTY Sold</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Trx Count</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">ATV & UPT</th>
            </tr>`;
        } else {
            thead.innerHTML = `<tr>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th>
                <th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Sales</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Target</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Est.</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ach %</th>
            </tr>`;
        }
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`;
        return;
    }

    // Jika Official IT di-sort berdasarkan Sales tertinggi, jika tidak berdasarkan Achievement
    let sortedData = [...data].sort((a, b) => {
        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            return (b.mtdSales || 0) - (a.mtdSales || 0);
        }
        return (b.achPercent || 0) - (a.achPercent || 0);
    });

    tbody.innerHTML = sortedData.map((item, index) => {
        let rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            return `
            <tr class="${rowBg} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
                <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
                <td class="px-5 py-4">
                    <p class="font-bold text-sm text-slate-800">${item.store}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">${item.storeCode || '-'}</p>
                </td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdSales || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${(item.qtySold || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${(item.trxCount || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center">
                    <p class="text-xs font-bold text-emerald-600">ATV: Rp ${(item.atv || 0).toLocaleString('id-ID', {maximumFractionDigits:0})}</p>
                    <p class="text-[11px] font-semibold text-indigo-500">UPT: ${(item.upt || 0).toFixed(2)}</p>
                </td>
            </tr>
            `;
        } else {
            let ach = item.achPercent || 0;
            let badgeBg = ach >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                         (ach >= 80 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200');

            return `
            <tr class="${rowBg} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
                <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
                <td class="px-5 py-4">
                    <p class="font-bold text-sm text-slate-800">${item.store}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">${item.storeCode || '-'}</p>
                </td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdSales || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdTarget || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${item.bestEstimate || '-'}</td>
                <td class="px-5 py-4 text-center">
                    <span class="px-3 py-1.5 rounded-xl text-[11px] font-black border ${badgeBg}">
                        ${ach.toFixed(2)}%
                    </span>
                </td>
            </tr>
            `;
        }
    }).join('');
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

        if (!splitInfo.chunks) {
            // File cukup kecil (atau pdf-lib gagal dimuat) -> upload langsung, 1 request.
            setProgress(30, "Membaca dan mengirim file PDF...");
            const base64Content = await readFileAsDataURL_(file);
            setProgress(60, "Melakukan lookup Store Code dan menyimpan ke Master...");
            const result = await uploadPdfPayload_(file.name, base64Content, reportDate, { batchId, chunkIndex: 1, totalChunks: 1 });
            aggregate.count += result.count || 0;
            aggregate.skippedCount += result.skippedCount || 0;
            aggregate.duplicateCount += result.duplicateCount || 0;
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

                aggregate.count += result.count || 0;
                aggregate.skippedCount += result.skippedCount || 0;
                aggregate.duplicateCount += result.duplicateCount || 0;
            }
        }

        setProgress(100, "Selesai!");

        const parts = [`${aggregate.count} baris data berhasil disimpan ke Master`];
        if (aggregate.duplicateCount > 0) parts.push(`${aggregate.duplicateCount} duplikat dilewati`);
        if (aggregate.skippedCount > 0) parts.push(`${aggregate.skippedCount} baris dilewati (kode toko tidak valid/tidak terdaftar)`);
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
