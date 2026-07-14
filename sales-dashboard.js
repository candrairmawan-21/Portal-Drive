// ==========================================
// 1. CONFIG & GLOBAL VARIABLES
// ==========================================
const BASE_PUBLISH_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';
let salesData = [];
let salesChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    renderLoggedInUser();
    initMonthSlicer();
    fetchSalesData();
});

function getNormalizedUser() {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const loginUsername = (currentUser.username || sessionStorage.getItem('portalUser') || 'guest').toLowerCase().trim();
    return { name: currentUser.name || loginUsername, role: currentUser.role || 'staff' };
}

function renderLoggedInUser() {
    const user = getNormalizedUser();
    const userContainer = document.getElementById('user-profile-nav');
    if (userContainer) {
        userContainer.innerHTML = `<div class="flex items-center gap-3 bg-slate-800/40 px-4 py-1.5 rounded-xl"><p class="text-xs font-bold text-white">${user.name}</p><div class="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-xs font-black text-white">${user.name.charAt(0).toUpperCase()}</div></div>`;
    }
}

function initMonthSlicer() {
    const slicer = document.getElementById('slicerBulanSales');
    slicer.addEventListener('change', fetchSalesData);
}

async function fetchSalesData() {
    const loader = document.getElementById('sales-loading'); // Opsional jika element tidak ada
    try {
        const selectedMonth = document.getElementById('slicerBulanSales').value;
        const response = await fetch(`${BASE_PUBLISH_URL}&sheet=${selectedMonth}`);
        const csvText = await response.text();
        salesData = parseSalesCSV(csvText);
        renderSalesSummary();
        renderSalesChart();
        renderSalesTable();
    } catch (error) { console.error('Error:', error); }
}

// LOGIKA PARSING ASLI DIKEMBALIKAN AGAR DATA TERBACA
function parseSalesCSV(text) {
    let lines = text.split('\n');
    let result = [];
    for (let i = 3; i < lines.length; i++) { 
        if (!lines[i]) continue;
        let row = []; let inQuotes = false; let currentStr = "";
        for (let char of lines[i]) {
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; }
            else currentStr += char;
        }
        row.push(currentStr.trim());
        if (row.length >= 20) {
            result.push({
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
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;
    tbody.innerHTML = salesData.map(item => `
        <tr class="border-b border-slate-800">
            <td class="px-5 py-4 font-bold">${item.store}</td>
            <td class="px-5 py-4 text-slate-400">${item.targetPoint}</td>
            <td class="px-5 py-4 text-right">Rp ${item.mtdSales.toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right">Rp ${item.mtdTarget.toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center"><span class="px-3 py-1 rounded-full text-xs font-black ${item.achPercent >= 100 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}">${item.achPercent.toFixed(1)}%</span></td>
        </tr>
    `).join('');
}
// ... (Bagian atas file tetap sama) ...

async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        const selectedMonth = document.getElementById('slicerBulanSales').value;
        const response = await fetch(`${BASE_PUBLISH_URL}&sheet=${selectedMonth}`);
        const csvText = await response.text();
        
        // DEBUG: Buka Browser Console (F12) untuk melihat apakah data masuk
        console.log("Raw CSV Data:", csvText.substring(0, 100)); 
        
        salesData = parseSalesCSV(csvText);
        
        console.log("Parsed Data count:", salesData.length);
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
    // Kita mulai dari i = 1 (baris ke-2), lalu kita coba deteksi kolom secara fleksibel
    for (let i = 1; i < lines.length; i++) { 
        if (!lines[i]) continue;
        let row = lines[i].split(',');
        
        // Cek jika data ada isinya
        if (row.length > 5) {
            result.push({
                store: row[2] ? row[2].replace(/[\r"]/g, "") : "Unknown",
                targetPoint: row[3] ? row[3].replace(/[\r"]/g, "") : "-",
                mtdSales: parseFloat(row[5]?.replace(/[^0-9.-]+/g,"")) || 0, // Coba kolom 5 (index F)
                mtdTarget: parseFloat(row[7]?.replace(/[^0-9.-]+/g,"")) || 0, // Coba kolom 7 (index H)
                selisihNext: row[11] ? row[11].replace(/[\r"]/g, "") : "0",
                achPercent: parseFloat(row[22]?.replace(/[^0-9.-]+/g,"")) || 0
            });
        }
    }
    return result;
}

