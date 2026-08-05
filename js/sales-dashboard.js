/**
 * @file sales-dashboard.js
 * @description Core Dashboard Controller untuk Sales Intelligence Center.
 */

import dataSourceManager from './sales-data-source.js';
import { fetchSalesDataset } from './sales-api.js';
import { formatRupiah, formatPercentage, calculateGap, calculateSalesNeeded, getStatusColorClass } from './sales-utils.js';
import { executeRuleEngine } from './sales-action-center.js';

let currentSalesData = [];
let salesChartInstance = null;
let currentChartMode = 'mtd';

window.addEventListener('midnorth:datasource-change', async (event) => {
    const info = event.detail;
    updateBannerUI(info);
    await reloadSalesDashboard(true);
});

function updateBannerUI(info) {
    const badgeEl = document.getElementById('banner-source-badge');
    const labelEl = document.getElementById('banner-source-label');
    const uploaderEl = document.getElementById('banner-uploaded-by');
    const uploadTimeEl = document.getElementById('banner-last-upload');
    const confEl = document.getElementById('banner-confidence');

    if (badgeEl) {
        badgeEl.className = `px-3 py-1 text-[10px] font-black rounded-full uppercase tracking-wider border ${info.badgeClass}`;
        badgeEl.textContent = `${info.statusText} • ${info.label}`;
    }
    if (labelEl) labelEl.textContent = info.label;
    if (uploaderEl) uploaderEl.textContent = info.uploadedBy;
    if (uploadTimeEl) uploadTimeEl.textContent = info.lastUpload;
    if (confEl) confEl.textContent = info.confidence;
}

window.fetchSalesData = async function() {
    await reloadSalesDashboard(false);
};

window.reloadSalesDashboard = async function(force = false) {
    const activeSource = dataSourceManager.activeSource;
    currentSalesData = await fetchSalesDataset(activeSource, force);
    
    renderKPIHeader(currentSalesData);
    renderEnhancedTable(currentSalesData);
    renderInsightsPanel(currentSalesData);
    renderSalesChart(currentSalesData, currentChartMode);
};

window.changeSalesSource = function(mode) {
    dataSourceManager.setDataSourceMode(mode);
    ['store', 'official', 'auto'].forEach(id => {
        const btn = document.getElementById(`btn-src-${id}`);
        if (btn) {
            btn.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white transition-all";
        }
    });
    const activeBtnId = mode === 'STORE_SUBMISSION' ? 'btn-src-store' : (mode === 'OFFICIAL_IT' ? 'btn-src-official' : 'btn-src-auto');
    const activeBtn = document.getElementById(activeBtnId);
    if (activeBtn) {
        activeBtn.className = "px-4 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 shadow-sm transition-all";
    }
};

function renderKPIHeader(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0, totalBE = 0;
    let cntAbove = 0, cntBelow = 0;

    data.forEach(item => {
        const sales = parseFloat(item.Net_Sales || item.MTD_Sales) || 0;
        const target = parseFloat(item.Target_Sales || item.MTD_Target) || 0;
        const ly = parseFloat(item.LY_Sales) || 0;
        const be = parseFloat(item.Best_Estimate) || 0;

        totalSales += sales;
        totalTarget += target;
        totalLY += ly;
        totalBE += be;

        if (sales >= target) cntAbove++;
        else cntBelow++;
    });

    const ach = totalTarget > 0 ? (totalSales / totalTarget) * 100 : 0;
    const growth = totalLY > 0 ? ((totalSales - totalLY) / totalLY) * 100 : 0;
    const gap = calculateGap(totalSales, totalTarget);
    const salesNeeded = calculateSalesNeeded(gap, 10);

    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setTxt('summary-total-sales', formatRupiah(totalSales));
    setTxt('summary-total-target', formatRupiah(totalTarget));
    setTxt('summary-avg-ach', formatPercentage(ach));
    setTxt('summary-total-ly', formatRupiah(totalLY));
    setTxt('summary-sssg', formatPercentage(growth));
    setTxt('summary-proj-sssg', formatPercentage(ach));

    setTxt('kpi-gap-target', formatRupiah(gap));
    setTxt('kpi-sales-needed', formatRupiah(salesNeeded));
    setTxt('kpi-stores-above', cntAbove);
    setTxt('kpi-stores-below', cntBelow);
    setTxt('kpi-potential-recovery', formatRupiah(totalBE * 0.1));
}

function renderEnhancedTable(data) {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const recordCountEl = document.getElementById('table-record-count');
    if (recordCountEl) recordCountEl.textContent = `Menampilkan ${data.length} Toko`;

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="11" class="text-center py-8 text-slate-400 font-bold">Tidak ada data sales yang tersedia.</td></tr>`;
        return;
    }

    const sorted = [...data].sort((a, b) => (parseFloat(b.Net_Sales || b.MTD_Sales) || 0) - (parseFloat(a.Net_Sales || b.MTD_Sales) || 0));

    sorted.forEach((store, index) => {
        const sales = parseFloat(store.Net_Sales || store.MTD_Sales) || 0;
        const target = parseFloat(store.Target_Sales || store.MTD_Target) || 0;
        const gap = calculateGap(sales, target);
        const ach = target > 0 ? (sales / target) * 100 : 0;
        const status = getStatusColorClass(ach);
        const rule = executeRuleEngine(store);

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                <td class="px-4 py-3 text-center font-bold text-slate-400">${index + 1}</td>
                <td class="px-4 py-3">
                    <p class="font-extrabold text-slate-800">${store.Store_Name || store.Store || '-'}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">${store.Store_Code || '-'}</p>
                </td>
                <td class="px-4 py-3 text-right font-black text-slate-800">${formatRupiah(sales)}</td>
                <td class="px-4 py-3 text-right font-semibold text-slate-500">${formatRupiah(target)}</td>
                <td class="px-4 py-3 text-right text-indigo-600 font-bold">${formatRupiah(store.Best_Estimate || 0)}</td>
                <td class="px-4 py-3 text-right font-bold text-rose-500">${formatRupiah(gap)}</td>
                <td class="px-4 py-3 text-right text-slate-600">${formatRupiah(calculateSalesNeeded(gap, 10))}</td>
                <td class="px-4 py-3 text-center font-bold text-emerald-600">+12.5%</td>
                <td class="px-4 py-3 text-center font-black ${status.text}">${formatPercentage(ach)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${status.badge}">${rule.score}</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="openStoreDetailDrawer('${store.Store_Code || ''}')" class="p-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 rounded-lg transition">
                        <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
                    </button>
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
}

function renderInsightsPanel(data) {
    const container = document.getElementById('insights-grid');
    if (!container) return;

    if (data.length === 0) {
        container.innerHTML = `<p class="text-xs text-slate-400">Belum ada data untuk dianalisis.</p>`;
        return;
    }

    let worstStore = data[0] || {}, bestStore = data[0] || {};
    data.forEach(item => {
        const ach = parseFloat(item.Achievement) || 0;
        if (ach < (parseFloat(worstStore.Achievement) || 0)) worstStore = item;
        if (ach > (parseFloat(bestStore.Achievement) || 0)) bestStore = item;
    });

    container.innerHTML = `
        <div class="bg-rose-50/60 border border-rose-200/80 p-4 rounded-2xl">
            <span class="text-[10px] font-extrabold uppercase text-rose-600">Perhatian Kritis (Terburuk)</span>
            <h4 class="text-base font-black text-rose-900 mt-1">${worstStore.Store_Name || worstStore.Store || '-'}</h4>
            <p class="text-xs text-rose-700 font-semibold mt-0.5">Achievement: ${formatPercentage(worstStore.Achievement || 0)}</p>
        </div>
        <div class="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl">
            <span class="text-[10px] font-extrabold uppercase text-emerald-600">Performa Terbaik (Top Achiever)</span>
            <h4 class="text-base font-black text-emerald-900 mt-1">${bestStore.Store_Name || bestStore.Store || '-'}</h4>
            <p class="text-xs text-emerald-700 font-semibold mt-0.5">Achievement: ${formatPercentage(bestStore.Achievement || 0)}</p>
        </div>
    `;
}

function renderSalesChart(data, mode) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;

    if (salesChartInstance) salesChartInstance.destroy();

    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.slice(0, 15).map(item => item.Store_Name || item.Store || 'Store'),
            datasets: [
                {
                    label: 'MTD Sales',
                    data: data.slice(0, 15).map(item => parseFloat(item.Net_Sales || item.MTD_Sales) || 0),
                    backgroundColor: 'rgba(16, 185, 129, 0.85)',
                    borderRadius: 6
                },
                {
                    label: 'Target',
                    data: data.slice(0, 15).map(item => parseFloat(item.Target_Sales || item.MTD_Target) || 0),
                    backgroundColor: 'rgba(203, 213, 225, 0.85)',
                    borderRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top', labels: { boxWidth: 12, font: { weight: '700' } } } },
            scales: {
                x: { grid: { display: false }, ticks: { font: { size: 10, weight: '600' } } },
                y: { grid: { color: '#f1f5f9' } }
            }
        }
    });
}

window.setSalesChartMode = function(mode) {
    currentChartMode = mode;
    renderSalesChart(currentSalesData, mode);
};

window.resetSalesFilters = function() {
    const searchInput = document.getElementById('filterSearch');
    if (searchInput) searchInput.value = '';
    reloadSalesDashboard(false);
};
