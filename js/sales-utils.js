/**
 * @file sales-utils.js
 * @description Kumpulan Reusable Pure Functions untuk formatting dan hitungan finansial.
 */

export function formatRupiah(number) {
    if (isNaN(number) || number === null) return "Rp 0";
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(number);
}

export function formatPercentage(number) {
    if (isNaN(number) || number === null) return "0%";
    return `${Math.round(number * 10) / 10}%`;
}

export function calculateGap(actual, target) {
    return Math.max(0, target - actual);
}

export function calculateSalesNeeded(gap, remainingDays) {
    if (remainingDays <= 0 || gap <= 0) return 0;
    return Math.ceil(gap / remainingDays);
}

export function getStatusColorClass(achievement) {
    if (achievement >= 100) {
        return { badge: 'bg-emerald-100 text-emerald-800 border-emerald-300', text: 'text-emerald-600', code: 'EXCELLENT' };
    } else if (achievement >= 80) {
        return { badge: 'bg-amber-100 text-amber-800 border-amber-300', text: 'text-amber-600', code: 'WARNING' };
    }
    return { badge: 'bg-rose-100 text-rose-800 border-rose-300', text: 'text-rose-600', code: 'CRITICAL' };
}
