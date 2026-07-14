// ==========================================
// 1. CONFIG & GLOBAL VARIABLES
// ==========================================
// URL CSV Utama yang sudah dipublish dari Google Sheet Sales Target Anda
const BASE_PUBLISH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';

let salesData = [];
let salesChartInstance = null;

// Database User Manual (Sinkron dengan login utama Anda)
const USER_MAPPING = {
    'admin':     { namaDiSheets: 'Admin Global', role: 'admin' },
    
    // Akun BM
    'bm_ika':    { namaDiSheets: 'Ika Nuraini', role: 'bm' },
    'bm galih':  { namaDiSheets: 'Galih Bagus Perdana', role: 'bm' },
    'bm didik':  { namaDiSheets: 'Didik Supriyadi', role: 'bm' },
    
    // Akun ABM
    'abm_bayu':   { namaDiSheets: 'Bayu Setiawan', role: 'abm' },
    'abm_ika':    { namaDiSheets: 'Ika', role: 'abm' }, 
    'abm bayu':   { namaDiSheets: 'Bayu Eka Nugraha', role: 'abm' },
    'abm satria': { namaDiSheets: 'Satriawan Sejati', role: 'abm' },
    'abm fachri': { namaDiSheets: 'Fachri Anggoro Budi', role: 'abm' }, 
    'abm gading': { namaDiSheets: 'Gading Hanif Prasetya', role: 'abm' }, 
    'abm anas':   { namaDiSheets: 'Anas Makruf', role: 'abm' },
    'abmanas':    { namaDiSheets: 'Anas Makruf', role: 'abm' },
    'abm adinda': { namaDiSheets: 'Adinda Febiyanti', role: 'abm' },
    'abm wildan': { namaDiSheets: 'Wildan Aulia Rakhman', role: 'abm' },
    'abm ridho':  { namaDiSheets: 'Ridho Malandi', role: 'abm' }
};

// Inisialisasi awal saat halaman selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
    renderLoggedInUser();
    initMonthSlicer(); // Deteksi otomatis bulan berjalan saat ini
    fetchSalesData();  // Tarik data sales dari Google Sheet
});

// Helper mengenali user login secara aman (anti-spasi/huruf besar kecil)
function getNormalizedUser() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    const loginUsername = (currentUser.username || localStorage.getItem('username') || 'guest').toLowerCase().trim();
    const cleanUsername = loginUsername.replace(/[\s_\-]/g, '');

    let matchedKey = null;
    Object.keys(USER_MAPPING).forEach(key => {
        if (key.toLowerCase().replace(/[\s_\-]/g, '') === cleanUsername) { matchedKey = key; }
    });

    if (matchedKey) {
        return { name: USER_MAPPING[matchedKey].namaDiSheets, role: USER_MAPPING[matchedKey].role, username: loginUsername };
    }
    return { name: currentUser.name || loginUsername, role: currentUser.role || 'staff', username: loginUsername };
}

// Menampilkan User Profile Ringkas di Header Dashboard Sales
function renderLoggedInUser() {
    const user = getNormalizedUser();
    const userContainer = document.getElementById('user-profile-nav');
    if (userContainer) {
        userContainer.innerHTML = `
            <div class="flex items-center gap-3 bg-slate-800/40 border border-slate-700/60 px-4 py-1.5 rounded-xl backdrop-blur-sm">
                <div class="text-right hidden sm:block">
                    <p class="text-xs font-black text-white leading-none">${user.name}</p>
                    <p class="text-[9px] text-amber-400 font-bold tracking-wider uppercase mt-0.5">${user.role.toUpperCase()}</p>
                </div>
                <div class="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-orange-400 flex items-center justify-center text-white font-black text-xs shadow-sm uppercase">
                    ${user.name.charAt(0)}
                </div>
            </div>
        `;
    }
}

// Sinkronisasi Slicer Bulan dengan Waktu Riil di HP/Sistem
function initMonthSlicer() {
    const slicerBulan = document.getElementById('slicerBulanSales');
    if (!slicerBulan) return;

    // Menghasilkan format 3 huruf awal bulan ini (Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonthName = months[new Date().getMonth()];

    // Atur value select option ke bulan saat ini secara otomatis
    slicerBulan.value = currentMonthName;

    // Daftarkan aksi ketika user mengubah bulan data di dashboard
    slicerBulan.addEventListener('change', () => {
        fetchSalesData();
    });
}

// ==========================================
// 2. FETCH & PARSE DATA SALES DYNAMIC URL
// ==========================================
async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        // Baca bulan apa yang sedang dipilih di Slicer
        const selectedMonth = document.getElementById('slicerBulanSales')?.value || 'Jul';
        
        // Gabungkan base URL Google Sheet dengan parameter nama Sheet bulan
        const finalUrl = `${BASE_PUBLISH_URL}&sheet=${selectedMonth}`;

        const response = await fetch(finalUrl);
        const csvText = await response.text();
        const allData = parseSalesCSV(csvText);

                salesData = allData;


        // Render hasil pemrosesan data ke UI komponen masing-masing
        renderSalesSummary();
        renderSalesChart();
        renderSalesTable();

    } catch (error) {
        console.error('Error load data sales:', error);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

// Parser Data khusus membaca struktur baris target sales baru Anda
function parseSalesCSV(text) {
    let lines = text.split('\n');
    if (lines.length === 0) return [];

    let result = [];
    // Data di Google Sheet Anda dimulai dari baris index ke-3 (baris ke-4 di Excel/Sheet asli)
    for (let i = 3; i < lines.length; i++) { 
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

        if (row.length >= 20) {
            result.push({
                bm: row[0].replace(/[\r"]/g, ""),
                abm: row[1].replace(/[\r"]/g, ""),
                store: row[2].replace(/[\r"]/g, ""),
                targetPoint: row[3].replace(/[\r"]/g, ""),
                lastDaySales: parseFloat(row[5].replace(/[^0-9.-]+/g,"")) || 0, // Kolom F
                mtdSales: parseFloat(row[7].replace(/[^0-9.-]+/g,"")) || 0,    // Kolom H
                mtdTarget: parseFloat(row[9].replace(/[^0-9.-]+/g,"")) || 0,   // Kolom J
                selisihNext: row[11].replace(/[\r"]/g, ""),                    // Kolom L
                atv: parseFloat(row[17].replace(/[^0-9.-]+/g,"")) || 0,        // Kolom R
                upt: parseFloat(row[19]) || 0,                                 // Kolom T
                achPercent: parseFloat(row[22].replace(/[^0-9.-]+/g,"")) || 0  // Kolom W
            });
        }
    }
    return result;
}

// ==========================================
// 3. RENDER METRIK RINGKASAN UTAMA (CARDS)
// ==========================================
function renderSalesSummary() {
    let totalSales = 0;
    let totalTarget = 0;
    let totalUPT = 0;
    let countStore = salesData.length;

    salesData.forEach(item => {
        totalSales += item.mtdSales;
        totalTarget += item.mtdTarget;
        totalUPT += item.upt;
    });

    const averageAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    const averageUPT = countStore > 0 ? (totalUPT / countStore).toFixed(2) : 0;

    const totalSalesEl = document.getElementById('summary-total-sales');
    const averageAchEl = document.getElementById('summary-avg-ach');
    const averageUptEl = document.getElementById('summary-avg-upt');

    if (totalSalesEl) totalSalesEl.innerText = "Rp " + totalSales.toLocaleString('id-ID');
    if (averageAchEl) averageAchEl.innerText = averageAch + "%";
    if (averageUptEl) averageUptEl.innerText = averageUPT;
}

// ==========================================
// 4. GENERATE GRAFIK TARGET VS SALES (CHART.JS)
// ==========================================
function renderSalesChart() {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;

    const labels = salesData.map(item => item.store);
    const mtdSalesValues = salesData.map(item => item.mtdSales);
    const mtdTargetValues = salesData.map(item => item.mtdTarget);

    if (salesChartInstance) { salesChartInstance.destroy(); }

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Pencapaian (MTD Sales)',
                    backgroundColor: 'rgba(34, 197, 94, 0.85)', // Warna Hijau rapi
                    data: mtdSalesValues,
                    borderRadius: 6
                },
                {
                    label: 'Target (MTD Target)',
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',  // Warna Merah transparan
                    data: mtdTargetValues,
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { boxWidth: 12, font: { weight: '600', size: 11 } } }
            },
            scales: {
                x: { grid: { display: false } },
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) { return 'Rp ' + (value / 1000000) + ' Jt'; }
                    }
                }
            }
        }
    });
}

// ==========================================
// 5. RENDER TABEL MONITOR TARGET TOKO
// ==========================================
function renderSalesTable() {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (salesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-slate-400 py-6 font-medium">Tidak ada data toko atau tab bulan belum tersedia</td></tr>`;
        return;
    }

    salesData.forEach(item => {
        // Jika pencapaian >= 100% kasih warna hijau, jika di bawah kasih warna merah mendalam
        const badgeColor = item.achPercent >= 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
        
        tbody.innerHTML += `
            <tr class="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                <td class="px-4 py-3 font-bold text-slate-800">${item.store}</td>
                <td class="px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wide">${item.targetPoint}</td>
                <td class="px-4 py-3 text-right text-slate-700 font-semibold">Rp ${item.mtdSales.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-right text-slate-400 text-xs">Rp ${item.mtdTarget.toLocaleString('id-ID')}</td>
                <td class="px-4 py-3 text-right text-xs text-orange-600 font-black tracking-wide">${item.selisihNext}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2.5 py-1 rounded-full text-xs font-black ${badgeColor}">
                        ${item.achPercent.toFixed(1)}%
                    </span>
                </td>
            </tr>
        `;
    });
}
