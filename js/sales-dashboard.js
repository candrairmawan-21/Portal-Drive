/* ==========================================================================
   1. REGULASI DATA SALES & MAPPING GID SHEETS
   ========================================================================== */
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub';
let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd'; 

// GID sheet lengkap sesuai pembaruan Agustus 2026, September 2026, dan Oktober 2026
const SHEET_GIDS = {
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
   2. EKSEKUSI PEMUATAN AWAL & LABEL HARI
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    displayUpdateDate();
    initSalesSlicers();
    fetchSalesData();
    if (typeof fetchDashboardData === "function" && (typeof dashboardData === 'undefined' || dashboardData.length === 0)) {
        fetchDashboardData();
    }
});

function displayUpdateDate() {
    const dateEl = document.getElementById('update-date');
    if (dateEl) {
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        dateEl.innerText = "Update Terakhir: " + today;
    }
}

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
            if (typeof dashboardData !== 'undefined' && dashboardData.length > 0) {
                dashboardData.forEach(item => {
                    if (kategori === 'bm' && item.namaBM && item.namaBM !== "-") uniqueItems.add(item.namaBM.trim());
                    if (kategori === 'abm' && item.namaABM && item.namaABM !== "-") uniqueItems.add(item.namaABM.trim());
                    if (kategori === 'store' && item.namaStore && item.namaStore !== "-") uniqueItems.add(item.namaStore.trim());
                });
            } else {
                salesData.forEach(item => {
                    if (item.store) uniqueItems.add(item.store.trim());
                });
            }

            Array.from(uniqueItems).sort().forEach(name => {
                slicerSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applySalesFilters();
    });

    slicerSpesifik.addEventListener('change', applySalesFilters);
    slicerBulan.addEventListener('change', () => {
        fetchSalesData();
        if (typeof fetchAndRenderUptSalesTable === "function") fetchAndRenderUptSalesTable();
    }); 
}

/* ==========================================================================
   3. PENGAMBIL DATA PENJUALAN DARI GOOGLE SHEET (FETCH & PARSE)
   ========================================================================== */
async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        const selectedKey = document.getElementById('slicerBulanSales').value;
        const gid = SHEET_GIDS[selectedKey] || '1766415704';
        
        const finalUrl = `${SALES_BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
        const response = await fetch(finalUrl);
        const csvText = await response.text();
        
        salesData = parseSalesCSV(csvText);
        applySalesFilters();
    } catch (error) { 
        console.error('Error fetching data:', error); 
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function parseSalesCSV(text) {
    let lines = text.split('\n');
    if (lines.length < 3) return [];
    
    let headers = lines[2].split(',').map(h => h.replace(/["\r]/g, "").trim());
    let result = [];
    
    for (let i = 3; i < lines.length; i++) { 
        if (!lines[i].trim()) continue;
        let row = [];
        let inQuotes = false;
        let currentStr = "";
        
        for (let char of lines[i]) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; }
            else currentStr += char;
        }
        row.push(currentStr.trim());

        if (row.length >= 8) {
            let storeName = row[2]?.replace(/[\r"]/g, "").trim();
            if (!storeName || storeName === "" || storeName === "-") continue; 

            let getVal = (headerNames, fallbackIndex) => {
                for (let hName of headerNames) {
                    let idx = headers.indexOf(hName);
                    if (idx !== -1 && row[idx] !== undefined) {
                        return parseFloat(row[idx].replace(/[^0-9.-]+/g, "")) || 0;
                    }
                }
                return parseFloat(row[fallbackIndex]?.replace(/[^0-9.-]+/g, "")) || 0;
            };

            result.push({
                store: storeName,
                targetPoint: "-",
                mtdSales: parseFloat(row[5]?.replace(/[^0-9.-]+/g, "")) || 0,
                mtdTarget: parseFloat(row[6]?.replace(/[^0-9.-]+/g, "")) || 0,
                bestEstimate: row[16]?.replace(/[\r"]/g, "") || "-",
                achPercent: parseFloat(row[17]?.replace(/[^0-9.-]+/g, "")) || 0,
                
                salesLY: getVal(['Sales LY', 'LY Sales', 'LY'], 18),
                sssg: getVal(['SSSG', 'Ach SSSG'], 20),
                projSssg: getVal(['Projection SSSG', 'Proj SSSG', 'Projection'], 21)
            });
        }
    }
    return result;
}

/* ==========================================================================
   4. SISTEM FILTERING SALES & PERGANTIAN MODE GRAFIK
   ========================================================================== */
function applySalesFilters() {
    const kategori = document.getElementById('slicerKategoriSales')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifikSales')?.value || 'all';

    let filteredSales = [...salesData]; 

    if (kategori !== 'all' && spesifik !== 'all') {
        const allowedStores = new Set();
        
        if (typeof dashboardData !== 'undefined' && dashboardData.length > 0) {
            dashboardData.forEach(item => {
                if (kategori === 'bm' && item.namaBM === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                else if (kategori === 'abm' && item.namaABM === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                else if (kategori === 'store' && item.namaStore === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
            });
        } else if (kategori === 'store') {
            allowedStores.add(spesifik.toLowerCase().trim());
        }

        if (allowedStores.size > 0) {
            filteredSales = salesData.filter(item => allowedStores.has(item.store.toLowerCase().trim()));
        }
    }

    renderSalesSummaryFiltered(filteredSales);
    renderSalesTableFiltered(filteredSales);

    if (currentSalesChartMode === 'mtd') {
        renderSalesChartFiltered(filteredSales);
    } else {
        fetchAndRenderTrendChart(kategori, spesifik);
    }
}

function setSalesChartMode(mode) {
    currentSalesChartMode = mode;
    
    const btnMtd = document.getElementById('btnModeMtd');
    const btnTrend = document.getElementById('btnModeTrend');
    
    if (mode === 'mtd') {
        btnMtd.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        btnTrend.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    } else {
        btnTrend.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        btnMtd.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    }
    
    applySalesFilters();
}

/* ==========================================================================
   5. RANGKUMAN PENJUALAN (SUMMARY METRICS)
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
    
    const elTotalSales = document.getElementById('summary-total-sales');
    const elTarget = document.getElementById('summary-total-target');
    const elAvgAch = document.getElementById('summary-avg-ach');
    const elLY = document.getElementById('summary-total-ly');
    const elSSSG = document.getElementById('summary-sssg');
    const elProjSSSG = document.getElementById('summary-proj-sssg');
    
    if (elTotalSales) elTotalSales.innerText = "Rp " + totalSales.toLocaleString('id-ID');
    if (elTarget) elTarget.innerText = "Rp " + totalTarget.toLocaleString('id-ID');
    if (elAvgAch) elAvgAch.innerText = avgAch + "%";
    if (elLY) elLY.innerText = "Rp " + totalLY.toLocaleString('id-ID');
    
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
   6. PENGGAMBARAN GRAFIK (CHART TARGET BULANAN VS TREN 6 BULAN)
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
                    backgroundColor: '#f43f5e', 
                    borderColor: '#f43f5e', 
                    borderWidth: 2.5,
                    pointRadius: 4.5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderWidth: 2,
                    fill: false, 
                    tension: 0.35, 
                    yAxisID: 'y1' 
                },
                {
                    type: 'bar',
                    label: 'MTD Target',
                    backgroundColor: '#cbd5e1', 
                    borderColor: '#94a3b8',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdTarget || 0),
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'MTD Sales',
                    backgroundColor: '#6366f1', 
                    borderColor: '#4f46e5',
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
            interaction: { mode: 'index', intersect: false },
            layout: { padding: { top: 30 } },
            scales: {
                x: { 
                    grid: { display: false },
                    ticks: { font: { weight: '600', family: "'Plus Jakarta Sans', sans-serif" } }
                },
                y: { 
                    type: 'linear', display: true, position: 'left', beginAtZero: true, 
                    grid: { color: '#f8fafc' },
                    ticks: { 
                        callback: function(value) { if (value >= 1000000) return 'Rp ' + (value / 1000000) + ' Jt'; return value; },
                        font: { family: "'Plus Jakarta Sans', sans-serif" }
                    }
                },
                y1: { type: 'linear', display: false, position: 'right', beginAtZero: true }
            },
            plugins: {
                legend: { 
                    position: 'top', 
                    labels: { boxWidth: 12, font: { weight: '700', family: "'Plus Jakarta Sans', sans-serif" } } 
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    titleFont: { family: "'Plus Jakarta Sans', sans-serif", weight: 'bold' },
                    bodyFont: { family: "'Plus Jakarta Sans', sans-serif" },
                    padding: 12,
                    cornerRadius: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.dataset.type === 'line') {
                                label += context.parsed.y.toFixed(1) + '%';
                            } else {
                                label += 'Rp ' + context.parsed.y.toLocaleString('id-ID');
                            }
                            return label;
                        }
                    }
                }
            }
        },
        plugins: [{
            id: 'customDataLabelsSales',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    if (dataset.type === 'line') { 
                        const meta = chart.getDatasetMeta(i);
                        if (!meta.hidden) {
                            meta.data.forEach((element, index) => {
                                ctx.fillStyle = '#e11d48'; 
                                ctx.font = 'bold 10px "Plus Jakarta Sans", sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                const dataString = dataset.data[index].toFixed(1) + '%';
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
        const currentMonthKey = document.getElementById('slicerBulanSales').value;
        const monthKeys = ['Oct26', 'Sep26', 'Aug26', 'Jul26', 'Jun26', 'May26', 'Apr26', 'Mar26', 'Feb26', 'Jan26', 'Dec25', 'Nov25'];
        
        let currentIndex = monthKeys.indexOf(currentMonthKey);
        if (currentIndex === -1) currentIndex = 0;
        let targetMonths = monthKeys.slice(currentIndex, currentIndex + 6).reverse(); 
        
        let promises = targetMonths.map(async (mKey) => {
            const gid = SHEET_GIDS[mKey];
            if (!gid || gid === '0') return null;
            try {
                const res = await fetch(`${SALES_BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`);
                const csv = await res.text();
                const parsed = parseSalesCSV(csv);
                
                const allowedStores = new Set();
                if (kategori !== 'all' && spesifik !== 'all') {
                    if (typeof dashboardData !== 'undefined') {
                        dashboardData.forEach(item => {
                            if (kategori === 'bm' && item.namaBM === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                            else if (kategori === 'abm' && item.namaABM === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                            else if (kategori === 'store' && item.namaStore === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                        });
                    }
                }

                let filtered = (kategori !== 'all' && spesifik !== 'all') ? parsed.filter(item => allowedStores.has(item.store.toLowerCase().trim())) : parsed;
                let totalS = 0, totalT = 0;
                filtered.forEach(i => { totalS += i.mtdSales; totalT += i.mtdTarget; });
                let avgAch = totalT > 0 ? (totalS / totalT) * 100 : 0;
                
                return { month: mKey, achPercent: avgAch };
            } catch (e) { return null; }
        });

        let results = await Promise.all(promises);
        let validData = results.filter(item => item !== null);

        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validData.map(item => item.month),
                datasets: [{
                    label: 'Trend Achievement (%)',
                    data: validData.map(item => item.achPercent),
                    backgroundColor: 'rgba(99, 102, 241, 0.1)', 
                    borderColor: '#6366f1', 
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3,
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 25 } },
                scales: {
                    x: { grid: { display: false } },
                    y: { 
                        display: true, 
                        ticks: { callback: function(val) { return val + '%'; }, font: { weight: 'bold' } }
                    }
                },
                plugins: { legend: { display: false } } 
            },
            plugins: [{
                id: 'trendLabels',
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            ctx.fillStyle = '#4f46e5';
                            ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                            ctx.textAlign = 'center';
                            const val = chart.data.datasets[0].data[index].toFixed(1) + '%';
                            ctx.fillText(val, element.x, element.y - 12);
                        });
                    }
                }
            }]
        });

    } catch (error) { console.error(error); } 
    finally { if (loader) loader.classList.add('hidden'); }
}

/* ==========================================================================
   7. PENGGAMBARAN TABEL PENJUALAN PER TOKO
   ========================================================================== */
function renderSalesTableFiltered(data) {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`;
        return;
    }

    let sortedData = [...data].sort((a, b) => (b.achPercent || 0) - (a.achPercent || 0));

    tbody.innerHTML = sortedData.map((item, index) => {
        let ach = item.achPercent || 0;
        let badgeHTML = '';
        
        if (ach > 110) {
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-amber-200 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> ELITE</div>`;
        } else if (ach > 100.1) {
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-indigo-100"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> PRO</div>`;
        } else if (ach >= 95.1) {
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1.5 bg-sky-50 text-sky-500 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-sky-100"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> DIKIT LAGI!</div>`;
        } else {
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1 bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-rose-100"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> FAILURE</div>`;
        }

        let rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

        return `
        <tr class="${rowBgClass} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
            <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
            <td class="px-5 py-4">
                <p class="font-bold text-sm text-slate-800">${item.store}</p>
                ${badgeHTML}
            </td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdSales || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdTarget || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${item.bestEstimate || '-'}</td>
            <td class="px-5 py-4 text-center">
                <span class="px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider ${
                    ach >= 100
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                    : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                }">
                    ${ach.toFixed(2)}%
                </span>
            </td>
        </tr>
        `;
    }).join('');
}

/* ==========================================================================
   8. TABEL RANGKUMAN UPT (DIAMBIL SECARA KHUSUS DARI CSV SALES)
   ========================================================================== */
async function fetchAndRenderUptSalesTable() {
    const tbody = document.getElementById('upt-sales-table-body');
    if (!tbody) return;

    try {
        const selectedKey = document.getElementById('slicerBulanSales')?.value || 'Aug26';
        const gid = SHEET_GIDS[selectedKey] || '1766415704';
        
        const finalUrl = `${SALES_BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
        const response = await fetch(finalUrl);
        const csvText = await response.text();
        const lines = csvText.split('\n');

        const kategoriSlicer = document.getElementById('slicerKategori')?.value || 'all';
        const spesifikSlicer = document.getElementById('slicerSpesifik')?.value || 'all';

        const allowedStores = new Set();
        if (kategoriSlicer !== 'all' && spesifikSlicer !== 'all') {
            if (typeof dashboardData !== 'undefined') {
                dashboardData.forEach(item => {
                    if (kategoriSlicer === 'bm' && item.namaBM === spesifikSlicer) {
                        allowedStores.add(item.namaStore.toLowerCase().trim());
                    } else if (kategoriSlicer === 'abm' && item.namaABM === spesifikSlicer) {
                        allowedStores.add(item.namaStore.toLowerCase().trim());
                    }
                });
            }
        }

        let rawRows = [];

        for (let i = 3; i < lines.length; i++) {
            if (!lines[i].trim()) continue;
            let row = parseCSVRowForUpt(lines[i]);

            let namaStore = row[2] ? row[2].replace(/[\r"]/g, "").trim() : "-";
            if (!namaStore || namaStore === "" || namaStore === "-") continue;

            if (kategoriSlicer !== 'all' && spesifikSlicer !== 'all') {
                if (!allowedStores.has(namaStore.toLowerCase().trim())) continue; 
            }

            let mtdUpt = row[13] ? row[13].replace(/[\r"]/g, "").trim() : "0";
            let targetUpt = row[14] ? row[14].replace(/[\r"]/g, "").trim() : "0";
            let achUptStr = row[15] ? row[15].replace(/[\r"%]/g, "").trim() : "0";
            let achUptNum = parseFloat(achUptStr) || 0;

            rawRows.push({
                store: namaStore,
                mtdUpt: mtdUpt,
                targetUpt: targetUpt,
                achNum: achUptNum,
                achFormatted: row[15] ? row[15].replace(/[\r"]/g, "").trim() : "0%"
            });
        }

        rawRows.sort((a, b) => b.achNum - a.achNum);
        if (typeof renderChartPerforma === "function") renderChartPerforma(rawRows);

        let tableRowsHTML = '';
        
        rawRows.forEach((item, index) => {
            let ach = item.achNum;
            let badgeHTML = '';

            if (ach >= 100) {
                badgeHTML = `<span class="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200/60 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> ${item.achFormatted}</span>`;
            } else if (ach > 90 && ach < 100) {
                badgeHTML = `<span class="inline-flex items-center gap-1.5 bg-sky-50 text-sky-600 border border-sky-200/60 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> ${item.achFormatted}</span>`;
            } else {
                badgeHTML = `<span class="inline-flex items-center gap-1.5 bg-rose-50 text-rose-600 border border-rose-200/60 px-3 py-1.5 rounded-xl text-[11px] font-black tracking-wider"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ${item.achFormatted}</span>`;
            }

            let rowBgClass = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/65';

            tableRowsHTML += `
                <tr class="${rowBgClass} hover:bg-amber-50/30 transition-colors">
                    <td class="px-5 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
                    <td class="px-5 py-4 font-bold text-sm text-slate-800">${item.store}</td>
                    <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${item.mtdUpt}</td>
                    <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${item.targetUpt}</td>
                    <td class="px-5 py-4 text-center">${badgeHTML}</td>
                </tr>
            `;
        });

        if (rawRows.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data UPT ditemukan untuk filter ini</td></tr>`;
        } else {
            tbody.innerHTML = tableRowsHTML;
        }

        if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch (error) {
        console.error('Gagal memuat tabel UPT Sales:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-rose-400">Gagal memuat data dari CSV Sales</td></tr>`;
    }
}

function parseCSVRowForUpt(textLine) {
    let row = []; let inQuotes = false; let currentStr = "";
    for (let char of textLine) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; }
        else currentStr += char;
    }
    row.push(currentStr.trim());
    return row;
}
