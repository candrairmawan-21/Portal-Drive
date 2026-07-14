// ==========================================
// 1. CONFIG & GLOBAL VARIABLES
// ==========================================
const BASE_PUBLISH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';

let salesData = [];
let salesChartInstance = null;

// Database User Manual
const USER_MAPPING = {
    'admin':     { namaDiSheets: 'Admin Global', role: 'admin' },
    'bm_ika':    { namaDiSheets: 'Ika Nuraini', role: 'bm' },
    'bm galih':  { namaDiSheets: 'Galih Bagus Perdana', role: 'bm' },
    'bm didik':  { namaDiSheets: 'Didik Supriyadi', role: 'bm' },
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

document.addEventListener('DOMContentLoaded', () => {
    renderLoggedInUser();
    initMonthSlicer();
    fetchSalesData();
});

function getNormalizedUser() {
    // Sinkron dengan sessionStorage
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const loginUsername = (currentUser.username || sessionStorage.getItem('portalUser') || 'guest').toLowerCase().trim();
    
    return { 
        name: currentUser.name || loginUsername, 
        role: currentUser.role || 'staff', 
        username: loginUsername 
    };
}

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

function initMonthSlicer() {
    const slicerBulan = document.getElementById('slicerBulanSales');
    if (!slicerBulan) return;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    slicerBulan.value = months[new Date().getMonth()];
    slicerBulan.addEventListener('change', () => { fetchSalesData(); });
}

async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        const selectedMonth = document.getElementById('slicerBulanSales')?.value || 'Jul';
        const finalUrl = `${BASE_PUBLISH_URL}&sheet=${selectedMonth}`;

        const response = await fetch(finalUrl);
        const csvText = await response.text();
        
        // --- DATA SEMUA DITAMPILKAN (Otorisasi Dihapus) ---
        salesData = parseSalesCSV(csvText);

        renderSalesSummary();
        renderSalesChart();
        renderSalesTable();
    } catch (error) {
        console.error('Error load data sales:', error);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function parseSalesCSV(text) {
    let lines = text.split('\n');
    let result = [];
    for (let i = 3; i < lines.length; i++) { 
        if (!lines[i]) continue;
        let row = []; let inQuotes = false; let currentStr = "";
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
                mtdSales: parseFloat(row[7].replace(/[^0-9.-]+/g,"")) || 0,
                mtdTarget: parseFloat(row[9].replace(/[^0-9.-]+/g,"")) || 0,
                selisihNext: row[11].replace(/[\r"]/g, ""),
                achPercent: parseFloat(row[22].replace(/[^0-9.-]+/g,"")) || 0
            });
        }
    }
    return result;
}

function renderSalesSummary() {
    let totalSales = 0, totalTarget = 0, totalUPT = 0, countStore = salesData.length;
    salesData.forEach(item => { totalSales += item.mtdSales; totalTarget += item.mtdTarget; });
    const averageAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    document.getElementById('summary-total-sales').innerText = "Rp " + totalSales.toLocaleString('id-ID');
    document.getElementById('summary-avg-ach').innerText = averageAch + "%";
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
                { label: 'MTD Sales', backgroundColor: 'rgba(34, 197, 94, 0.85)', data: salesData.map(item => item.mtdSales) },
                { label: 'MTD Target', backgroundColor: 'rgba(239, 68, 68, 0.5)', data: salesData.map(item => item.mtdTarget) }
            ]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function renderSalesTable() {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;
    tbody.innerHTML = salesData.map(item => `
        <tr class="border-b border-slate-800 hover:bg-slate-800/50">
            <td class="px-5 py-4 font-bold">${item.store}</td>
            <td class="px-5 py-4 text-slate-400">${item.targetPoint}</td>
            <td class="px-5 py-4 text-right">Rp ${item.mtdSales.toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right">Rp ${item.mtdTarget.toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-orange-500">${item.selisihNext}</td>
            <td class="px-5 py-4 text-center"><span class="px-3 py-1 rounded-full text-xs font-black ${item.achPercent >= 100 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${item.achPercent.toFixed(1)}%</span></td>
        </tr>
    `).join('');
}
