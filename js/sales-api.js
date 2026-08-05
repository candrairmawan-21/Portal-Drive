/**
 * @file sales-api.js
 * @description API Layer abstraction dengan caching dan fallback error handling.
 */

import cacheManager from './sales-cache.js';

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwJGzJvsP7o4O4zZbQzEZ2sbqPtRBCPbrgPwU4krc_mDn4xifZgTQdBQBT5G2QW0zMF/exec";

// 1. PASTIKAN GID BERBEDA UNTUK MASING-MASING TAB/SHEET DI GOOGLE SPREADSHEET
const CSV_SUBMISSION_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?gid=0&single=true&output=csv";
const CSV_OFFICIAL_URL   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?gid=1129267198&single=true&output=csv"; // Ganti angka 123456789 dengan GID tab OFFICIAL_IT_REPORT Anda

export async function fetchSalesDataset(sourceType, forceRefresh = false) {
    const cacheKey = `sales_data_${sourceType}`;
    if (!forceRefresh) {
        const cached = cacheManager.get(cacheKey);
        if (cached) return cached;
    }

    const url = (sourceType === 'OFFICIAL_IT') ? CSV_OFFICIAL_URL : CSV_SUBMISSION_URL;
    try {
        const response = await fetch(`${url}&t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const csvText = await response.text();
        const parsedData = parseCSVToObjects(csvText);
        
        // Simpan ke cache selama 15 menit
        cacheManager.set(cacheKey, parsedData, 900);
        return parsedData;
    } catch (err) {
        console.error("Gagal mengambil dataset:", err);
        return [];
    }
}

// 2. PARSER AMAN TERHADAP TANDA KUTIP (MENGIKUTI STANDAR MODUL EXISTING)
function parseCSVToObjects(text) {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0]).map(h => h.replace(/["\r]/g, "").trim());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = parseCSVLine(lines[i]);
        const obj = {};
        headers.forEach((hdr, idx) => { 
            obj[hdr] = row[idx] ? row[idx].replace(/["\r]/g, "").trim() : ""; 
        });
        results.push(obj);
    }
    return results;
}

function parseCSVLine(text) {
    const result = [];
    let insideQuotes = false;
    let entry = '';
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (c === '"') {
            insideQuotes = !insideQuotes;
        } else if (c === ',' && !insideQuotes) {
            result.push(entry);
            entry = '';
        } else {
            entry += c;
        }
    }
    result.push(entry);
    return result.map(item => item.replace(/^"|"$/g, '').trim());
}
