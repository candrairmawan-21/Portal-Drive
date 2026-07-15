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
    // A. Init Umum / Navigasi
    renderLoggedInUser();

    // B. Init Dashboard UPT
    fetchDashboardData();

    // C. Init Dashboard Sales
    displayUpdateDate();
    initMonthSlicer();
    fetchSalesData();
});

// =====================================================================
// 3. FITUR UMUM & PROTEKSI AKSES (DARI DASHBOARD UPT)
// =====================================================================

function renderLoggedInUser() {
    // Ambil data Username dan Role dari sessionStorage yang dikirim saat login
    const userName = sessionStorage.getItem('portalUser') || 'Guest';
    const userRole = sessionStorage.getItem('portalRole') || 'Staff';

    const userContainer = document.getElementById('user-profile-nav') || 
                          document.querySelector('.navbar-right') || 
                          document.querySelector('header .flex.items-center.gap-4') ||
                          document.querySelector('nav .flex.items-center');

    if (userContainer) {
        const existingBadge = document.getElementById('dynamic-user-badge');
        if (existingBadge) existingBadge.remove();

        // Desain profil disesuaikan dengan tema Light Mode index.html
        const badgeHTML = `
            <div id="dynamic-user-badge" class="flex items-center gap-3 bg-slate-50 border border-slate-200 px-4 py-1.5 rounded-2xl ml-auto shadow-sm">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-semibold text-slate-500">Hi <span class="font-black text-slate-800 capitalize">${userName}</span>,</p>
                    <p class="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">your role is <span class="font-bold text-amber-500 uppercase">${userRole}</span></p>
                </div>
                <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white font-black text-sm shadow-md uppercase">
                    ${userName.charAt(0)}
                </div>
            </div>
        `;
        userContainer.insertAdjacentHTML('beforeend', badgeHTML);
    }
}

function checkDashboardAccess(pageRestrictionValue) {
    // Membaca role langsung dari role yang sudah diset di manual database
    const userRole = (sessionStorage.getItem('portalRole') || 'staff').toLowerCase().trim();
    const pageRestriction = pageRestrictionValue ? pageRestrictionValue.toLowerCase().trim() : "";

    if (pageRestriction === "" || pageRestriction === "-") return true;
    if (userRole === "admin") return true; 
    if (pageRestriction === "bm") return userRole === "bm";
    if (pageRestriction === "abm") return userRole === "abm" || userRole === "bm";

    return false;
}


function showAccessDenied() {
    const mainContent = document.getElementById('main-content') || document.getElementById('dashboard-content') || document.body;
    mainContent.innerHTML = `
        <div class="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 w-full grid col-span-full">
            <div class="p-6 bg-white rounded-2xl shadow-sm border border-slate-100 max-w-sm mx-auto flex flex-col items-center">
                <svg xmlns="http://www.w3.org/2000/svg" class="w-16 h-16 text-rose-500 mb-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m0-8v4m-9 5h18c1.1 0 1.99-.89 1.99-1.99L23 7c0-1.1-.9-2-2-2H3c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2z" />
                </svg>
                <h2 class="text-xl font-black text-slate-800 mb-1">Akses Terkunci</h2>
                <p class="text-sm text-slate-500">Maaf, file atau halaman ini dikunci berdasarkan regulasi hak akses jabatan Anda.</p>
            </div>
        </div>
    `;
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
        
        const currentFileRestriction = "abm"; 
        if (!checkDashboardAccess(currentFileRestriction)) {
            showAccessDenied();
            return; 
        }
        
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

function initMonthSlicer() {
    const slicer = document.getElementById('slicerBulanSales');
    if (slicer) {
        slicer.addEventListener('change', fetchSalesData);
    }
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
        
        renderSalesSummary();
        renderSalesChart();
        renderSalesTable();
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
            result.push({
                store: row[2]?.replace(/[\r"]/g, "") || "-",
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

function renderSalesSummary() {
    let totalSales = 0, totalTarget = 0;
    salesData.forEach(item => { totalSales += item.mtdSales; totalTarget += item.mtdTarget; });
    const avgAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    
    const elTotalSales = document.getElementById('summary-total-sales');
    const elAvgAch = document.getElementById('summary-avg-ach');
    
    if (elTotalSales) elTotalSales.innerText = "Rp " + totalSales.toLocaleString('id-ID');
    if (elAvgAch) elAvgAch.innerText = avgAch + "%";
}

function renderSalesChart() {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    if (salesChartInstance) salesChartInstance.destroy();
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: salesData.map(item => item.store),
            datasets: [
                { label: 'MTD Sales', backgroundColor: '#34d399', data: salesData.map(item => item.mtdSales) },
                { label: 'MTD Target', backgroundColor: '#ef4444', data: salesData.map(item => item.mtdTarget) }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderSalesTable() {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;

    tbody.innerHTML = salesData.map(item => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition-colors">
            <td class="px-5 py-4 font-bold text-sm text-slate-800">${item.store}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${item.mtdSales.toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${item.mtdTarget.toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${item.bestEstimate}</td>
            <td class="px-5 py-4 text-center">
                <span class="px-3 py-1.5 rounded-xl text-[10px] font-black tracking-wider ${
                    item.achPercent >= 100
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                    : 'bg-rose-50 text-rose-600 border border-rose-200/60'
                }">
                    ${item.achPercent.toFixed(2)}%
                </span>
            </td>
        </tr>
    `).join('');
}
