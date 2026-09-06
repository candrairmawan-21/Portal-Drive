/* ==========================================================================
   DAFTAR KATAKUNCI BULAN (DETEKSI FLEKSIBEL)
   ========================================================================== */
const MONTH_CONFIG = [
    { keywords: ['january', 'januari', 'jan'], key: 'january', salesKey: 'Jan26', label: 'Januari' },
    { keywords: ['february', 'februari', 'feb'], key: 'february', salesKey: 'Feb26', label: 'Februari' },
    { keywords: ['march', 'maret', 'mar'], key: 'march', salesKey: 'Mar26', label: 'Maret' },
    { keywords: ['april', 'apr'], key: 'april', salesKey: 'Apr26', label: 'April' },
    { keywords: ['may', 'mei'], key: 'may', salesKey: 'May26', label: 'Mei' },
    { keywords: ['june', 'juni', 'jun'], key: 'june', salesKey: 'Jun26', label: 'Juni' },
    { keywords: ['july', 'juli', 'jul'], key: 'july', salesKey: 'Jul26', label: 'Juli' },
    { keywords: ['august', 'agustus', 'aug', 'ags'], key: 'august', salesKey: 'Aug26', label: 'Agustus' },
    { keywords: ['september', 'sept', 'sep'], key: 'september', salesKey: 'Sep26', label: 'September' },
    { keywords: ['october', 'oktober', 'oct', 'okt'], key: 'october', salesKey: 'Oct26', label: 'Oktober' },
    { keywords: ['november', 'nov'], key: 'november', salesKey: 'Nov25', label: 'November' },
    { keywords: ['december', 'desember', 'dec', 'des'], key: 'december', salesKey: 'Dec25', label: 'Desember' }
];

function detectMonthFromHeader(headerText) {
    const clean = headerText.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const m of MONTH_CONFIG) {
        if (m.keywords.some(kw => clean.includes(kw))) {
            return m;
        }
    }
    return null;
}

/* ==========================================================================
   PARSER CSV DASHBOARD DENGAN DETEKSI CERDAS
   ========================================================================== */
function parseDashboardCSV(text) {
    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length === 0) return [];

    const headers = parseLineCSVCells(lines[0]);
    detectedMonths = [];
    const monthMapSeen = new Set();

    let colIndices = { bm: 0, abm: 1, store: 2, nik: 3, staff: 4 };

    headers.forEach((header, index) => {
        const cleanHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (cleanHeader.includes('bm') && !cleanHeader.includes('abm')) colIndices.bm = index;
        else if (cleanHeader.includes('abm')) colIndices.abm = index;
        else if (cleanHeader.includes('store') || cleanHeader.includes('toko')) colIndices.store = index;
        else if (cleanHeader.includes('nik')) colIndices.nik = index;
        else if (cleanHeader.includes('staff') || cleanHeader.includes('nama')) colIndices.staff = index;

        // Deteksi Bulan dari Header
        const monthMatch = detectMonthFromHeader(header);
        if (monthMatch) {
            // Hindari duplikasi jika ada kolom bulan berulang
            if (!monthMapSeen.has(monthMatch.key)) {
                monthMapSeen.add(monthMatch.key);
                detectedMonths.push({
                    index: index,
                    key: monthMatch.key,
                    salesKey: monthMatch.salesKey,
                    label: monthMatch.label
                });
            }
        } else if (index >= 5) {
            // Fallback jika header tidak dikenali nama bulannya tapi posisi kolomnya di area data bulan
            const fallbackKey = `month_${index}`;
            if (!monthMapSeen.has(fallbackKey)) {
                monthMapSeen.add(fallbackKey);
                detectedMonths.push({
                    index: index,
                    key: fallbackKey,
                    salesKey: header,
                    label: header || `Kolom ${index + 1}`
                });
            }
        }
    });

    // Parse Data Baris
    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const row = parseLineCSVCells(lines[i]);
        if (row.length < 5) continue;

        const monthlyUpt = {};
        detectedMonths.forEach(m => {
            const rawVal = row[m.index] || '0';
            monthlyUpt[m.key] = parseFloat(rawVal.replace(/[^0-9.-]+/g, '')) || 0;
        });

        result.push({
            namaBM: row[colIndices.bm] || '-',
            namaABM: row[colIndices.abm] || '-',
            namaStore: row[colIndices.store] || '-',
            nik: row[colIndices.nik] || '-',
            namaStaff: row[colIndices.staff] || '-',
            monthlyUpt: monthlyUpt
        });
    }
    return result;
}
