/**
 * ============================================================================
 * SALES DASHBOARD — FRONTEND JAVASCRIPT CONTROLLER (sales-dashboard.js)
 * ============================================================================
 * Fitur:
 * 1. Manajemen State & Pengambilan Data dari Google Apps Script Web App
 * 2. Filter Tanggal & Toko (Store)
 * 3. Rendering KPI Card, Tabel Laporan, & Grafik (Chart.js opsional)
 * 4. Integrasi Upload PDF Laporan Resmi (OFFICIAL_IT_REPORT) + Auto-Close
 * ============================================================================
 */

/* ==========================================================================
   1. KONFIGURASI UTAMA & GLOBAL STATE
   ========================================================================== */
// Ganti dengan URL Web App Deployment Google Apps Script Anda yang aktif
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx.../exec";

// Global State
let currentSalesSource = "OFFICIAL_IT_REPORT"; // Pilihan sumber data aktif
let allSalesData = [];                         // Menyimpan seluruh baris data dari server
let filteredSalesData = [];                    // Menyimpan data setelah difilter
let salesChartInstance = null;                 // Menyimpan instance Chart.js agar bisa di-destroy/redraw

/* ==========================================================================
   2. INISIALISASI APLIKASI (DOM LOADED)
   ========================================================================== */
document.addEventListener("DOMContentLoaded", () => {
  initDashboard();
  setupEventListeners();
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});

function initDashboard() {
  // Set default nilai filter tanggal (opsional: 30 hari terakhir atau hari ini)
  const today = new Date().toISOString().split("T")[0];
  const filterDateInput = document.getElementById("filterDate");
  if (filterDateInput && !filterDateInput.value) {
    filterDateInput.value = today;
  }

  // Muat data dari server
  fetchSalesData();
}

function setupEventListeners() {
  // Tombol Filter / Refresh
  const btnRefresh = document.getElementById("btnRefreshData");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => fetchSalesData());
  }

  const filterStore = document.getElementById("filterStore");
  if (filterStore) {
    filterStore.addEventListener("change", () => applyFiltersAndRender());
  }

  const filterDate = document.getElementById("filterDate");
  if (filterDate) {
    filterDate.addEventListener("change", () => applyFiltersAndRender());
  }

  // Switcher Sumber Data (jika ada tombol/select untuk pindah source)
  const sourceSelector = document.getElementById("salesSourceSelector");
  if (sourceSelector) {
    sourceSelector.addEventListener("change", (e) => {
      currentSalesSource = e.target.value;
      fetchSalesData();
    });
  }

  // Event listener tombol upload di luar modal (tombol Buka Modal Upload PDF)
  const btnOpenUpload = document.getElementById("btnOpenUploadModal");
  if (btnOpenUpload) {
    btnOpenUpload.addEventListener("click", openUploadPdfModal);
  }
}

/* ==========================================================================
   3. PENGAMBILAN DATA DARI BACKEND GOOGLE APPS SCRIPT
   ========================================================================== */
async function fetchSalesData() {
  showLoadingState(true);

  try {
    const url = `${WEB_APP_URL}?action=GET_SALES&source=${encodeURIComponent(currentSalesSource)}`;
    const response = await fetch(url, { method: "GET" });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.json();

    if (result && result.success) {
      allSalesData = Array.isArray(result.data) ? result.data : [];
      populateStoreFilter(allSalesData);
      applyFiltersAndRender();
    } else {
      // Fallback jika API mengembalikan data langsung berupa array
      if (Array.isArray(result)) {
        allSalesData = result;
        populateStoreFilter(allSalesData);
        applyFiltersAndRender();
      } else {
        throw new Error(result.message || "Gagal memuat data dari server.");
      }
    }
  } catch (error) {
    console.error("Error fetching sales data:", error);
    showErrorMessage("Gagal memuat data penjualan. Periksa koneksi atau URL Web App.");
    allSalesData = [];
    applyFiltersAndRender();
  } finally {
    showLoadingState(false);
  }
}

/* ==========================================================================
   4. MANAJEMEN FILTER DATA
   ========================================================================== */
function populateStoreFilter(data) {
  const selectStore = document.getElementById("filterStore");
  if (!selectStore) return;

  const currentSelection = selectStore.value;
  selectStore.innerHTML = `<option value="ALL">Semua Toko</option>`;

  const storeMap = new Map();
  data.forEach((item) => {
    const code = String(item["Store Code"] || item.storeCode || "").trim().toUpperCase();
    const name = String(item["Store Name"] || item.storeName || "").trim().toUpperCase();
    if (code && !storeMap.has(code)) {
      storeMap.set(code, name || code);
    }
  });

  // Urutkan toko berdasarkan kode
  const sortedCodes = Array.from(storeMap.keys()).sort();
  sortedCodes.forEach((code) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = `${code} - ${storeMap.get(code)}`;
    selectStore.appendChild(option);
  });

  if (storeMap.has(currentSelection)) {
    selectStore.value = currentSelection;
  }
}

function applyFiltersAndRender() {
  const selectStore = document.getElementById("filterStore");
  const inputDate = document.getElementById("filterDate");

  const selectedStore = selectStore ? selectStore.value : "ALL";
  const selectedDate = inputDate ? inputDate.value : "";

  filteredSalesData = allSalesData.filter((row) => {
    const storeCode = String(row["Store Code"] || row.storeCode || "").trim().toUpperCase();
    const matchStore = selectedStore === "ALL" || storeCode === selectedStore;

    let matchDate = true;
    if (selectedDate) {
      const rowDateRaw = row["Report Date"] || row.reportDate || "";
      const rowDateStr = String(rowDateRaw).substring(0, 10);
      matchDate = rowDateStr === selectedDate;
    }

    return matchStore && matchDate;
  });

  renderSummaryCards(filteredSalesData);
  renderSalesTable(filteredSalesData);
  renderSalesChart(filteredSalesData);
}

/* ==========================================================================
   5. RENDERING KPI SUMMARY CARDS
   ========================================================================== */
function renderSummaryCards(data) {
  let totalGross = 0;
  let totalNet = 0;
  let totalTrx = 0;
  let totalQty = 0;

  data.forEach((row) => {
    totalGross += Number(row["Gross Sales"] || row.grossSales || 0);
    totalNet += Number(row["Net Sales"] || row.netSales || 0);
    totalTrx += Number(row["Trx Count"] || row.trxCount || 0);
    totalQty += Number(row["Qty Sold"] || row.qtySold || 0);
  });

  const avgTrx = totalTrx > 0 ? totalNet / totalTrx : 0;

  setTextContent("summaryGrossSales", formatRupiah(totalGross));
  setTextContent("summaryNetSales", formatRupiah(totalNet));
  setTextContent("summaryTotalTrx", formatNumber(totalTrx));
  setTextContent("summaryTotalQty", formatNumber(totalQty));
  setTextContent("summaryAvgTrx", formatRupiah(avgTrx));
}

/* ==========================================================================
   6. RENDERING DATA TABLE
   ========================================================================== */
function renderSalesTable(data) {
  const tbody = document.getElementById("salesTableBody");
  const emptyState = document.getElementById("salesTableEmptyState");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!data || data.length === 0) {
    if (emptyState) emptyState.classList.remove("hidden");
    return;
  }

  if (emptyState) emptyState.classList.add("hidden");

  data.forEach((row, index) => {
    const storeCode = row["Store Code"] || row.storeCode || "-";
    const storeName = row["Store Name"] || row.storeName || "-";
    const reportDate = formatDateID(row["Report Date"] || row.reportDate);
    const grossSales = formatRupiah(row["Gross Sales"] || row.grossSales || 0);
    const netSales = formatRupiah(row["Net Sales"] || row.netSales || 0);
    const qtySold = formatNumber(row["Qty Sold"] || row.qtySold || 0);
    const trxCount = formatNumber(row["Trx Count"] || row.trxCount || 0);

    const tr = document.createElement("tr");
    tr.className = "hover:bg-slate-50 transition-colors border-b border-slate-100";
    tr.innerHTML = `
      <td class="py-3 px-4 text-xs font-semibold text-slate-700">${index + 1}</td>
      <td class="py-3 px-4 text-xs font-bold text-slate-800">${storeCode}</td>
      <td class="py-3 px-4 text-xs text-slate-600">${storeName}</td>
      <td class="py-3 px-4 text-xs text-slate-600">${reportDate}</td>
      <td class="py-3 px-4 text-xs text-right text-slate-600">${grossSales}</td>
      <td class="py-3 px-4 text-xs text-right font-bold text-emerald-600">${netSales}</td>
      <td class="py-3 px-4 text-xs text-right text-slate-600">${qtySold}</td>
      <td class="py-3 px-4 text-xs text-right text-slate-600">${trxCount}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ==========================================================================
   7. RENDERING CHARTS (CHART.JS SAFE CHECK)
   ========================================================================== */
function renderSalesChart(data) {
  const canvas = document.getElementById("salesChartCanvas");
  if (!canvas || typeof Chart === "undefined") return;

  const ctx = canvas.getContext("2d");
  if (salesChartInstance) {
    salesChartInstance.destroy();
  }

  const storeNetMap = new Map();
  data.forEach((row) => {
    const code = String(row["Store Code"] || row.storeCode || "").trim().toUpperCase();
    const net = Number(row["Net Sales"] || row.netSales || 0);
    if (code) {
      storeNetMap.set(code, (storeNetMap.get(code) || 0) + net);
    }
  });

  const labels = Array.from(storeNetMap.keys()).slice(0, 15);
  const values = labels.map((label) => storeNetMap.get(label));

  salesChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Net Sales (Rp)",
          data: values,
          backgroundColor: "rgba(16, 185, 129, 0.8)",
          borderColor: "rgba(16, 185, 129, 1)",
          borderWidth: 1,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `Net Sales: ${formatRupiah(context.raw)}`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatRupiahShort(value),
          },
        },
      },
    },
  });
}

/* ==========================================================================
   8. FITUR UPLOAD PDF LAPORAN RESMI (OFFICIAL_IT_REPORT)
   ========================================================================== */
window.openUploadPdfModal = function () {
  const modal = document.getElementById("uploadPdfModal");
  if (modal) modal.classList.remove("hidden");

  const input = document.getElementById("officialPdfInput");
  if (input) input.value = "";

  const display = document.getElementById("pdfFileNameDisplay");
  if (display) display.textContent = "Klik atau seret file .PDF laporan ke sini";

  const progContainer = document.getElementById("uploadProgressContainer");
  if (progContainer) progContainer.classList.add("hidden");

  const statusBox = document.getElementById("pdfUploadStatus");
  if (statusBox) statusBox.classList.add("hidden");

  const btnSubmit = document.getElementById("btnSubmitPdf");
  if (btnSubmit) {
    btnSubmit.disabled = false;
    btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
  }

  const btnText = document.getElementById("btnSubmitText");
  if (btnText) btnText.textContent = "Proses Upload";

  const dateInput = document.getElementById("officialReportDate");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];

  if (typeof lucide !== "undefined") lucide.createIcons();
};

window.closeUploadPdfModal = function () {
  const modal = document.getElementById("uploadPdfModal");
  if (modal) modal.classList.add("hidden");
};

window.previewPdfSelection = function (input) {
  const display = document.getElementById("pdfFileNameDisplay");
  if (input.files && input.files[0] && display) {
    display.textContent = `📄 File terpilih: ${input.files[0].name}`;
  } else if (display) {
    display.textContent = "Klik atau seret file .PDF laporan ke sini";
  }
};

window.submitOfficialPdf = async function () {
  const input = document.getElementById("officialPdfInput");
  const dateInput = document.getElementById("officialReportDate");
  const statusBox = document.getElementById("pdfUploadStatus");
  const btnSubmit = document.getElementById("btnSubmitPdf");
  const btnText = document.getElementById("btnSubmitText");
  const progContainer = document.getElementById("uploadProgressContainer");
  const progressBar = document.getElementById("uploadProgressBar");
  const progressPct = document.getElementById("uploadProgressPct");
  const statusText = document.getElementById("uploadStatusText");

  if (!input || !input.files || !input.files[0]) {
    alert("Silakan pilih file PDF terlebih dahulu!");
    return;
  }

  const file = input.files[0];
  const reportDate = dateInput ? dateInput.value : "";

  if (statusBox) statusBox.classList.add("hidden");
  if (progContainer) progContainer.classList.remove("hidden");
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.classList.add("opacity-50", "cursor-not-allowed");
  }
  if (btnText) btnText.textContent = "Mengunggah...";

  const updateProgress = (pct, text) => {
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPct) progressPct.textContent = `${pct}%`;
    if (statusText) statusText.textContent = text;
  };

  try {
    updateProgress(15, "[1/4] Membaca file PDF di browser...");

    const reader = new FileReader();

    reader.onload = async function (e) {
      updateProgress(40, "[2/4] Mengirim file ke server Google Script...");

      const base64Content = e.target.result;
      const payload = {
        action: "UPLOAD_PDF_OFFICIAL",
        fileName: file.name,
        fileData: base64Content,
        reportDate: reportDate,
      };

      updateProgress(75, "[3/4] Ekstraksi OCR & pengecekan DATA_STORE...");

      const response = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (result.success) {
        updateProgress(100, "[4/4] Berhasil disimpan!");

        if (statusBox) {
          statusBox.className =
            "block text-center p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-3";
          statusBox.innerHTML = `✅ ${result.message}<br><span class="font-normal text-[11px] text-emerald-600">Jendela menutup otomatis dalam 2 detik...</span>`;
          statusBox.classList.remove("hidden");
        }
        if (btnText) btnText.textContent = "Berhasil!";

        // AUTO-CLOSE MODAL & REFRESH DATA DASHBOARD
        setTimeout(() => {
          closeUploadPdfModal();
          if (
            typeof currentSalesSource !== "undefined" &&
            (currentSalesSource === "OFFICIAL_IT" || currentSalesSource === "OFFICIAL_IT_REPORT")
          ) {
            fetchSalesData();
          }
        }, 2000);
      } else {
        // Tampilkan Error Spesifik dari Server (Di Tahap Mana Gagalnya)
        const errorStep = result.step || "ERROR";
        throw new Error(
          `[Tahap: ${errorStep}] ${result.message || "Gagal memproses data di Google Sheet."}`
        );
      }
    };

    reader.onerror = () => {
      throw new Error("[Tahap: BACA_FILE] Gagal membaca file dari perangkat browser.");
    };

    reader.readAsDataURL(file);
  } catch (error) {
    console.error("Upload Error:", error);
    updateProgress(0, "Proses terhenti karena error");
    if (progContainer) progContainer.classList.add("hidden");

    if (statusBox) {
      statusBox.className =
        "block text-left p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-3";
      statusBox.innerHTML = `❌ <b>Terjadi Kesalahan:</b><br>${error.message}`;
      statusBox.classList.remove("hidden");
    }

    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove("opacity-50", "cursor-not-allowed");
    }
    if (btnText) btnText.textContent = "Coba Lagi";
  }
};

/* ==========================================================================
   9. UTILITAS PENDUKUNG (FORMATTER & UI HELPER)
   ========================================================================== */
function formatRupiah(number) {
  const num = Number(number) || 0;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

function formatRupiahShort(number) {
  const num = Number(number) || 0;
  if (num >= 1_000_000_000) {
    return `Rp ${(num / 1_000_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000_000) {
    return `Rp ${(num / 1_000_000).toFixed(1)}Jt`;
  }
  if (num >= 1_000) {
    return `Rp ${(num / 1_000).toFixed(0)}Rb`;
  }
  return formatRupiah(num);
}

function formatNumber(number) {
  const num = Number(number) || 0;
  return new Intl.NumberFormat("id-ID").format(num);
}

function formatDateID(dateStr) {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr).substring(0, 10);
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch (e) {
    return String(dateStr).substring(0, 10);
  }
}

function setTextContent(elementId, text) {
  const el = document.getElementById(elementId);
  if (el) el.textContent = text;
}

function showLoadingState(isLoading) {
  const loader = document.getElementById("dashboardLoader");
  const content = document.getElementById("dashboardContent");

  if (loader) {
    loader.classList.toggle("hidden", !isLoading);
  }
  if (content) {
    content.classList.toggle("opacity-50", isLoading);
    content.style.pointerEvents = isLoading ? "none" : "auto";
  }
}

function showErrorMessage(message) {
  const alertBox = document.getElementById("dashboardErrorAlert");
  if (alertBox) {
    alertBox.textContent = message;
    alertBox.classList.remove("hidden");
    setTimeout(() => {
      alertBox.classList.add("hidden");
    }, 5000);
  }
}
