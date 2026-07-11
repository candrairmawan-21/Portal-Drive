// URL CSV Khusus untuk Dashboard UPT
const DASHBOARD_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=425930614&single=true&output=csv';

let dashboardData = [];
let chartInstance = null;

// Fungsi Utama untuk Memuat Data Dashboard
async function fetchDashboardData() {
    const container = document.getElementById('dashboard-loading');
    if (container) container.classList.remove('hidden');

    try {
        const response = await fetch(DASHBOARD_API_URL);
        const csvText = await response.text();
        dashboardData = parseDashboardCSV(csvText);
        
        // Inisialisasi awal slicer setelah data siap
        initSlicers();
        // Render pertama kali dengan seluruh data
        applyDashboardFilters();
    } catch (error) {
        console.error('Error memuat data dashboard:', error);
    } finally {
        if (container) container.classList.add('hidden');
    }
}

// Parser CSV Sederhana untuk Dashboard
function parseDashboardCSV(text) {
    let lines = text.split('\n');
    if (lines.length === 0) return [];
    
    let result = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
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

// INISIALISASI & LOGIKA RELASI SLICER
function initSlicers() {
    const slicerKategori = document.getElementById('slicerKategori');
    const slicerSpesifik = document.getElementById('slicerSpesifik');

    // Event ketika Slicer Kategori Berubah
    slicerKategori.addEventListener('change', function() {
        const kategori = this.value;
        slicerSpesifik.innerHTML = '<option value="all">-- Semua --</option>';
        
        if (kategori === 'all') {
            slicerSpesifik.disabled = true;
            slicerSpesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        } else {
            slicerSpesifik.disabled = false;
            slicerSpesifik.classList.remove('bg-slate-100', 'cursor-not-allowed');
            
            // Ambil data unique berdasarkan kategori yang dipilih
            let uniqueItems = new Set();
            dashboardData.forEach(item => {
                if (kategori === 'bm' && item.namaBM) uniqueItems.add(item.namaBM);
                if (kategori === 'abm' && item.namaABM) uniqueItems.add(item.namaABM);
            });

            // Masukkan data unique ke dalam Slicer 3
            Array.from(uniqueItems).sort().forEach(name => {
                slicerSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applyDashboardFilters();
    });

    // Event listener untuk slicer lainnya
    document.getElementById('slicerBulan').addEventListener('change', applyDashboardFilters);
    slicerSpesifik.addEventListener('change', applyDashboardFilters);
}

// FUNGSI UNTUK MENYARING DATA BERDASARKAN PILIHAN SLICER
function applyDashboardFilters() {
    const bulan = document.getElementById('slicerBulan').value;
    const kategori = document.getElementById('slicerKategori').value;
    const spesifik = document.getElementById('slicerSpesifik').value;

    let filteredData = [...dashboardData];

    // Catatan: Karena kolom Anda saat ini statis 'uptJuly' sesuai header, filter bulan bertindak sebagai cakupan data saat ini.
    // Filter Kategori & Nama Spesifik (BM / ABM)
    if (kategori === 'bm') {
        if (spesifik !== 'all') {
            filteredData = filteredData.filter(item => item.namaBM === spesifik);
        }
    } else if (kategori === 'abm') {
        if (spesifik !== 'all') {
            filteredData = filteredData.filter(item => item.namaABM === spesifik);
        }
    }

    // Render ulang komponen dengan data yang sudah disaring
    renderPodiumTop3(filteredData);
    renderPodiumBottom3(filteredData);
    renderChartPerforma(filteredData);
}

// 1. RENDER TOP 3 STAFF
function renderPodiumTop3(data) {
    let sorted = [...data].sort((a, b) => b.uptJuly - a.uptJuly);
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    document.getElementById('podium-top-content').innerHTML = generatePodiumHTML(p1, p2, p3, 'top');
    lucide.createIcons();
}

// 2. RENDER BOTTOM 3 STAFF
function renderPodiumBottom3(data) {
    // Abaikan data yang poin UPT-nya 0 agar pencarian bottom lebih akurat (jika dibutuhkan)
    let validData = data.filter(item => item.uptJuly > 0);
    if(validData.length === 0) validData = data;

    let sorted = [...validData].sort((a, b) => a.uptJuly - b.uptJuly);
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 }; // Terendah ke-1
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 }; // Terendah ke-2
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 }; // Terendah ke-3

    // Susunan visual podium bottom dibalik: posisi tengah adalah yang paling rendah/bawah kinerjanya
    document.getElementById('podium-bottom-content').innerHTML = generatePodiumHTML(p1, p2, p3, 'bottom');
    lucide.createIcons();
}

// HELPER UNTUK MEMBUAT STRUKTUR HTML PODIUM (TOP/BOTTOM)
function generatePodiumHTML(p1, p2, p3, type) {
    const colorClass = type === 'top' 
        ? { bar1: 'from-amber-500 to-amber-400', txt1: 'text-amber-600', badge1: 'from-amber-500 to-orange-500', icon: 'crown', iconColor: 'text-amber-500' }
        : { bar1: 'from-rose-500 to-rose-400', txt1: 'text-rose-600', badge1: 'from-rose-500 to-red-600', icon: 'alert-triangle', iconColor: 'text-rose-500' };

    return `
        <div class="flex items-end justify-center gap-2 sm:gap-4 pt-12 pb-2 max-w-md mx-auto">
            <!-- JUARA 2 (KIRI) -->
            <div class="flex flex-col items-center flex-1">
                <div class="text-center mb-2">
                    <p class="font-extrabold text-xs text-slate-700 truncate w-24 sm:w-28">${p2.namaStaff}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase truncate w-24">${p2.namaStore}</p>
                    <span class="text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p2.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-slate-200 to-slate-100 h-20 rounded-t-2xl border-t-2 border-slate-300 flex items-center justify-center relative shadow-sm">
                    <span class="text-2xl font-black text-slate-400">2</span>
                </div>
            </div>

            <!-- JUARA 1 (TENGAH) -->
            <div class="flex flex-col items-center flex-1 transform -translate-y-4">
                <div class="text-center mb-2">
                    <div class="flex justify-center ${colorClass.iconColor} animate-bounce mb-0.5"><i data-lucide="${colorClass.icon}" class="w-5 h-5 fill-current"></i></div>
                    <p class="font-black text-sm text-slate-800 truncate w-24 sm:w-28">${p1.namaStaff}</p>
                    <p class="text-[10px] ${colorClass.txt1} font-extrabold uppercase truncate w-24">${p1.namaStore}</p>
                    <span class="text-xs font-black text-white bg-gradient-to-r ${colorClass.badge1} px-2.5 py-0.5 rounded-lg shadow-sm">${p1.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t ${colorClass.bar1} h-28 rounded-t-2xl border-t-2 border-white/20 flex items-center justify-center relative shadow-md">
                    <span class="text-3xl font-black text-white drop-shadow-sm">1</span>
                </div>
            </div>

            <!-- JUARA 3 (KANAN) -->
            <div class="flex flex-col items-center flex-1">
                <div class="text-center mb-2">
                    <p class="font-extrabold text-xs text-slate-700 truncate w-24 sm:w-28">${p3.namaStaff}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase truncate w-24">${p3.namaStore}</p>
                    <span class="text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p3.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-orange-100 to-orange-50/40 h-14 rounded-t-2xl border-t-2 border-orange-200 flex items-center justify-center relative shadow-sm">
                    <span class="text-xl font-black text-orange-400">3</span>
                </div>
            </div>
        </div>
    `;
}

// 3. GENERATE DIAGRAM BATANG BERDASARKAN AKUMULASI GRUP DATA
function renderChartPerforma(data) {
    let performanceMap = {};
    const kategoriSlicer = document.getElementById('slicerKategori').value;

    data.forEach(item => {
        // Jika disaring per nama spesifik, breakdown grafik beralih ke level toko (Store) agar lebih detail
        let key = item.namaBM; 
        if (kategoriSlicer === 'abm') key = item.namaABM;
        if (document.getElementById('slicerSpesifik').value !== 'all') key = item.namaStore;

        if (key) {
            performanceMap[key] = (performanceMap[key] || 0) + item.uptJuly;
        }
    });

    const labels = Object.keys(performanceMap);
    const dataValues = Object.values(performanceMap).map(val => parseFloat(val.toFixed(2)));

    const ctx = document.getElementById('bmChart');
    if (!ctx) return;

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
                borderRadius: 10,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: '#0f172a', padding: 12, cornerRadius: 10 }
            },
            scales: {
                x: { grid: { display: false }, ticks: { font: { family: 'Plus Jakarta Sans', weight: '600' }, color: '#64748b' } },
                y: { grid: { color: '#f1f5f9' }, ticks: { font: { family: 'Plus Jakarta Sans' }, color: '#94a3b8' } }
            }
        }
    });
}
