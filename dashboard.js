// =====================================================================
// 1. CONFIG & GLOBAL VARIABLES (GABUNGAN UPT & SALES)
// =====================================================================

// --- VARIABLE DARI UPT DASHBOARD ---
const DASHBOARD_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=425930614&single=true&output=csv';
let dashboardData = [];
let chartInstance = null;

// --- VARIABLE DARI SALES DASHBOARD ---
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub';
let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd'; // Mode default saat halaman dibuka
const SHEET_GIDS = {
    'Jul26': '1248782513', 'Jun26': '511605214', 'May26': '2012772985',
    'Apr26': '544207481', 'Mar26': '90936589', 'Feb26': '472876079',
    'Jan26': '171319040', 'Dec25': '236016326', 'Nov25': '564328385',
    'Oct25': '0', 'Sep25': '0', 'Aug25': '0'
};

// =====================================================================
// 2. INITIALIZATION (SAAT HALAMAN PERTAMA KALI DIMUAT)
// =====================================================================
document.addEventListener('DOMContentLoaded', () => {
    renderLoggedInUser();
    fetchDashboardData();
    displayUpdateDate();
    initSalesSlicers();
    fetchSalesData();
});

// =====================================================================
// 3. FITUR UMUM PROFIL USER
// =====================================================================

function renderLoggedInUser() {
    const userName = sessionStorage.getItem('portalUser') || 'Guest User';
    const userRole = sessionStorage.getItem('portalRole') || 'Staff';

    const userContainer = document.getElementById('fileTools') || 
                          document.querySelector('header .container > div:last-child') ||
                          document.querySelector('header .flex.items-center.gap-4');

    if (userContainer) {
        const existingBadge = document.getElementById('dynamic-user-badge');
        if (existingBadge) existingBadge.remove();

        const badgeHTML = `
            <div id="dynamic-user-badge" class="flex items-center gap-3 bg-slate-800 px-4 py-2 rounded-xl shadow-sm ml-2">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-bold text-white leading-none capitalize">Hi ${userName}</p>
                    <p class="text-[10px] text-slate-300 font-medium tracking-wide mt-1">role anda <span class="text-amber-400 font-bold uppercase">${userRole}</span></p>
                </div>
                <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white font-black text-sm shadow-sm uppercase flex-shrink-0">
                    ${userName.charAt(0)}
                </div>
            </div>
        `;
        userContainer.insertAdjacentHTML('beforeend', badgeHTML);
    }
}

// =====================================================================
// 4. CORE LOGIC: DASHBOARD UPT
// =====================================================================

async function fetchDashboardData() {
    const container = document.getElementById('dashboard-loading');
    if (container) container.classList.remove('hidden');

    try {
        const response = await fetch(DASHBOARD_API_URL);
        const csvText = await response.text();
        dashboardData = parseDashboardCSV(csvText);
        
        initSlicers();
        applyDashboardFilters();
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
                uptJuly: parseFloat(row[5].replace(/[\r"]/g, "")) || 0
            });
        }
    }
    return result;
}

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
                if (kategori === 'bm' && item.namaBM) uniqueItems.add(item.namaBM);
                if (kategori === 'abm' && item.namaABM) uniqueItems.add(item.namaABM);
            });

            Array.from(uniqueItems).sort().forEach(name => {
                targetSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applyDashboardFilters();
    });

    document.getElementById('slicerBulan')?.addEventListener('change', applyDashboardFilters);
    document.getElementById('slicerSpesifik')?.addEventListener('change', applyDashboardFilters);
}

function applyDashboardFilters() {
    const kategori = document.getElementById('slicerKategori')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifik')?.value || 'all';

    let filteredData = [...dashboardData];

    if (kategori === 'bm') {
        if (spesifik !== 'all') filteredData = filteredData.filter(item => item.namaBM === spesifik);
    } else if (kategori === 'abm') {
        if (spesifik !== 'all') filteredData = filteredData.filter(item => item.namaABM === spesifik);
    }

    renderPodiumTop3(filteredData);
    renderPodiumBottom3(filteredData);
    renderChartPerforma(filteredData);
}

function renderPodiumTop3(data) {
    const container = document.getElementById('podium-top-content');
    if (!container) return;

    let sorted = [...data].sort((a, b) => b.uptJuly - a.uptJuly);
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'top');
}

function renderPodiumBottom3(data) {
    const container = document.getElementById('podium-bottom-content');
    if (!container) return;

    let validData = data.filter(item => item.uptJuly > 0);
    if (validData.length === 0) validData = data;

    let sorted = [...validData].sort((a, b) => a.uptJuly - b.uptJuly);
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

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
                    <span class="inline-block mt-1 text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p2.uptJuly}</span>
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
                    <span class="inline-block mt-1 text-xs font-black text-white bg-gradient-to-r ${colorClass.badge1} px-2.5 py-0.5 rounded-lg shadow-sm">${p1.uptJuly}</span>
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
                    <span class="inline-block mt-1 text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p3.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-orange-100 to-orange-50/40 h-14 rounded-t-2xl border-t-2 border-orange-200 flex items-center justify-center relative shadow-sm">
                    <span class="text-xl font-black text-orange-400">3</span>
                </div>
            </div>
        </div>
    `;
}

function renderChartPerforma(data) {
    const ctx = document.getElementById('bmChart');
    if (!ctx) return;

    let performanceMap = {};
    const kategoriSlicer = document.getElementById('slicerKategori')?.value || 'all';
    const spesifikSlicer = document.getElementById('slicerSpesifik')?.value || 'all';

    data.forEach(item => {
        let key = item.namaBM; 
        if (kategoriSlicer === 'abm') key = item.namaABM;
        if (spesifikSlicer !== 'all') key = item.namaStaff; 

        if (key && key !== "-") {
            performanceMap[key] = (performanceMap[key] || 0) + item.uptJuly;
        }
    });

    const labels = Object.keys(performanceMap);
    const dataValues = Object.values(performanceMap).map(val => parseFloat(val.toFixed(2)));

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Poin UPT',
                data: dataValues,
                backgroundColor: 'rgba(245, 158, 11, 0.85)',
                borderRadius: 8,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, weight: '600' } } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}

// =====================================================================
// 5. CORE LOGIC: DASHBOARD SALES
// =====================================================================

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
                    if (kategori === 'bm' && item.namaBM) uniqueItems.add(item.namaBM);
                    if (kategori === 'abm' && item.namaABM) uniqueItems.add(item.namaABM);
                    if (kategori === 'store' && item.namaStore) uniqueItems.add(item.namaStore);
                });
            }

            Array.from(uniqueItems).sort().forEach(name => {
                slicerSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applySalesFilters();
    });

    slicerSpesifik.addEventListener('change', applySalesFilters);
    slicerBulan.addEventListener('change', fetchSalesData); 
}

async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        const selectedKey = document.getElementById('slicerBulanSales').value;
        const gid = SHEET_GIDS[selectedKey] || '0';
        
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
            
            if (!storeName || storeName === "" || storeName === "-") {
                continue; 
            }

            result.push({
                store: storeName,
                targetPoint: "-",
                mtdSales: parseFloat(row[5]?.replace(/[^0-9.-]+/g, "")) || 0,
                mtdTarget: parseFloat(row[6]?.replace(/[^0-9.-]+/g, "")) || 0,
                bestEstimate: row[16]?.replace(/[\r"]/g, "") || "-",
                achPercent: parseFloat(row[17]?.replace(/[^0-9.-]+/g, "")) || 0
            });
        }
    }
    return result;
}

function applySalesFilters() {
    const kategori = document.getElementById('slicerKategoriSales')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifikSales')?.value || 'all';

    let filteredSales = [...salesData]; 

    if (kategori !== 'all' && spesifik !== 'all') {
        const allowedStores = new Set();
        
        if (typeof dashboardData !== 'undefined') {
            dashboardData.forEach(item => {
                if (kategori === 'bm' && item.namaBM === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                else if (kategori === 'abm' && item.namaABM === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
                else if (kategori === 'store' && item.namaStore === spesifik) allowedStores.add(item.namaStore.toLowerCase().trim());
            });
        }

        filteredSales = salesData.filter(item => allowedStores.has(item.store.toLowerCase().trim()));
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

async function fetchAndRenderTrendChart(kategori, spesifik) {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    const ctx = document.getElementById('salesTargetChart');
    if (salesChartInstance) salesChartInstance.destroy();

    try {
        const currentMonthKey = document.getElementById('slicerBulanSales').value;
        const monthKeys = ['Jul26', 'Jun26', 'May26', 'Apr26', 'Mar26', 'Feb26', 'Jan26', 'Dec25', 'Nov25'];
        
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

function renderSalesSummaryFiltered(data) {
    let totalSales = 0, totalTarget = 0;
    
    // Siapkan wadah kosong untuk mencari siapa juaranya
    let topSalesStore = { name: '-', val: 0 };
    let topAchStore = { name: '-', val: 0 };

    data.forEach(item => {
        let s = item.mtdSales || 0;
        let t = item.mtdTarget || 0;
        let ach = item.achPercent || 0;

        // Hitung total keseluruhan
        totalSales += s;
        totalTarget += t;

        // Cek siapa yang sales-nya paling tinggi
        if (s > topSalesStore.val) {
            topSalesStore.val = s;
            topSalesStore.name = item.store;
        }
        
        // Cek siapa yang persentase achievement-nya paling tinggi
        if (ach > topAchStore.val) {
            topAchStore.val = ach;
            topAchStore.name = item.store;
        }
    });
    
    const avgAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    
    // Hubungkan dengan HTML
    const elTotalSales = document.getElementById('summary-total-sales');
    const elAvgAch = document.getElementById('summary-avg-ach');
    const elTopSalesStore = document.getElementById('summary-top-sales-store');
    const elTopSalesVal = document.getElementById('summary-top-sales-val');
    const elTopAchStore = document.getElementById('summary-top-ach-store');
    const elTopAchVal = document.getElementById('summary-top-ach-val');
    
    // Lempar nilainya ke layar
    if (elTotalSales) elTotalSales.innerText = "Rp " + totalSales.toLocaleString('id-ID');
    if (elAvgAch) elAvgAch.innerText = avgAch + "%";
    
    if (elTopSalesStore) elTopSalesStore.innerText = topSalesStore.name;
    if (elTopSalesVal) elTopSalesVal.innerText = "Rp " + topSalesStore.val.toLocaleString('id-ID');
    
    if (elTopAchStore) elTopAchStore.innerText = topAchStore.name;
    if (elTopAchVal) elTopAchVal.innerText = topAchStore.val.toFixed(2) + "%";

    // Panggil ulang render icon Lucide karena kita menambahkan icon baru di HTML
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
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
            layout: {
                padding: { top: 30 } 
            },
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
                y1: {
                    type: 'linear', display: false, position: 'right', beginAtZero: true
                }
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

function renderSalesTableFiltered(data) {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map(item => {
        let ach = item.achPercent || 0;
        let badgeHTML = '';
        
        // LOGIKA GAMIFICATION BADGE (UPDATE BARU)
        if (ach >= 100) {
            // ELITE (EMAS) - >= 100%
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1 bg-amber-100 text-amber-600 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-amber-200 shadow-sm"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg> ELITE</div>`;
        } else if (ach >= 90) {
            // PENYEMANGAT (BIRU CERAH) - 90% s/d 99.9%
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1.5 bg-sky-50 text-sky-500 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-sky-100"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> DIKIT LAGI!</div>`;
        } else {
            // WARNING (MERAH) - Di Bawah 90%
            badgeHTML = `<div class="mt-1 inline-flex items-center gap-1 bg-rose-50 text-rose-500 px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border border-rose-100"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> WARNING</div>`;
        }

        return `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
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
