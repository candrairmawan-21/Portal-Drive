// ==========================================
// 1. CONFIG & GLOBAL VARIABLES
// ==========================================
const DASHBOARD_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=425930614&single=true&output=csv';

// [FITUR DEBUG] 
// Isi dengan 'admin', 'bm_ika', atau 'Ika Nuraini' untuk memaksa masuk.
// Jika ingin mengambil murni dari form login (localStorage), ubah menjadi: const FORCE_LOGIN_USERNAME = '';
const FORCE_LOGIN_USERNAME = 'admin'; 

let dashboardData = [];
let chartInstance = null;

// ==========================================
// 2. TOKO SETTING: ATUR USERNAME MANUAL DI SINI
// ==========================================
const USER_MAPPING = {
    'admin':     { namaDiSheets: 'Admin Global', role: 'admin' },
    
    // Akun BM
    'bm_ika':    { namaDiSheets: 'Ika Nuraini', role: 'bm' },
    'bm_galih':  { namaDiSheets: 'Galih Bagus Perdana', role: 'bm' },
    'bm_didik':  { namaDiSheets: 'Didik Supriyadi', role: 'bm' },
    
    // Akun ABM
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
    
    // Akun Staff
    'staff_budi': { namaDiSheets: 'Budi Santoso', role: 'staff' }
};

// ==========================================
// 3. INISIALISASI SAAT HALAMAN DIMUAT
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("Dashboard Inisialisasi Dimulai...");
    renderLoggedInUser();
    fetchDashboardData();
});

// ==========================================
// 4. LOGIKA SESSION LOGIN USER (ANTI-GAGAL)
// ==========================================
function getSessionUser() {
    // 1. Ambil data dari Force Login ATAU LocalStorage ATAU SessionStorage
    let rawUser = FORCE_LOGIN_USERNAME || 
                  localStorage.getItem('username') || 
                  localStorage.getItem('user') || 
                  sessionStorage.getItem('username');
    
    const originalUsername = (rawUser && rawUser.trim() !== '') ? rawUser.trim() : 'guest';
    const cleanRaw = originalUsername.toLowerCase().replace(/[\s_\-]/g, ''); // Hapus spasi dan strip

    let matchedUser = null;

    // 2. Dual-Matching: Cek berdasarkan KODE (contoh: bm_ika) ATAU NAMA ASLI (contoh: Ika Nuraini)
    for (const [key, val] of Object.entries(USER_MAPPING)) {
        const cleanKey = key.toLowerCase().replace(/[\s_\-]/g, '');
        const cleanNameInSheets = val.namaDiSheets.toLowerCase().replace(/[\s_\-]/g, '');
        
        if (cleanRaw === cleanKey || cleanRaw === cleanNameInSheets) {
            matchedUser = {
                username: originalUsername,
                nameInSheets: val.namaDiSheets.toLowerCase(),
                role: val.role.toLowerCase(),
                displayName: val.namaDiSheets
            };
            break;
        }
    }
    
    // 3. Jika ketemu kembalikan data, jika tidak jadikan 'guest' TAPI berikan hak 'admin' agar dashboard tidak blank
    if (matchedUser) {
        console.log("Login Sukses sebagai:", matchedUser.displayName, "(Role:", matchedUser.role, ")");
        return matchedUser;
    } else {
        console.warn("Username tidak terdaftar:", originalUsername, "- Fallback ke Tampilan Admin agar data tidak kosong.");
        return {
            username: originalUsername,
            nameInSheets: originalUsername,
            role: 'admin', // Diubah jadi admin agar tetap bisa melihat seluruh data (bisa dikembalikan ke 'staff' jika perlu)
            displayName: originalUsername === 'guest' ? 'Guest / Admin Mode' : originalUsername
        };
    }
}

function renderLoggedInUser() {
    const user = getSessionUser();
    const userContainer = document.getElementById('user-profile-nav') || 
                          document.querySelector('.navbar-right') || 
                          document.querySelector('header .flex.items-center.gap-4') ||
                          document.querySelector('nav .flex.items-center') ||
                          document.getElementById('user-profile');

    if (userContainer) {
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
    } else {
        console.warn("Elemen profil user di HTML tidak ditemukan (Cek ID 'user-profile-nav').");
    }
}

// ==========================================
// 5. CORE LOGIC (PARSING & SINKRONISASI DATA)
// ==========================================
async function fetchDashboardData() {
    const container = document.getElementById('dashboard-loading');
    if (container) container.classList.remove('hidden');

    try {
        const response = await fetch(DASHBOARD_API_URL);
        if (!response.ok) throw new Error("Gagal mengambil data dari Google Sheets");
        
        const csvText = await response.text();
        const allData = parseDashboardCSV(csvText);
        
        const user = getSessionUser();
        
        // Filter Data berdasarkan Role & Nama di Sheets
        if (user.role === 'admin') {
            dashboardData = allData;
        } else if (user.role === 'bm') {
            dashboardData = allData.filter(item => item.namaBM.toLowerCase() === user.nameInSheets);
        } else if (user.role === 'abm') {
            dashboardData = allData.filter(item => item.namaABM.toLowerCase() === user.nameInSheets);
        } else {
            dashboardData = allData.filter(item => item.namaStaff.toLowerCase() === user.nameInSheets);
        }

        console.log(`Total Data Terfilter untuk ${user.displayName}:`, dashboardData.length, "baris");

        initSlicers();
        applyDashboardFilters();
        
    } catch (error) {
        console.error('Error memuat data dashboard:', error);
    } finally {
        if (container) container.classList.add('hidden');
    }
}

// Parsing CSV Anti-Gagal (Menangani tanda kutip, enter berlebih, dan format angka Indonesia)
function parseDashboardCSV(text) {
    let lines = text.split(/\r?\n/); // Tangani Mac/Windows Line Endings
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
            // Pembersihan Angka UPT: Hapus kutip, hapus titik (ribuan), ubah koma jadi titik (desimal)
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

// ==========================================
// 6. LOGIKA SLICER (TANPA CLONE NODE - AMAN UNTUK HTML)
// ==========================================
function initSlicers() {
    const slicerKategori = document.getElementById('slicerKategori');
    const slicerSpesifik = document.getElementById('slicerSpesifik');
    const slicerBulan = document.getElementById('slicerBulan');

    if (slicerKategori) {
        // Gunakan .onchange agar mereplace event listener lama tanpa merusak DOM HTML
        slicerKategori.onchange = function() {
            const kategori = this.value;
            
            if (!slicerSpesifik) return;

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
    }

    if (slicerSpesifik) slicerSpesifik.onchange = applyDashboardFilters;
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

// ==========================================
// 7. RENDER UI COMPONENTS (PODIUM & CHART)
// ==========================================
function renderPodiumTop3(data) {
    const container = document.getElementById('podium-top-content');
    if (!container) {
        console.warn("Elemen HTML dengan ID 'podium-top-content' tidak ditemukan. Podium Top batal dirender.");
        return;
    }

    // Hindari error jika data kosong
    let sorted = [...data].sort((a, b) => b.uptJuly - a.uptJuly);
    const p1 = sorted[0] || { namaStaff: 'Belum ada data', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'top');
}

function renderPodiumBottom3(data) {
    const container = document.getElementById('podium-bottom-content');
    if (!container) return;

    // Abaikan UPT 0 dari pencarian Terbawah, kecuali memang semua datanya 0
    let validData = data.filter(item => item.uptJuly > 0);
    if (validData.length === 0) validData = data;

    let sorted = [...validData].sort((a, b) => a.uptJuly - b.uptJuly);
    const p1 = sorted[0] || { namaStaff: 'Belum ada data', namaStore: '-', uptJuly: 0 };
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

    if (chartInstance) {
        chartInstance.destroy();
    }

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