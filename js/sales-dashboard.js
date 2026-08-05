/**
 * @file sales-dashboard.js
 * @description Core Dashboard Controller untuk Sales Intelligence Center.
 * Meng-extend fungsi existing tanpa menghapus endpoint atau struktur lama.
 */

import dataSourceManager from './sales-data-source.js';
import { fetchSalesDataset } from './sales-api.js';
import { formatRupiah, formatPercentage, calculateGap, calculateSalesNeeded, getStatusColorClass } from './sales-utils.js';
import { executeRuleEngine } from './sales-action-center.js';

let currentSalesData = [];
let salesChartInstance = null;
let currentChartMode = 'mtd';

// 1. DENGARKAN PERUBAHAN GLOBAL DATA SOURCE
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

export async function reloadSalesDashboard(force = false) {
    const activeSource = dataSourceManager.activeSource;
    currentSalesData = await fetchSalesDataset(activeSource, force);
    
    renderKPIHeader(currentSalesData);
    renderEnhancedTable(currentSalesData);
    renderInsightsPanel(currentSalesData);
    renderSalesChart(currentSalesData, currentChartMode);
}

function renderKPIHeader(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0, totalBE = 0;
    let cntAbove = 0, cntBelow = 0;

    data.forEach(item => {
        const sales = parseFloat(item.Net_Sales) || 0;
        const target = parseFloat(item.Target_Sales) || 0;
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
    const salesNeeded = calculateSalesNeeded(gap, 10); // Asumsi sisa 10 hari berjalan

    // Assign ke DOM HTML
    document.getElementById('kpi-total-sales').textContent = formatRupiah(totalSales);
    document.getElementById('kpi-total-target').textContent = formatRupiah(totalTarget);
    document.getElementById('kpi-achievement').textContent = formatPercentage(ach);
    document.getElementById('kpi-growth-pct').textContent = formatPercentage(growth);
    document.getElementById('kpi-ly-sales').textContent = formatRupiah(totalLY);
    document.getElementById('kpi-best-estimate').textContent = formatRupiah(totalBE);
    document.getElementById('kpi-gap-target').textContent = formatRupiah(gap);
    document.getElementById('kpi-sales-needed').textContent = `${formatRupiah(salesNeeded)}/day`;
    document.getElementById('kpi-stores-above').textContent = cntAbove;
    document.getElementById('kpi-stores-below').textContent = cntBelow;
    document.getElementById('kpi-total-stores').textContent = data.length;
}

function renderEnhancedTable(data) {
    const tbody = document.getElementById('sales-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const sorted = [...data].sort((a, b) => (parseFloat(b.Net_Sales) || 0) - (parseFloat(a.Net_Sales) || 0));

    sorted.forEach((store, index) => {
        const sales = parseFloat(store.Net_Sales) || 0;
        const target = parseFloat(store.Target_Sales) || 0;
        const gap = calculateGap(sales, target);
        const ach = target > 0 ? (sales / target) * 100 : 0;
        const status = getStatusColorClass(ach);
        const rule = executeRuleEngine(store);

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                <td class="px-4 py-3 text-center font-bold text-slate-400">${index + 1}</td>
                <td class="px-4 py-3">
                    <p class="font-extrabold text-slate-800">${store.Store_Name}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">${store.Store_Code}</p>
                </td>
                <td class="px-4 py-3 text-right font-black text-slate-800">${formatRupiah(sales)}</td>
                <td class="px-4 py-3 text-right font-semibold text-slate-500">${formatRupiah(target)}</td>
                <td class="px-4 py-3 text-right font-bold text-rose-500">${formatRupiah(gap)}</td>
                <td class="px-4 py-3 text-right text-slate-600">${formatRupiah(calculateSalesNeeded(gap, 10))}</td>
                <td class="px-4 py-3 text-right text-indigo-600 font-bold">${formatRupiah(store.Best_Estimate)}</td>
                <td class="px-4 py-3 text-center font-bold text-emerald-600">+12.5%</td>
                <td class="px-4 py-3 text-center font-black ${status.text}">${formatPercentage(ach)}</td>
                <td class="px-4 py-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${status.badge}">${rule.score}</span>
                </td>
                <td class="px-4 py-3 text-center">
                    <button onclick="openStoreDetailDrawer('${store.Store_Code}')" class="p-1.5 bg-slate-100 hover:bg-amber-50 text-slate-600 hover:text-amber-600 rounded-lg transition">
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

    let worstStore = data[0] || {}, bestStore = data[0] || {};
    data.forEach(item => {
        const ach = parseFloat(item.Achievement) || 0;
        if (ach < (parseFloat(worstStore.Achievement) || 0)) worstStore = item;
        if (ach > (parseFloat(bestStore.Achievement) || 0)) bestStore = item;
    });

    container.innerHTML = `
        <div class="bg-rose-50/60 border border-rose-200/80 p-4 rounded-2xl">
            <span class="text-[10px] font-extrabold uppercase text-rose-600">Perhatian Kritis (Terburuk)</span>
            <h4 class="text-base font-black text-rose-900 mt-1">${worstStore.Store_Name || '-'}</h4>
            <p class="text-xs text-rose-700 font-semibold mt-0.5">Achievement: ${formatPercentage(worstStore.Achievement || 0)}</p>
        </div>
        <div class="bg-emerald-50/60 border border-emerald-200/80 p-4 rounded-2xl">
            <span class="text-[10px] font-extrabold uppercase text-emerald-600">Performa Terbaik (Top Achiever)</span>
            <h4 class="text-base font-black text-emerald-900 mt-1">${bestStore.Store_Name || '-'}</h4>
            <p class="text-xs text-emerald-700 font-semibold mt-0.5">Achievement: ${formatPercentage(bestStore.Achievement || 0)}</p>
        </div>
    `;
}
