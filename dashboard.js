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

// Parser CSV Sederhana untuk Dashboard UPT
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

    if (!slicerKategori || !slicerSpesifik) return;

    // Bersihkan event listener lama dengan mengganti elemen (clone) agar tidak double trigger
    const newSlicerKategori = slicerKategori.cloneNode(true);
    slicerKategori.parentNode.replaceChild(newSlicerKategori, slicerKategori);

    const newSlicerSpesifik = slicerSpesifik.cloneNode(true);
    slicerSpesifik.parentNode.replaceChild(newSlicerSpesifik, slicerSpesifik);

    // Daftarkan ulang event listener pada elemen baru
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
            
            // Ambil data unique berdasarkan kategori yang dipilih (Kolom A untuk BM, Kolom B untuk ABM)
            let uniqueItems = new Set();
            dashboardData.forEach(item => {
                if (kategori === 'bm' && item.namaBM) uniqueItems.add(item.namaBM);
                if (kategori === 'abm' && item.namaABM) uniqueItems.add(item.namaABM);
            });

            // Masukkan data unique ke dalam Slicer 3
            Array.from(uniqueItems).sort().forEach(name => {
                targetSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applyDashboardFilters();
    });

    document.getElementById('slicerBulan').addEventListener('change', applyDashboardFilters);
    document.getElementById('slicerSpesifik').addEventListener('change', applyDashboardFilters);
}

// FUNGSI UNTUK MENYARING DATA BERDASARKAN PILIHAN SLICER
function applyDashboardFilters() {
    const kategori = document.getElementById('slicerKategori').value;
    const spesifik = document.getElementById('slicerSpesifik').value;

    let filteredData = [...dashboardData];

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

    // Render komponen dengan data yang sudah disaring
    renderPodiumTop3(filteredData);
    renderPodiumBottom3(filteredData);
    renderChartPerforma(filteredData);
}

// 1. RENDER TOP 3 STAFF
function renderPodiumTop3(data) {
    const container = document.getElementById('podium-top-content');
    if (!container) return;

    let sorted = [...data].sort((a, b) => b.uptJuly - a.uptJuly);
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'top');
}

// 2. RENDER BOTTOM 3 STAFF
function renderPodiumBottom3(data) {
    const container = document.getElementById('podium-bottom-content');
    if (!container) return;

    // Abaikan data yang poin UPT-nya 0 agar pencarian bottom lebih akurat
    let validData = data.filter(item => item.uptJuly > 0);
    if (validData.length === 0) validData = data;

    let sorted = [...validData].sort((a, b) => a.uptJuly - b.uptJuly);
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'bottom');
}

// HELPER UNTUK MEMBUAT STRUKTUR HTML PODIUM (NAMA TIDAK TERPOTONG)
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
            <!-- JUARA 2 (KIRI) -->
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

            <!-- JUARA 1 (TENGAH) -->
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

            <!-- JUARA 3 (KANAN) -->
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

// 3. GENERATE DIAGRAM BATANG BERDASARKAN AKUMULASI DATA (CHART.JS)
function renderChartPerforma(data) {
    const ctx = document.getElementById('bmChart');
    if (!ctx) return;

    let performanceMap = {};
    const kategoriSlicer = document.getElementById('slicerKategori').value;
    const spesifikSlicer = document.getElementById('slicerSpesifik').value;

    data.forEach(item => {
        let key = item.namaBM; 
        if (kategoriSlicer === 'abm') key = item.namaABM;
        if (spesifikSlicer !== 'all') key = item.namaStaff; // Breakdown ke nama staff jika nama BM/ABM dipilih

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
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: '#64748b', font: { size: 10, weight: '600' } } },
                y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8' } }
            }
        }
    });
}
