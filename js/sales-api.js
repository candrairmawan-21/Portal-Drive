/**
 * @file sales-api.js
 * @description API Layer abstraction dengan caching dan fallback error handling.
 */

import cacheManager from './sales-cache.js';

const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwJGzJvsP7o4O4zZbQzEZ2sbqPtRBCPbrgPwU4krc_mDn4xifZgTQdBQBT5G2QW0zMF/exec";
const CSV_SUBMISSION_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv";
const CSV_OFFICIAL_URL   = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv";

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

function parseCSVToObjects(text) {
    const lines = text.split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.replace(/["\r]/g, "").trim());
    const results = [];

    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const row = lines[i].split(',').map(cell => cell.replace(/["\r]/g, "").trim());
        const obj = {};
        headers.forEach((hdr, idx) => { obj[hdr] = row[idx] || ""; });
        results.push(obj);
    }
    return results;
}
