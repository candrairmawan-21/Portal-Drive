// ==========================================
// 1. CONFIG & GLOBAL VARIABLES
// ==========================================
const DASHBOARD_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=425930614&single=true&output=csv';

// Tetap kita paksa Admin dulu untuk testing UI
const FORCE_LOGIN_USERNAME = 'admin'; 

let dashboardData = [];
let chartInstance = null;

const USER_MAPPING = {
    'admin':     { namaDiSheets: 'Admin Global', role: 'admin' },
    'bm_ika':    { namaDiSheets: 'Ika Nuraini', role: 'bm' },
    'bm_galih':  { namaDiSheets: 'Galih Bagus Perdana', role: 'bm' },
    'bm_didik':  { namaDiSheets: 'Didik Supriyadi', role: 'bm' },
    'abm_bayu':   { namaDiSheets: 'Bayu Setiawan', role: 'abm' },
    'abm_ika':    { namaDiSheets: 'Ika', role: 'abm' }, 
    'abm_bayu2':  { namaDiSheets: 'Bayu Eka Nugraha', role: 'abm' },
    'abm_satria': { namaDiSheets: 'Satriawan Sejati', role: 'abm' },
    'abm_fachri': { namaDiSheets: 'Fachri Anggoro Budi', role: 'abm' }, 
    'abm_gading': { namaDiSheets: 'Gading Hanif Prasetya', role: 'abm' }, 
    'abm_anas':   { namaDiSheets: 'Anas Makruf', role: 'abm' },
    'abm_adinda': { namaDiSheets: 'Adinda Febiyanti', role: 'abm' },
    'abm_wildan': { namaDiSheets: 'Wildan Aulia Rakhman', role: 'abm' },
    'abm_ridho':  { namaDiSheets: 'Ridho Malandi', role: 'abm' },
    'staff_budi': { namaDiSheets: 'Budi Santoso', role: 'staff' }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("=== MEMULAI DASHBOARD SCRIPT ===");
    try {
        renderLoggedInUser();
        fetchDashboardData();
    } catch (e) {
        console.error("CRITICAL ERROR SAAT INISIALISASI:", e);
        alert("Terjadi kesalahan sistem. Buka F12 (Console) untuk melihat detailnya.");
    }
});

function getSessionUser() {
    let rawUser = FORCE_LOGIN_USERNAME || localStorage.getItem('username') || sessionStorage.getItem('username') || 'guest';
    const cleanRaw = rawUser.trim().toLowerCase().replace(/[\s_\-]/g, '');

    for (const [key, val] of Object.entries(USER_MAPPING)) {
        const cleanKey = key.toLowerCase().replace(/[\s_\-]/g, '');
        const cleanNameInSheets = val.namaDiSheets.toLowerCase().replace(/[\s_\-]/g, '');
        if (cleanRaw === cleanKey || cleanRaw === cleanNameInSheets) {
            return { username: rawUser, nameInSheets: val.namaDiSheets.toLowerCase(), role: val.role.toLowerCase(), displayName: val.namaDiSheets };
        }
    }
    
    return { username: rawUser, nameInSheets: rawUser, role: 'admin', displayName: rawUser === 'guest' ? 'Guest / Admin Mode' : rawUser };
}

function renderLoggedInUser() {
    try {
        const user = getSessionUser();
        const userContainer = document.getElementById('user-profile-nav') || document.querySelector('.navbar-right') || document.querySelector('header .flex.items-center.gap-4') || document.getElementById('user-profile');

        if (!userContainer) {
            console.warn("WARNING HTML: Tempat untuk menaruh nama User (misal id='user-profile-nav') tidak ditemukan di HTML Anda.");
            return;
        }

        const existingBadge = document.getElementById('dynamic-user-badge');
        if (existingBadge) existingBadge.remove();

        const badgeHTML = `
            <div id="dynamic-user-badge" class="flex items-center gap-3 bg-slate-800/40 border border-slate-700/60 px-4 py-1.5 rounded-xl backdrop-blur-sm ml-auto">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-black text-white leading-none">${user.displayName}</p>
                    <p class="text-[9px] text-amber-400 font-bold tracking-wider uppercase mt-0.5">${user.role}</p>
                </div>
                <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white font-black text-xs shadow-sm uppercase">
                    ${user.displayName.charAt(0).toUpperCase()}
                </div>
            </div>
        `;
        userContainer.insertAdjacentHTML('beforeend', badgeHTML);
        console.log("UI: Nama user berhasil dirender:", user.displayName);
    } catch (e) {
        console.error("ERROR saat render user:", e);
    }
}

async function fetchDashboardData() {
    const container = document.getElementById('dashboard-loading');
    if (container) container.classList.remove('hidden');

    try {
        const response = await fetch(DASHBOARD_API_URL);
        if (!response.ok) throw new Error("Gagal akses Google Sheets (HTTP " + response.status + ")");
        
        const csvText = await response.text();
        let allData = parseDashboardCSV(csvText);
        
        if (allData.length === 0) throw new Error("Data Google Sheets kosong atau format CSV tidak sesuai.");
        
        filterAndRender(allData);
    } catch (error) {
        console.error('ERROR GOOGLE SHEETS:', error.message);
        console.warn('MENGGUNAKAN DATA DUMMY SEBAGAI CADANGAN AGAR UI TETAP MUNCUL...');
        
        // DATA PALSU UNTUK TESTING JIKA SHEETS GAGAL
        const dummyData = [
            { namaBM: 'Ika Nuraini', namaABM: 'Bayu Setiawan', namaStore: 'TOKO A', nik: '111', namaStaff: 'Staff Satu', uptJuly: 15.5 },
            { namaBM: 'Ika Nuraini', namaABM: 'Ika', namaStore: 'TOKO B', nik: '222', namaStaff: 'Staff Dua', uptJuly: 10.2 },
            { namaBM: 'Galih Bagus Perdana', namaABM: 'Satriawan Sejati', namaStore: 'TOKO C', nik: '333', namaStaff: 'Staff Tiga', uptJuly: 25.8 },
            { namaBM: 'Galih Bagus Perdana', namaABM: 'Anas Makruf', namaStore: 'TOKO D', nik: '444', namaStaff: 'Staff Empat', uptJuly: 5.1 }
        ];
        filterAndRender(dummyData);
    } finally {
        if (container) container.classList.add('hidden');
    }
}

function parseDashboardCSV(text) {
    let lines = text.split(/\r?\n/);
    if (lines.length <= 1) return []; 
    let result = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue; 
        let row = [];
        let inQuotes = false;
        let currentStr = "";
        for (let char of lines[i]) {
            if (char === '"') { inQuotes = !inQuotes; } 
            else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; } 
            else { currentStr += char; }
        }
        row.push(currentStr.trim());
        if (row.length >= 6) {
            let rawUpt = row[5].replace(/["]/g, "").replace(/\./g, "").replace(',', '.');
            let parsedUpt = parseFloat(rawUpt);
            result.push({
                namaBM: row[0].replace(/["]/g, "").trim(),
                namaABM: row[1].replace(/["]/g, "").trim(),
                namaStore: row[2].replace(/["]/g, "").trim(),
                nik: row[3].replace(/["]/g, "").trim(),
                namaStaff: row[4].replace(/["]/g, "").trim(),
                uptJuly: isNaN(parsedUpt) ? 0 : parsedUpt
            });
        }
    }
    return result;
}

function filterAndRender(allData) {
    const user = getSessionUser();
    if (user.role === 'admin') {
        dashboardData = allData;
    } else if (user.role === 'bm') {
        dashboardData = allData.filter(item => item.namaBM.toLowerCase() === user.nameInSheets);
    } else if (user.role === 'abm') {
        dashboardData = allData.filter(item => item.namaABM.toLowerCase() === user.nameInSheets);
    } else {
        dashboardData = allData.filter(item => item.namaStaff.toLowerCase() === user.nameInSheets);
    }

    console.log("Data siap dirender:", dashboardData.length, "baris.");
    initSlicers();
    applyDashboardFilters();
}

function initSlicers() {
    const slicerKategori = document.getElementById('slicerKategori');
    const slicerSpesifik = document.getElementById('slicerSpesifik');

    if (!slicerKategori || !slicerSpesifik) {
        console.warn("WARNING HTML: ID 'slicerKategori' atau 'slicerSpesifik' tidak ditemukan. Slicer dimatikan.");
        return;
    }

    slicerKategori.onchange = function() {
        const kategori = this.value;
        slicerSpesifik.innerHTML = '<option value="all">-- Semua --</option>';
        if (kategori === 'all') {
            slicerSpesifik.disabled = true;
            slicerSpesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        } else {
            slicerSpesifik.disabled = false;
            slicerSpesifik.classList.remove('bg-slate-100', 'cursor-not-allowed');
            let uniqueItems = new Set();
            dashboardData.forEach(item => {
                if (kategori === 'bm' && item.namaBM && item.namaBM !== '-') uniqueItems.add(item.namaBM);
                if (kategori === 'abm' && item.namaABM && item.namaABM !== '-') uniqueItems.add(item.namaABM);
            });
            Array.from(uniqueItems).sort().forEach(name => {
                slicerSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applyDashboardFilters();
    };

    slicerSpesifik.onchange = applyDashboardFilters;
    const slicerBulan = document.getElementById('slicerBulan');
    if (slicerBulan) slicerBulan.onchange = applyDashboardFilters;
}

function applyDashboardFilters() {
    const kategori = document.getElementById('slicerKategori')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifik')?.value || 'all';

    let filteredData = [...dashboardData];
    if (kategori === 'bm' && spesifik !== 'all') {
        filteredData = filteredData.filter(item => item.namaBM === spesifik);
    } else if (kategori === 'abm' && spesifik !== 'all') {
        filteredData = filteredData.filter(item => item.namaABM === spesifik);
    }

    renderPodiumTop3(filteredData);
    renderPodiumBottom3(filteredData);
    renderChartPerforma(filteredData);
}

function renderPodiumTop3(data) {
    const container = document.getElementById('podium-top-content');
    if (!container) {
        console.error("CRITICAL HTML: ID 'podium-top-content' tidak ditemukan!");
        return;
    }
    let sorted = [...data].sort((a, b) => b.uptJuly - a.uptJuly);
    const p1 = sorted[0] || { namaStaff: 'No Data', namaStore: '-', uptJuly: 0 };
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
    const p1 = sorted[0] || { namaStaff: 'No Data', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'bottom');
}

function generatePodiumHTML(p1, p2, p3, type) {
    const isTop = type === 'top';
    const colorClass = isTop 
        ? { bar1: 'from-amber-500 to-amber-400', txt1: 'text-amber-600', badge1: 'from-amber-500 to-orange-500' }
        : { bar1: 'from-rose-500 to-rose-400', txt1: 'text-rose-600', badge1: 'from-rose-500 to-red-600' };

    return `
        <div class="flex items-end justify-center gap-2 sm:gap-4 pt-12 pb-2 max-w-md mx-auto w-full">
            <div class="flex flex-col items-center flex-1 w-0">
                <div class="text-center mb-2 w-full px-0.5">
                    <p class="font-extrabold text-[11px] sm:text-xs text-slate-700 leading-tight min-h-[2rem] flex items-center justify-center break-words content-center">${p2.namaStaff}</p>
                    <span class="inline-block mt-1 text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p2.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-slate-200 to-slate-100 h-20 rounded-t-2xl border-t-2 border-slate-300 flex items-center justify-center relative shadow-sm">
                    <span class="text-2xl font-black text-slate-400">2</span>
                </div>
            </div>
            <div class="flex flex-col items-center flex-1 transform -translate-y-4 w-0">
                <div class="text-center mb-2 w-full px-0.5">
                    <p class="font-black text-xs sm:text-sm text-slate-800 leading-tight min-h-[2rem] flex items-center justify-center break-words content-center">${p1.namaStaff}</p>
                    <span class="inline-block mt-1 text-xs font-black text-white bg-gradient-to-r ${colorClass.badge1} px-2.5 py-0.5 rounded-lg shadow-sm">${p1.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t ${colorClass.bar1} h-28 rounded-t-2xl border-t-2 border-white/20 flex items-center justify-center relative shadow-md">
                    <span class="text-3xl font-black text-white drop-shadow-sm">1</span>
                </div>
            </div>
            <div class="flex flex-col items-center flex-1 w-0">
                <div class="text-center mb-2 w-full px-0.5">
                    <p class="font-extrabold text-[11px] sm:text-xs text-slate-700 leading-tight min-h-[2rem] flex items-center justify-center break-words content-center">${p3.namaStaff}</p>
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
    if (!ctx) {
        console.warn("WARNING HTML: ID 'bmChart' tidak ditemukan. Chart batal dirender.");
        return;
    }
    
    // Cegah error jika library Chart.js tidak terload di HTML
    if (typeof Chart === 'undefined') {
        console.error("CRITICAL ERROR: Library Chart.js belum dimasukkan ke dalam HTML Anda!");
        return;
    }

    let performanceMap = {};
    const kategoriSlicer = document.getElementById('slicerKategori')?.value || 'all';
    const spesifikSlicer = document.getElementById('slicerSpesifik')?.value || 'all';

    data.forEach(item => {
        let key = item.namaBM; 
        if (kategoriSlicer === 'abm') key = item.namaABM;
        if (spesifikSlicer !== 'all') key = item.namaStaff; 
        if (key && key !== "-") performanceMap[key] = (performanceMap[key] || 0) + item.uptJuly;
    });

    const labels = Object.keys(performanceMap);
    const dataValues = Object.values(performanceMap).map(val => parseFloat(val.toFixed(2)));

    if (chartInstance) chartInstance.destroy();
    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: { labels: labels, datasets: [{ label: 'Total Poin UPT', data: dataValues, backgroundColor: 'rgba(245, 158, 11, 0.85)', borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: '#f1f5f9' } } } }
    });
}