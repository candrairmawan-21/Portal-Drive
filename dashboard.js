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
        
        // Render semua komponen setelah data berhasil diambil
        renderPodium();
        renderChart();
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
    
    // Header: Nama BM, Nama ABM, Nama Store, NIK, Nama Staff, UPT July
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

// 1. FUNGSI UNTUK MERENDER PODIUM TOP 3 STAFF
function renderPodium() {
    // Urutkan staff berdasarkan nilai UPT July tertinggi
    let sortedStaff = [...dashboardData].sort((a, b) => b.uptJuly - a.uptJuly);
    
    const p1 = sortedStaff[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sortedStaff[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sortedStaff[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    const podiumContainer = document.getElementById('podium-content');
    if (!podiumContainer) return;

    podiumContainer.innerHTML = `
        <div class="flex items-end justify-center gap-2 sm:gap-4 pt-16 pb-6 max-w-md mx-auto">
            <!-- JUARA 2 (KIRI) -->
            <div class="flex flex-col items-center flex-1">
                <div class="text-center mb-2">
                    <p class="font-extrabold text-xs text-slate-700 truncate w-24 sm:w-28">${p2.namaStaff}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">${p2.namaStore}</p>
                    <span class="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">${p2.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-slate-200 to-slate-100 h-24 rounded-t-2xl border-t-2 border-slate-300 shadow-inner flex items-center justify-center relative group">
                    <span class="text-3xl font-black text-slate-400">2</span>
                    <div class="absolute -top-5 bg-slate-400 text-white p-1 rounded-full shadow-md"><i data-lucide="medal" class="w-4 h-4"></i></div>
                </div>
            </div>

            <!-- JUARA 1 (TENGAH) -->
            <div class="flex flex-col items-center flex-1 transform -translate-y-4">
                <div class="text-center mb-2">
                    <div class="flex justify-center text-amber-500 animate-bounce mb-0.5"><i data-lucide="crown" class="w-6 h-6 fill-current"></i></div>
                    <p class="font-black text-sm text-slate-800 truncate w-24 sm:w-28">${p1.namaStaff}</p>
                    <p class="text-[10px] text-amber-600 font-extrabold uppercase">${p1.namaStore}</p>
                    <span class="text-sm font-black text-white bg-gradient-to-r from-amber-500 to-orange-500 px-2.5 py-0.5 rounded-lg shadow-sm">${p1.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-amber-500 to-amber-400 h-36 rounded-t-2xl border-t-2 border-amber-300 shadow-[0_10px_20px_rgba(245,158,11,0.15)] flex items-center justify-center relative">
                    <span class="text-4xl font-black text-white drop-shadow-sm">1</span>
                </div>
            </div>

            <!-- JUARA 3 (KANAN) -->
            <div class="flex flex-col items-center flex-1">
                <div class="text-center mb-2">
                    <p class="font-extrabold text-xs text-slate-700 truncate w-24 sm:w-28">${p3.namaStaff}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase">${p3.namaStore}</p>
                    <span class="text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">${p3.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-orange-100 to-orange-50/50 h-16 rounded-t-2xl border-t-2 border-orange-200 shadow-inner flex items-center justify-center relative">
                    <span class="text-2xl font-black text-orange-400">3</span>
                    <div class="absolute -top-5 bg-orange-400 text-white p-1 rounded-full shadow-md"><i data-lucide="award" class="w-4 h-4"></i></div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons();
}

// 2. FUNGSI UNTUK MERENDER DIAGRAM PERFORMA BERDASARKAN BM (Branch Manager)
function renderChart() {
    // Akumulasi total nilai UPT July per Branch Manager (BM)
    let bmPerformance = {};
    dashboardData.forEach(item => {
        if(item.namaBM) {
            bmPerformance[item.namaBM] = (bmPerformance[item.namaBM] || 0) + item.uptJuly;
        }
    });

    const labels = Object.keys(bmPerformance);
    const dataValues = Object.values(bmPerformance).map(val => parseFloat(val.toFixed(2)));

    const ctx = document.getElementById('bmChart');
    if (!ctx) return;

    // Jika grafik sudah ada, hancurkan dulu sebelum digambar ulang agar tidak tumpang tindih
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Poin UPT July',
                data: dataValues,
                backgroundColor: 'rgba(245, 158, 11, 0.85)', // Warna Amber khas Midnorth
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 0,
                borderRadius: 12,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#0f172a',
                    padding: 12,
                    titleFont: { size: 13, weight: 'bold', family: 'Plus Jakarta Sans' },
                    bodyFont: { size: 12, family: 'Plus Jakarta Sans' },
                    cornerRadius: 12
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { family: 'Plus Jakarta Sans', weight: '600', size: 11 }, color: '#64748b' }
                },
                y: {
                    grid: { color: '#f1f5f9' },
                    ticks: { font: { family: 'Plus Jakarta Sans', size: 11 }, color: '#94a3b8' }
                }
            }
        }
    });
}
