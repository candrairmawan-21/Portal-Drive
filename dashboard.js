// ==========================================
// 1. INITIALIZATION & GLOBAL VARIABEL
// ==========================================
let globalData = [];

// Tunggu DOM selesai dimuat sebelum menjalankan inisialisasi utama
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

async function initDashboard() {
    try {
        // Ambil data dari Apps Script Web App atau source data Anda
        const response = await fetch('https://script.google.com/macros/s/AKfycbzV8g1Hh-zVNDqK7D8T6_2z9rDqC89k-xWz/exec'); // Sesuaikan URL API Anda jika berbeda
        const json = await response.json();
        
        if (json && json.data) {
            globalData = json.data;
            
            // Render semua komponen utama dashboard
            populateFilters(globalData);
            updateDashboard();
        } else {
            console.error('Format data tidak sesuai atau kosong');
        }
    } catch (error) {
        console.error('Gagal memuat data dashboard:', error);
    }
}

// ==========================================
// 2. LOGIKAFILTER & SLICER
// ==========================================
function populateFilters(data) {
    const bulanSelect = document.getElementById('slicer-bulan');
    const grupSelect = document.getElementById('slicer-grup');
    const namaSelect = document.getElementById('slicer-nama');

    // Ambil list unik untuk filter
    const uniqueBulan = [...new Set(data.map(item => item.bulan || 'July 2026'))];
    const uniqueGrup = [...new Set(data.map(item => item.kategoriGrup).filter(Boolean))];
    const uniqueNama = [...new Set(data.map(item => item.namaStaff).filter(Boolean))].sort();

    // Isi Slicer Bulan
    if (bulanSelect) {
        bulanSelect.innerHTML = uniqueBulan.map(b => `<option value="${b}">${b}</option>`).join('');
        bulanSelect.addEventListener('change', updateDashboard);
    }

    // Isi Slicer Kategori Grup
    if (grupSelect) {
        grupSelect.innerHTML = '<option value="all">All Data (Semua)</option>' + 
            uniqueGrup.map(g => `<option value="${g}">${g}</option>`).join('');
        grupSelect.addEventListener('change', updateDashboard);
    }

    // Isi Slicer Pilih Nama
    if (namaSelect) {
        namaSelect.innerHTML = '<option value="all">-- Semua --</option>' + 
            uniqueNama.map(n => `<option value="${n}">${n}</option>`).join('');
        namaSelect.addEventListener('change', updateDashboard);
    }
}

function getFilteredData() {
    const bulanVal = document.getElementById('slicer-bulan')?.value;
    const grupVal = document.getElementById('slicer-grup')?.value;
    const namaVal = document.getElementById('slicer-nama')?.value;

    return globalData.filter(item => {
        const matchBulan = !bulanVal || (item.bulan === bulanVal || bulanVal === 'July 2026');
        const matchGrup = !grupVal || grupVal === 'all' || item.kategoriGrup === grupVal;
        const matchNama = !namaVal || namaVal === 'all' || item.namaStaff === namaVal;
        return matchBulan && matchGrup && matchNama;
    });
}

function updateDashboard() {
    const filtered = getFilteredData();
    
    // Panggil fungsi render utama
    renderPodiumTop3(filtered);
    renderPodiumBottom3(filtered);
    renderBarChart(filtered);
}

// ==========================================
// 3. RENDERING PODIUM (TOP 3 & BOTTOM 3)
// ==========================================
function renderPodiumTop3(data) {
    const container = document.getElementById('podium-top-content');
    if (!container) return;

    // Urutkan dari nilai tertinggi ke terendah berdasarkan pencarian UPT July
    let sorted = [...data].sort((a, b) => (b.uptJuly || 0) - (a.uptJuly || 0));
    
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 };

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'top');
}

function renderPodiumBottom3(data) {
    const container = document.getElementById('podium-bottom-content');
    if (!container) return;

    // Filter data yang valid (> 0) agar peringkat bawah tidak diisi data kosong/0
    let validData = data.filter(item => (item.uptJuly || 0) > 0);
    if (validData.length === 0) validData = data;

    // Urutkan dari terendah ke tertinggi
    let sorted = [...validData].sort((a, b) => (a.uptJuly || 0) - (b.uptJuly || 0));
    
    const p1 = sorted[0] || { namaStaff: '-', namaStore: '-', uptJuly: 0 }; // Terendah 1
    const p2 = sorted[1] || { namaStaff: '-', namaStore: '-', uptJuly: 0 }; // Terendah 2
    const p3 = sorted[2] || { namaStaff: '-', namaStore: '-', uptJuly: 0 }; // Terendah 3

    container.innerHTML = generatePodiumHTML(p1, p2, p3, 'bottom');
}

// HELPER GENERATOR HTML PODIUM (Aman tanpa bentrokan library Ikon luar)
function generatePodiumHTML(p1, p2, p3, type) {
    const isTop = type === 'top';
    const colorClass = isTop 
        ? { bar1: 'from-amber-500 to-amber-400', txt1: 'text-amber-600', badge1: 'from-amber-500 to-orange-500' }
        : { bar1: 'from-rose-500 to-rose-400', txt1: 'text-rose-600', badge1: 'from-rose-500 to-red-600' };

    // Menggunakan SVG murni agar ikon langsung muncul instan tanpa jeda script luar
    const iconSvg = isTop 
        ? `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-amber-500 animate-bounce" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7z"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 fill-current text-rose-500 animate-bounce" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;

    return `
        <div class="flex items-end justify-center gap-2 sm:gap-4 pt-12 pb-2 max-w-md mx-auto w-full">
            <!-- JUARA 2 (SEBELAH KIRI) -->
            <div class="flex flex-col items-center flex-1 w-0">
                <div class="text-center mb-2 w-full">
                    <p class="font-extrabold text-xs text-slate-700 truncate px-1">${p2.namaStaff}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase truncate px-1">${p2.namaStore}</p>
                    <span class="text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p2.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-slate-200 to-slate-100 h-20 rounded-t-2xl border-t-2 border-slate-300 flex items-center justify-center relative shadow-sm">
                    <span class="text-2xl font-black text-slate-400">2</span>
                </div>
            </div>

            <!-- JUARA 1 (DI TENGAH) -->
            <div class="flex flex-col items-center flex-1 transform -translate-y-4 w-0">
                <div class="text-center mb-2 w-full">
                    <div class="flex justify-center mb-0.5">${iconSvg}</div>
                    <p class="font-black text-sm text-slate-800 truncate px-1">${p1.namaStaff}</p>
                    <p class="text-[10px] ${colorClass.txt1} font-extrabold uppercase truncate px-1">${p1.namaStore}</p>
                    <span class="text-xs font-black text-white bg-gradient-to-r ${colorClass.badge1} px-2.5 py-0.5 rounded-lg shadow-sm">${p1.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t ${colorClass.bar1} h-28 rounded-t-2xl border-t-2 border-white/20 flex items-center justify-center relative shadow-md">
                    <span class="text-3xl font-black text-white drop-shadow-sm">1</span>
                </div>
            </div>

            <!-- JUARA 3 (SEBELAH KANAN) -->
            <div class="flex flex-col items-center flex-1 w-0">
                <div class="text-center mb-2 w-full">
                    <p class="font-extrabold text-xs text-slate-700 truncate px-1">${p3.namaStaff}</p>
                    <p class="text-[10px] text-slate-400 font-bold uppercase truncate px-1">${p3.namaStore}</p>
                    <span class="text-xs font-black text-slate-600 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">${p3.uptJuly}</span>
                </div>
                <div class="w-full bg-gradient-to-t from-orange-100 to-orange-50/40 h-14 rounded-t-2xl border-t-2 border-orange-200 flex items-center justify-center relative shadow-sm">
                    <span class="text-xl font-black text-orange-400">3</span>
                </div>
            </div>
        </div>
    `;
}

// ==========================================
// 4. RENDERING CHART EVALUASI (APEXCHARTS)
// ==========================================
let chartInstance = null;

function renderBarChart(data) {
    const chartContainer = document.getElementById('chart-evaluasi');
    if (!chartContainer) return;

    // Siapkan data sumbu X dan Y
    const categories = data.map(item => item.namaStaff || '-');
    const seriesData = data.map(item => item.uptJuly || 0);

    const options = {
        series: [{
            name: 'Pencapaian UPT',
            data: seriesData
        }],
        chart: {
            type: 'bar',
            height: 350,
            toolbar: { show: false }
        },
        colors: ['#f59e0b'], // Amber warna tema portal Anda
        plotOptions: {
            bar: {
                borderRadius: 6,
                horizontal: false,
                columnWidth: '45%'
            }
        },
        dataLabels: { enabled: false },
        xaxis: {
            categories: categories,
            labels: {
                rotate: -45,
                style: { fontSize: '10px', fontWeight: 600 }
            }
        },
        yaxis: {
            title: { text: 'Total Poin UPT' }
        }
    };

    // Hancurkan instance chart lama jika sudah ada untuk menghindari tumpang tindih render
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new ApexCharts(chartContainer, options);
    chartInstance.render();
}
