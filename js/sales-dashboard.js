/* ==========================================================================
   1. KONFIGURASI GLOBAL & MAPPING GID SHEETS
   ========================================================================== */
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub';

let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd';
let currentSalesSource = 'SUBMISSION'; // 'SUBMISSION' atau 'OFFICIAL_IT'

// GID Sheet Lengkap (Termasuk Official IT Report)
const SHEET_GIDS = {
    'OFFICIAL_IT': '1129267198', // GID Sheet OFFICIAL_IT_REPORT
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
        // Disable dropdown bulan jika membuka Official IT Report
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
        let gid = '1766415704'; // Default Aug26
        if (currentSalesSource === 'OFFICIAL_IT') {
            gid = SHEET_GIDS['OFFICIAL_IT'];
        } else {
            const selectedKey = document.getElementById('slicerBulanSales')?.value || 'Aug26';
            gid = SHEET_GIDS[selectedKey] || '1766415704';
        }
        
        const finalUrl = `${SALES_BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`;
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
    
    // Deteksi otomatis baris header
    let headerRowIdx = sourceMode === 'OFFICIAL_IT' ? 0 : (lines.length > 2 ? 2 : 0);
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

        let storeName = getStr(['store name', 'store_name', 'store', 'nama toko'], 2);
        if (!storeName || storeName === "" || storeName === "-") continue; 

        result.push({
            storeCode: getStr(['store code', 'store_code', 'kode toko'], 1),
            store: storeName,
            bm: getStr(['nama bm', 'bm', 'branch manager'], 3),
            abm: getStr(['nama abm', 'abm', 'asst branch manager'], 4),
            mtdSales: getVal(['net sales', 'net_sales', 'mtd sales', 'sales mtd'], 5),
            mtdTarget: getVal(['target sales', 'target_sales', 'mtd target', 'target'], 6),
            bestEstimate: getStr(['best estimate', 'best_estimate', 'estimate'], 16),
            achPercent: getVal(['achievement', 'ach percent', '% ach', 'ach'], 17),
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
                    backgroundColor: 'rgba(244, 63, 94, 0.85)', // Warna Rose Red
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdTarget || 0),
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'MTD Sales',
                    backgroundColor: 'rgba(249, 115, 22, 0.9)', // Warna Orange Menyala
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
            // Plugin khusus untuk mencetak angka persentase di setiap titik/polygon
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
                const res = await fetch(`${SALES_BASE_URL}?gid=${gid}&single=true&output=csv&t=${Date.now()}`);
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
                    borderColor: '#f97316', // Orange Menyala untuk garis tren
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
                // Plugin cetak angka persentase pada mode tren 6 bulan
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

// GANTI DENGAN URL WEB APP GOOGLE APPS SCRIPT ANDA YANG TERBARU
const WEB_APP_URL = "GANTI_DENGAN_WEB_APP_URL_ANDA";

window.openUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.remove('hidden');
    // Reset state modal saat dibuka
    document.getElementById('officialPdfInput').value = '';
    document.getElementById('pdfFileNameDisplay').textContent = "Klik atau seret file .PDF laporan ke sini";
    document.getElementById('uploadProgressContainer').classList.add('hidden');
    document.getElementById('pdfUploadStatus').classList.add('hidden');
    document.getElementById('btnSubmitPdf').disabled = false;
    document.getElementById('btnSubmitText').textContent = "Proses Upload";
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.add('hidden');
};

window.previewPdfSelection = function(input) {
    const display = document.getElementById('pdfFileNameDisplay');
    if (input.files && input.files[0] && display) {
        // Menampilkan nama file yang dipilih secara informatif
        display.textContent = `📄 File terpilih: ${input.files[0].name}`;
    } else {
        display.textContent = "Klik atau seret file .PDF laporan ke sini";
    }
};

window.submitOfficialPdf = async function() {
    const input = document.getElementById('officialPdfInput');
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

    const file = input.files[0];
    
    // UI Loading & Progress bar aktif
    if (statusBox) statusBox.classList.add('hidden');
    progContainer.classList.remove('hidden');
    btnSubmit.disabled = true;
    btnText.textContent = "Mengunggah...";

    let progress = 10;
    progressBar.style.width = `${progress}%`;
    progressPct.textContent = `${progress}%`;
    statusText.textContent = "Membaca struktur file PDF...";

    try {
        // Menggunakan FileReader untuk membaca file sebagai Data URL / Base64
        const reader = new FileReader();

        reader.onprogress = (event) => {
            if (event.lengthComputable) {
                let percent = Math.round((event.loaded / event.total) * 50); // 50% pertama untuk baca lokal
                progressBar.style.width = `${percent}%`;
                progressPct.textContent = `${percent}%`;
            }
        };

        reader.onload = async function(e) {
            progress = 60;
            progressBar.style.width = `${progress}%`;
            progressPct.textContent = `${progress}%`;
            statusText.textContent = "Mengirim data ke Google Sheet...";

            const base64Content = e.target.result;

            const payload = {
                action: "UPLOAD_PDF_OFFICIAL",
                fileName: file.name,
                fileData: base64Content
            };

            progress = 85;
            progressBar.style.width = `${progress}%`;
            progressPct.textContent = `${progress}%`;
            statusText.textContent = "Memvalidasi & mencocokkan DATA_STORE...";

            // Kirim ke Google Apps Script Web App
            const response = await fetch(WEB_APP_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            progress = 100;
            progressBar.style.width = `100%`;
            progressPct.textContent = `100%`;
            statusText.textContent = "Selesai!";

            if (result.success) {
                if (statusBox) {
                    statusBox.className = "block text-center p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-3";
                    statusBox.textContent = `Sukses! ${result.count || ''} data toko berhasil disimpan ke OFFICIAL_IT_REPORT.`;
                    statusBox.classList.remove('hidden');
                }
                btnText.textContent = "Berhasil Disimpan";

                // Refresh data dashboard otomatis setelah 2 detik
                setTimeout(() => {
                    closeUploadPdfModal();
                    if (typeof currentSalesSource !== 'undefined' && currentSalesSource === 'OFFICIAL_IT') {
                        fetchSalesData();
                    }
                }, 2000);
            } else {
                throw new Error(result.message || "Gagal memproses data di Google Sheet.");
            }
        };

        reader.onerror = () => {
            throw new Error("Gagal membaca file dari perangkat.");
        };

        reader.readAsDataURL(file); // Membaca file dengan aman tanpa corrupt

    } catch (error) {
        console.error("Upload Error:", error);
        progContainer.classList.add('hidden');
        if (statusBox) {
            statusBox.className = "block text-center p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-3";
            statusBox.textContent = "Gagal: " + (error.message || "Terjadi kesalahan koneksi.");
            statusBox.classList.remove('hidden');
        }
        btnSubmit.disabled = false;
        btnText.textContent = "Coba Lagi";
    }
};
