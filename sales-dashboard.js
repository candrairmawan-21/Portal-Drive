// ==========================================
// CONFIG & GLOBAL VARIABLES
// ==========================================
const BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub';
let salesData = [];
let salesChartInstance = null;

// PEMETAAN GID SESUAI DATA ANDA
const SHEET_GIDS = {
    'Jul26': '1248782513', 'Jun26': '511605214', 'May26': '2012772985',
    'Apr26': '544207481', 'Mar26': '90936589', 'Feb26': '472876079',
    'Jan26': '171319040', 'Dec25': '236016326', 'Nov25': '564328385',
    'Oct25': '0', 'Sep25': '0', 'Aug25': '0'
};

document.addEventListener('DOMContentLoaded', () => {
    renderLoggedInUser();
    displayUpdateDate();
    initMonthSlicer();
    fetchSalesData();
});

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

function getNormalizedUser() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const loginUsername = (currentUser.username || sessionStorage.getItem('portalUser') || 'guest').toLowerCase().trim();
    return { name: currentUser.name || loginUsername, role: currentUser.role || 'staff' };
}

function renderLoggedInUser() {
    const user = getNormalizedUser();
    const userContainer = document.getElementById('user-profile-nav');
    if (userContainer) {
        userContainer.innerHTML = `
            <div class="flex items-center gap-3 bg-slate-800/40 px-4 py-1.5 rounded-xl border border-slate-700 shadow-sm">
                <p class="text-xs font-bold text-white">${user.name}</p>
                <div class="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-xs font-black text-white uppercase">${user.name.charAt(0)}</div>
            </div>`;
    }
}

async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        const selectedKey = document.getElementById('slicerBulanSales').value;
        const gid = SHEET_GIDS[selectedKey] || '0';
        
        // Menambahkan timestamp agar browser tidak mengambil cache lama
        const finalUrl = `${BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
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
    // Parsing baris data (indeks 3 adalah baris data pertama)
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
    // Kolom C
    store: row[2]?.replace(/[\r"]/g, "") || "-",

    // Tidak digunakan lagi
    targetPoint: "-",

    // Kolom F
    mtdSales: parseFloat(
        row[5]?.replace(/[^0-9.-]+/g, "")
    ) || 0,

    // Kolom G
    mtdTarget: parseFloat(
        row[6]?.replace(/[^0-9.-]+/g, "")
    ) || 0,

    // Kolom Q
    bestEstimate: row[16]?.replace(/[\r"]/g, "") || "-",

    // Kolom R
    achPercent: parseFloat(
        row[17]?.replace(/[^0-9.-]+/g, "")
    ) || 0
});
        }
    }
    return result;
}

function renderSalesSummary() {
    let totalSales = 0, totalTarget = 0;
    salesData.forEach(item => { totalSales += item.mtdSales; totalTarget += item.mtdTarget; });
    const avgAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    document.getElementById('summary-total-sales').innerText = "Rp " + totalSales.toLocaleString('id-ID');
    document.getElementById('summary-avg-ach').innerText = avgAch + "%";
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
    const tbody.innerHTML = salesData.map(item => `
<tr class="border-b border-slate-800/80 hover:bg-slate-800/40">

    <td class="px-5 py-4 font-bold text-sm text-slate-200">
        ${item.store}
    </td>

    <td class="px-5 py-4 text-right text-sm">
        Rp ${item.mtdSales.toLocaleString('id-ID')}
    </td>

    <td class="px-5 py-4 text-right text-sm">
        Rp ${item.mtdTarget.toLocaleString('id-ID')}
    </td>

    <td class="px-5 py-4 text-center text-sm font-semibold text-amber-400">
        ${item.bestEstimate}
    </td>

    <td class="px-5 py-4 text-center">
        <span class="px-3 py-1 rounded-full text-[10px] font-black ${
            item.achPercent >= 100
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-rose-500/20 text-rose-400'
        }">
            ${item.achPercent.toFixed(2)}%
        </span>
    </td>

</tr>
`).join('');