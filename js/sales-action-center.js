/**
 * @file sales-action-center.js
 * @description Modul prioritas dan rekomendasi tindakan toko berdasarkan Rule Engine deterministik.
 */

export function executeRuleEngine(storeData) {
    const ach = parseFloat(storeData.Achievement) || 0;
    const atv = parseFloat(storeData.Average_Trx) || 0;
    const trx = parseFloat(storeData.Trx_Count) || 0;
    const bestEst = parseFloat(storeData.Best_Estimate) || 0;
    const target = parseFloat(storeData.Target_Sales) || 0;

    let priorityScore = "Normal";
    let priorityBadge = "bg-slate-100 text-slate-700 border-slate-300";
    const recommendations = [];

    if (ach < 80) {
        priorityScore = "Critical";
        priorityBadge = "bg-rose-100 text-rose-800 border-rose-300";
        recommendations.push("Evaluasi segera penyebab penurunan; lakukan kunjungan supervisor.");
    } else if (ach < 90) {
        priorityScore = "Warning";
        priorityBadge = "bg-amber-100 text-amber-800 border-amber-300";
    } else if (ach >= 100) {
        priorityScore = "Excellent";
        priorityBadge = "bg-emerald-100 text-emerald-800 border-emerald-300";
    }

    if (trx < 500 && ach < 90) {
        recommendations.push("Fokus Traffic: Aktifkan promosi flyer keliling & sebar katalog di area radius 2 km.");
    }

    if (atv < 45000) {
        recommendations.push("Fokus Basket Size: Tekankan tawar-menawar kasir (UPT & produk kasir promo).");
    }

    if (bestEst < target && ach >= 85) {
        recommendations.push("Fokus Weekend Push: Optimalkan stok barang fast-moving menjelang hari Jumat-Minggu.");
    }

    if (recommendations.length === 0) {
        recommendations.push("Pertahankan tren operasional dan kebersihan standar display toko.");
    }

    return {
        score: priorityScore,
        badgeClass: priorityBadge,
        actions: recommendations
    };
}
