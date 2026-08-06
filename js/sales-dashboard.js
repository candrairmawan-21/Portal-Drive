/* ==========================================================================
   1. KONFIGURASI GLOBAL & MAPPING GID SHEETS
   ========================================================================== */
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz0OP_PZzwnj5LJFfus99KyLSqwiD5PFDQK6QX9Br2FTHrEFOM8pMgEXZpsLhd26ZWz/exec";

// Disinkronkan dengan SPREADSHEET_ID pada Code.gs (Single Source of Truth)
const SPREADSHEET_ID_OFFICIAL = "1P70howhagUA_H4H0cSXUWB5MjDhCKuOirVLSmh39Z_E";

let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd';
let currentSalesSource = 'SUBMISSION'; // 'SUBMISSION' atau 'OFFICIAL_IT_REPORT'

// GID Sheet Lengkap (Termasuk Alias untuk Official IT Report)
const SHEET_GIDS = {
    'OFFICIAL_IT_REPORT': '1129267198',
    'OFFICIAL_IT': '1129267198', // Alias agar aman dari bug pemanggilan key
    'Oct26': '1682478488', 
    'Sep26': '432381843', 
    'Aug26': '1766415704', 
    'Jul26': '1248782513', 
    'Jun26': '511605214', 
    'May26': '2012772985',
    'Apr26': '544207481', 
    'Mar26': '90936589', 
    'Feb26': '472876079',
    'Jan26': '171319040', 
    'Dec25': '236016326', 
    'Nov25': '564328385'
};

/* ==========================================================================
   2. INITIALIZATION & SOURCE SWITCHER
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    displayUpdateDate();
    initSalesSlicers();
    fetchSalesData();
});

function displayUpdateDate() {
    const dateEl = document.getElementById('update-date');
    if (dateEl) {
        const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        dateEl.innerText = "Update Terakhir: " + today;
    }
}

/**
 * Fungsi Ganti Sumber Data (Store Submission vs Official IT Report)
 */
window.switchSalesSource = function(sourceType) {
    currentSalesSource = sourceType;
    
    const btnSub = document.getElementById('btn-src-submission');
    const btnOff = document.getElementById('btn-src-official');
    const slicerBulan = document.getElementById('slicerBulanSales');

    if (sourceType === 'OFFICIAL_IT') {
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
        if (slicerBulan) slicerBulan.disabled = true;
    } else {
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
        if (slicerBulan) slicerBulan.disabled = false;
    }

    fetchSalesData();
};

function initSalesSlicers() {
    const slicerBulan = document.getElementById('slicerBulanSales');
    const slicerKategori = document.getElementById('slicerKategoriSales');
    const slicerSpesifik = document.getElementById('slicerSpesifikSales');

    if (!slicerKategori || !slicerSpesifik) return;

    slicerKategori.addEventListener('change', function() {
        const kategori = this.value;
        slicerSpesifik.innerHTML = '<option value="all">-- Semua --</option>';
        
        if (kategori === 'all') {
            slicerSpesifik.disabled = true;
            slicerSpesifik.classList.add('bg-slate-100', 'cursor-not-allowed');
        } else {
            slicerSpesifik.disabled = false;
            slicerSpesifik.classList.remove('bg-slate-100', 'cursor-not-allowed');
            
            let uniqueItems = new Set();
            salesData.forEach(item => {
                if (kategori === 'store' && item.store && item.store !== "-") {
                    uniqueItems.add(item.store.trim());
                } else if (kategori === 'bm' && item.bm && item.bm !== "-") {
                    uniqueItems.add(item.bm.trim());
                } else if (kategori === 'abm' && item.abm && item.abm !== "-") {
                    uniqueItems.add(item.abm.trim());
                }
            });

            Array.from(uniqueItems).sort().forEach(name => {
                slicerSpesifik.innerHTML += `<option value="${name}">${name}</option>`;
            });
        }
        applySalesFilters();
    });

    slicerSpesifik.addEventListener('change', applySalesFilters);
    if (slicerBulan) {
        slicerBulan.addEventListener('change', () => {
            fetchSalesData();
            if (typeof fetchAndRenderUptSalesTable === "function") fetchAndRenderUptSalesTable();
        });
    }
}

/* ==========================================================================
   3. DATA FETCHING & SMART PARSER CSV
   ========================================================================== */
async function fetchSalesData() {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');

    try {
        let finalUrl = '';
        
        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            // Gunakan Spreadsheet ID yang disinkronkan dengan Code.gs
            const gid = SHEET_GIDS['OFFICIAL_IT_REPORT'] || '1129267198';
            finalUrl = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID_OFFICIAL}/export?format=csv&gid=${gid}&t=${Date.now()}`;
        } else {
            // Menggunakan link publikasi pub?output=csv untuk data bulanan
            const selectedKey = document.getElementById('slicerBulanSales')?.value || 'Aug26';
            let gid = SHEET_GIDS[selectedKey] || '1766415704';
            finalUrl = `${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`;
        }
        
        const response = await fetch(finalUrl);
        const csvText = await response.text();
        
        salesData = parseSalesCSV(csvText, currentSalesSource);
        applySalesFilters();
    } catch (error) { 
        console.error('Error fetching data:', error); 
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}

function parseSalesCSV(text, sourceMode) {
    let lines = text.split('\n');
    if (lines.length < 2) return [];
    
    let headerRowIdx = (sourceMode === 'OFFICIAL_IT' || sourceMode === 'OFFICIAL_IT_REPORT') ? 0 : (lines.length > 2 ? 2 : 0);
    let headers = parseCSVLine(lines[headerRowIdx]).map(h => h.trim().toLowerCase());
    let result = [];
    
    for (let i = headerRowIdx + 1; i < lines.length; i++) { 
        if (!lines[i].trim()) continue;
        let row = parseCSVLine(lines[i]);

        let getVal = (headerNames, fallbackIndex) => {
            for (let hName of headerNames) {
                let idx = headers.indexOf(hName.toLowerCase());
                if (idx !== -1 && row[idx] !== undefined) {
                    return parseFloat(String(row[idx]).replace(/[^0-9.-]+/g, "")) || 0;
                }
            }
            return parseFloat(String(row[fallbackIndex] || "").replace(/[^0-9.-]+/g, "")) || 0;
        };

        let getStr = (headerNames, fallbackIndex) => {
            for (let hName of headerNames) {
                let idx = headers.indexOf(hName.toLowerCase());
                if (idx !== -1 && row[idx] !== undefined) return String(row[idx]).trim();
            }
            return String(row[fallbackIndex] || "-").trim();
        };

        let storeName = getStr(['store name', 'store_name', 'store', 'nama toko'], 1);
        if (!storeName || storeName === "" || storeName === "-") continue; 

        let mtdSalesVal = getVal(['net sales', 'net_sales', 'mtd sales', 'sales mtd'], 4);
        let mtdTargetVal = getVal(['target sales', 'target_sales', 'mtd target', 'target'], 5);
        let achVal = getVal(['achievement', 'ach percent', '% ach', 'ach'], 17);

        // Fallback persentase achievement agar tidak 0 jika target tersedia
        if (achVal === 0 && mtdTargetVal > 0) {
            achVal = (mtdSalesVal / mtdTargetVal) * 100;
        }

        result.push({
            storeCode: getStr(['store code', 'store_code', 'kode toko'], 0),
            store: storeName,
            bm: getStr(['nama bm', 'bm', 'branch manager'], 2),
            abm: getStr(['nama abm', 'abm', 'asst branch manager'], 3),
            mtdSales: mtdSalesVal,
            mtdTarget: mtdTargetVal,
            bestEstimate: getStr(['best estimate', 'best_estimate', 'estimate'], 16),
            achPercent: achVal,
            salesLY: getVal(['sales ly', 'ly sales', 'ly'], 18),
            sssg: getVal(['sssg', 'ach sssg'], 20),
            projSssg: getVal(['projection sssg', 'proj sssg', 'projection'], 21)
        });
    }
    return result;
}

function parseCSVLine(textLine) {
    let row = [];
    let inQuotes = false;
    let currentStr = "";
    for (let char of textLine) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; }
        else currentStr += char;
    }
    row.push(currentStr.trim());
    return row.map(cell => cell.replace(/^"|"$/g, '').trim());
}

/* ==========================================================================
   4. SYSTEM FILTERING SALES
   ========================================================================== */
function applySalesFilters() {
    const kategori = document.getElementById('slicerKategoriSales')?.value || 'all';
    const spesifik = document.getElementById('slicerSpesifikSales')?.value || 'all';

    let filteredSales = [...salesData]; 

    if (kategori !== 'all' && spesifik !== 'all') {
        filteredSales = salesData.filter(item => {
            if (kategori === 'bm') return item.bm.toLowerCase() === spesifik.toLowerCase();
            if (kategori === 'abm') return item.abm.toLowerCase() === spesifik.toLowerCase();
            if (kategori === 'store') return item.store.toLowerCase() === spesifik.toLowerCase();
            return true;
        });
    }

    renderSalesSummaryFiltered(filteredSales);
    renderSalesTableFiltered(filteredSales);

    if (currentSalesChartMode === 'mtd') {
        renderSalesChartFiltered(filteredSales);
    } else {
        fetchAndRenderTrendChart(kategori, spesifik);
    }
}

window.setSalesChartMode = function(mode) {
    currentSalesChartMode = mode;
    const btnMtd = document.getElementById('btnModeMtd');
    const btnTrend = document.getElementById('btnModeTrend');
    
    if (mode === 'mtd') {
        if (btnMtd) btnMtd.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        if (btnTrend) btnTrend.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    } else {
        if (btnTrend) btnTrend.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        if (btnMtd) btnMtd.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    }
    applySalesFilters();
};

/* ==========================================================================
   5. SUMMARY METRICS & CARDS
   ========================================================================== */
function renderSalesSummaryFiltered(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0;
    let totalSSSG = 0, totalProjSSSG = 0;
    let count = 0;

    data.forEach(item => {
        totalSales += item.mtdSales || 0;
        totalTarget += item.mtdTarget || 0;
        totalLY += item.salesLY || 0;
        totalSSSG += item.sssg || 0;
        totalProjSSSG += item.projSssg || 0;
        count++;
    });
    
    const avgAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    const avgSSSG = count > 0 ? (totalSSSG / count) : 0;
    const avgProjSSSG = count > 0 ? (totalProjSSSG / count) : 0;
    
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    setTxt('summary-total-sales', "Rp " + totalSales.toLocaleString('id-ID'));
    setTxt('summary-total-target', "Rp " + totalTarget.toLocaleString('id-ID'));
    setTxt('summary-avg-ach', avgAch + "%");
    setTxt('summary-total-ly', "Rp " + totalLY.toLocaleString('id-ID'));
    
    const elSSSG = document.getElementById('summary-sssg');
    const elProjSSSG = document.getElementById('summary-proj-sssg');
    
    if (elSSSG) {
        elSSSG.innerText = avgSSSG.toFixed(2) + "%";
        elSSSG.className = avgSSSG >= 0 ? "text-xl font-black text-emerald-500" : "text-xl font-black text-rose-500";
    }
    if (elProjSSSG) {
        elProjSSSG.innerText = avgProjSSSG.toFixed(2) + "%";
        elProjSSSG.className = avgProjSSSG >= 0 ? "text-xl font-black text-amber-500" : "text-xl font-black text-rose-500";
    }
}

/* ==========================================================================
   6. GRAFIK (WARNA ROSE RED & ORANGE MENYALA + LABEL PERSENTASE POLYGON)
   ========================================================================== */
function renderSalesChartFiltered(data) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    
    if (salesChartInstance) salesChartInstance.destroy();
    
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.store),
            datasets: [
                {
                    type: 'line',
                    label: 'Achievement (%)',
                    data: data.map(item => item.achPercent || 0),
                    backgroundColor: '#6366f1', 
                    borderColor: '#6366f1', 
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    fill: false, 
                    tension: 0.35, 
                    yAxisID: 'y1' 
                },
                {
                    type: 'bar',
                    label: 'MTD Target',
                    backgroundColor: 'rgba(244, 63, 94, 0.85)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdTarget || 0),
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'MTD Sales',
                    backgroundColor: 'rgba(249, 115, 22, 0.9)',
                    borderColor: '#f97316',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdSales || 0),
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 28 } },
            scales: {
                x: { grid: { display: false } },
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true },
                y1: { type: 'linear', display: false, position: 'right', beginAtZero: true }
            },
            plugins: { legend: { position: 'top' } }
        },
        plugins: [{
            id: 'polygonPercentageLabels',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    if (dataset.type === 'line') { 
                        const meta = chart.getDatasetMeta(i);
                        if (!meta.hidden) {
                            meta.data.forEach((element, index) => {
                                ctx.fillStyle = '#4f46e5'; 
                                ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                const dataString = Number(dataset.data[index]).toFixed(1) + '%';
                                ctx.fillText(dataString, element.x, element.y - 8); 
                            });
                        }
                    }
                });
            }
        }]
    });
}

async function fetchAndRenderTrendChart(kategori, spesifik) {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;

    try {
        const monthKeys = ['Oct26', 'Sep26', 'Aug26', 'Jul26', 'Jun26', 'May26'].reverse(); 
        let promises = monthKeys.map(async (mKey) => {
            const gid = SHEET_GIDS[mKey];
            if (!gid) return null;
            try {
                const res = await fetch(`${SALES_BASE_URL}&gid=${gid}`);
                const parsed = parseSalesCSV(await res.text(), 'SUBMISSION');
                let totalS = 0, totalT = 0;
                parsed.forEach(i => { totalS += i.mtdSales; totalT += i.mtdTarget; });
                return { month: mKey, achPercent: totalT > 0 ? (totalS / totalT) * 100 : 0 };
            } catch (e) { return null; }
        });

        let validData = (await Promise.all(promises)).filter(item => item !== null);
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validData.map(item => item.month),
                datasets: [{
                    label: 'Trend Achievement (%)',
                    data: validData.map(item => item.achPercent),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#f97316',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                layout: { padding: { top: 25 } }
            },
            plugins: [{
                id: 'trendPolygonLabels',
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            ctx.fillStyle = '#c2410c';
                            ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                            ctx.textAlign = 'center';
                            const val = Number(chart.data.datasets[0].data[index]).toFixed(1) + '%';
                            ctx.fillText(val, element.x, element.y - 10);
                        });
                    }
                }
            }]
        });
    } catch (e) { console.error(e); } 
    finally { if (loader) loader.classList.add('hidden'); }
}

/* ==========================================================================
   7. TABEL SALES STORE
   ========================================================================== */
function renderSalesTableFiltered(data) {
    const tbody = document.getElementById('sales-table-body');
    const countLabel = document.getElementById('table-record-count');
    
    if (countLabel) {
        countLabel.textContent = `Menampilkan ${data.length} Toko`;
    }

    if (!tbody) return;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`;
        return;
    }

    let sortedData = [...data].sort((a, b) => (b.achPercent || 0) - (a.achPercent || 0));

    tbody.innerHTML = sortedData.map((item, index) => {
        let ach = item.achPercent || 0;
        let badgeBg = ach >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                     (ach >= 80 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200');

        return `
        <tr class="${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
            <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
            <td class="px-5 py-4">
                <p class="font-bold text-sm text-slate-800">${item.store}</p>
                <p class="text-[10px] font-bold text-slate-400 uppercase">${item.storeCode || '-'}</p>
            </td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdSales || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdTarget || 0).toLocaleString('id-ID')}</td>
            <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${item.bestEstimate || '-'}</td>
            <td class="px-5 py-4 text-center">
                <span class="px-3 py-1.5 rounded-xl text-[11px] font-black border ${badgeBg}">
                    ${ach.toFixed(2)}%
                </span>
            </td>
        </tr>
        `;
    }).join('');
}

/* ==========================================================================
   8. MODAL HANDLER & UPLOAD PDF OFFICIAL IT REPORT
   ========================================================================== */
window.openUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.remove('hidden');
    
    const input = document.getElementById('officialPdfInput');
    if (input) input.value = '';
    
    const display = document.getElementById('pdfFileNameDisplay');
    if (display) display.textContent = "Klik atau seret file .PDF laporan ke sini";
    
    const progContainer = document.getElementById('uploadProgressContainer');
    if (progContainer) progContainer.classList.add('hidden');
    
    const statusBox = document.getElementById('pdfUploadStatus');
    if (statusBox) statusBox.classList.add('hidden');
    
    const btnSubmit = document.getElementById('btnSubmitPdf');
    if (btnSubmit) btnSubmit.disabled = false;
    
    const btnText = document.getElementById('btnSubmitText');
    if (btnText) btnText.textContent = "Proses Upload";

    const dateInput = document.getElementById('officialReportDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.add('hidden');
};

window.previewPdfSelection = function(input) {
    const display = document.getElementById('pdfFileNameDisplay');
    if (input.files && input.files[0] && display) {
        display.textContent = `📄 File terpilih: ${input.files[0].name}`;
    } else if (display) {
        display.textContent = "Klik atau seret file .PDF laporan ke sini";
    }
};

window.submitOfficialPdf = async function() {
    const input = document.getElementById('officialPdfInput');
    const dateInput = document.getElementById('officialReportDate');
    const statusBox = document.getElementById('pdfUploadStatus');
    const btnSubmit = document.getElementById('btnSubmitPdf');
    const btnText = document.getElementById('btnSubmitText');
    const progContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPct = document.getElementById('uploadProgressPct');
    const statusText = document.getElementById('uploadStatusText');

    if (!input || !input.files || !input.files[0]) {
        alert("Silakan pilih file PDF terlebih dahulu!");
        return;
    }

    if (!dateInput || !dateInput.value) {
        alert("Silakan pilih Tanggal Report terlebih dahulu!");
        return;
    }

    const file = input.files[0];
    const reportDate = dateInput.value;
    
    if (statusBox) statusBox.classList.add('hidden');
    if (progContainer) progContainer.classList.remove('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = "Mengunggah...";

    let progress = 15;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressPct) progressPct.textContent = `${progress}%`;
    if (statusText) statusText.textContent = "Membaca struktur file PDF...";

    try {
        const reader = new FileReader();

        reader.onload = async function(e) {
            progress = 50;
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressPct) progressPct.textContent = `${progress}%`;
            if (statusText) statusText.textContent = "Mengirim data ke Google Sheet...";

            const base64Content = e.target.result;

            const payload = {
                action: "UPLOAD_PDF_OFFICIAL",
                fileName: file.name,
                fileData: base64Content,
                reportDate: reportDate
            };

            progress = 80;
            if (progressBar) progressBar.style.width = `${progress}%`;
            if (progressPct) progressPct.textContent = `${progress}%`;
            if (statusText) statusText.textContent = "Memvalidasi & mencocokkan DATA_STORE...";

            const response = await fetch(WEB_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            progress = 100;
            if (progressBar) progressBar.style.width = `100%`;
            if (progressPct) progressPct.textContent = `100%`;
            if (statusText) statusText.textContent = "Selesai!";

            if (result.success) {
                if (statusBox) {
                    statusBox.className = "block text-center p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-3";
                    statusBox.textContent = result.message || `Sukses! ${result.count || ''} data toko berhasil disimpan ke OFFICIAL_IT_REPORT.`;
                    statusBox.classList.remove('hidden');
                }
                if (btnText) btnText.textContent = "Berhasil Disimpan";

                setTimeout(() => {
                    closeUploadPdfModal();
                    if (typeof currentSalesSource !== 'undefined' && (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT')) {
                        fetchSalesData();
                    }
                }, 1500);

            } else {
                throw new Error(result.message || "Gagal memproses data di Google Sheet.");
            }
        };

        reader.onerror = () => {
            throw new Error("Gagal membaca file dari perangkat.");
        };

        reader.readAsDataURL(file);

    } catch (error) {
        console.error("Upload Error:", error);
        if (progContainer) progContainer.classList.add('hidden');
        if (statusBox) {
            statusBox.className = "block text-center p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-3";
            statusBox.textContent = "Gagal: " + (error.message || "Terjadi kesalahan koneksi.");
            statusBox.classList.remove('hidden');
        }
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = "Coba Lagi";
    }
};
