let f003RowCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('f003-date');
    if(dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
    addF003Row();
});

function addF003Row() {
    f003RowCount++;
    const tbody = document.getElementById('f003-tbody');
    if(!tbody) return; 
    
    const mainRowId = 'row-main-' + f003RowCount;
    const dynRowId = 'row-dyn-' + f003RowCount;
    
    // BARIS 1: KOLOM UTAMA YANG SANGAT KETAT (CONDENSED)
    const trMain = document.createElement('tr');
    trMain.id = mainRowId;
    trMain.className = "border-b border-slate-100 hover:bg-slate-50 transition-colors";
    trMain.innerHTML = `
        <td class="p-2 text-center text-xs font-bold text-slate-500 align-middle row-number w-10">${f003RowCount}</td>
        
        <td class="p-2 align-middle">
            <input type="text" id="barcode-${f003RowCount}" autocomplete="off" class="w-full px-2 py-1 text-xs font-bold border border-slate-300 rounded focus:border-amber-500 outline-none" placeholder="Scan Barcode">
        </td>
        
        <td class="p-2 align-middle w-20">
            <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-full px-1 py-1 text-xs font-bold text-center border border-slate-300 rounded focus:border-amber-500 outline-none">
        </td>
        
        <td class="p-2 align-middle w-32">
            <select id="kategori-${f003RowCount}" onchange="handleCategoryChange(${f003RowCount})" class="w-full px-1 py-1 text-xs font-semibold border border-slate-300 rounded focus:border-amber-500 outline-none cursor-pointer">
                <option value="">-- Kategori --</option>
                <option value="DMO">DMO</option>
                <option value="DDR">DDR</option>
                <option value="DMC">DMC</option>
                <option value="DMP">DMP</option>
                <option value="DPI">DPI</option>
                <option value="2DMP">2DMP</option>
                <option value="DMW">DMW</option>
                <option value="DMQ">DMQ</option>
                <option value="DMN">DMN</option>
                <option value="SCB">SCB</option>
                <option value="DME">DME</option>
            </select>
        </td>
        
        <td class="p-2 align-middle w-44">
            <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded focus:border-amber-500 outline-none cursor-pointer">
                <option value="">-- Alasan Rusak --</option>
                <option value="PECAH">PECAH</option>
                <option value="PATAH">PATAH</option>
                <option value="SOBEK">SOBEK</option>
                <option value="KEMASAN RUSAK">KEMASAN RUSAK</option>
                <option value="BOCOR">BOCOR</option>
                <option value="KOTOR">KOTOR</option>
                <option value="TIDAK BERFUNGSI">TIDAK BERFUNGSI</option>
                <option value="PART TIDAK LENGKAP">PART TIDAK LENGKAP</option>
                <option value="DIMAKAN TIKUS">DIMAKAN TIKUS</option>
                <option value="EXPIRED">EXPIRED</option>
                <option value="H-35 EXPIRED">H-35 EXPIRED</option>
            </select>
        </td>
        
        <td class="p-2 align-middle text-center w-28">
            <label class="cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded text-[10px] font-bold border border-slate-300 flex items-center justify-center gap-1 transition-colors w-full">
                <i data-lucide="camera" class="w-3 h-3 text-amber-600"></i> Foto
                <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
            </label>
            <img id="preview-${f003RowCount}" src="" class="hidden w-12 h-12 mt-1 object-cover rounded border border-amber-500 mx-auto cursor-pointer" onclick="window.open(this.src)">
        </td>
        
        <td class="p-2 align-middle text-center w-12">
            <button onclick="removeF003Row(${f003RowCount})" class="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors inline-block">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
    
    // BARIS 2: BARIS SUB-ROW UNTUK KOLOM DINAMIS (Merentang Penuh)
    const trDyn = document.createElement('tr');
    trDyn.id = dynRowId;
    trDyn.className = "hidden bg-amber-50/20 border-b border-slate-200"; // Tersembunyi secara default
    trDyn.innerHTML = `
        <td colspan="7" class="p-3">
            <div id="dynamic-fields-${f003RowCount}" class="flex flex-wrap gap-3 items-center w-full"></div>
        </td>
    `;
    
    tbody.appendChild(trMain);
    tbody.appendChild(trDyn);
    
    setupBarcodeScannerListener(f003RowCount);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    setTimeout(() => {
        const barcodeInput = document.getElementById(`barcode-${f003RowCount}`);
        if(barcodeInput) barcodeInput.focus();
    }, 100);
}

// MUNCULKAN KOLOM DINAMIS DI SUB-ROW (TIDAK MERUSAK TABEL ATAS)
function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const container = document.getElementById(`dynamic-fields-${rowNum}`);
    const dynRow = document.getElementById(`row-dyn-${rowNum}`);
    
    let html = '';
    const inputClass = "w-48 px-3 py-1.5 text-xs font-semibold border border-amber-300 bg-white rounded outline-none focus:border-amber-500 shadow-sm";
    
    if (kategori === 'DDR') {
        html += `<input type="text" id="invoice-no-${rowNum}" class="${inputClass}" placeholder="Invoice No.">`;
    }
    else if (kategori === 'DMC' || kategori === 'DMW') {
        html += `<input type="text" id="ctm-receipt-${rowNum}" class="${inputClass}" placeholder="CTM Receipt">
                 <input type="text" id="new-receipt-date-${rowNum}" class="${inputClass}" placeholder="New Date (DD/MM/YYYY)">`;
        if (kategori === 'DMW') {
            html += `<input type="text" id="serial-number-${rowNum}" class="${inputClass}" placeholder="Serial Number">`;
        }
        html += `<input type="text" id="old-receipt-date-${rowNum}" class="${inputClass}" placeholder="Old Date (DD/MM/YYYY)">
                 <input type="text" id="old-receipt-no-${rowNum}" class="${inputClass}" placeholder="Old Receipt No">
                 <input type="text" id="cust-name-${rowNum}" class="${inputClass} !w-56" placeholder="Customer Name">
                 <input type="text" id="cust-phone-${rowNum}" class="${inputClass}" placeholder="Customer Phone">`;
    }
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        html += `<input type="text" id="expiry-date-${rowNum}" class="${inputClass}" placeholder="Expiry Date (DD/MM/YYYY)">`;
    }
    
    if(html !== '') {
        container.innerHTML = html;
        dynRow.classList.remove('hidden'); // Tampilkan sub-row
    } else {
        container.innerHTML = '';
        dynRow.classList.add('hidden'); // Sembunyikan sub-row jika kosong
    }
}

function setupBarcodeScannerListener(rowNum) {
    const barcodeInput = document.getElementById(`barcode-${rowNum}`);
    if (!barcodeInput) return;
    let scanTimer;
    barcodeInput.addEventListener("input", function () {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(() => {
            const qty = document.getElementById(`qty-${rowNum}`);
            if (qty && barcodeInput.value.trim() !== "") { qty.focus(); qty.select(); }
        }, 80);
    });
    barcodeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.keyCode === 13 || e.key === "Tab") {
            e.preventDefault();
            clearTimeout(scanTimer);
            const qty = document.getElementById(`qty-${rowNum}`);
            if (qty && barcodeInput.value.trim() !== "") { qty.focus(); qty.select(); }
        }
    });
}

function handleEnterOnQty(event, rowNum) {
    if (event.key === 'Enter' || event.keyCode === 13) {
        event.preventDefault();
        const kategoriField = document.getElementById(`kategori-${rowNum}`);
        if (kategoriField) kategoriField.focus();
    }
}

function finishRow(e, rowNum) {
    if (e.key === 'Enter' || e.keyCode === 13) {
        e.preventDefault();
        addF003Row();
    }
}

function removeF003Row(rowNum) {
    const tbody = document.getElementById('f003-tbody');
    // Cek jumlah baris utama
    const mainRows = tbody.querySelectorAll('tr[id^="row-main-"]');
    if (mainRows.length <= 1) { resetF003Table(); return; }
    
    const mainRow = document.getElementById(`row-main-${rowNum}`);
    const dynRow = document.getElementById(`row-dyn-${rowNum}`);
    if(mainRow) mainRow.remove();
    if(dynRow) dynRow.remove();
    
    recalculateRowNumbers();
}

function recalculateRowNumbers() {
    const mainRows = document.querySelectorAll('#f003-tbody tr[id^="row-main-"]');
    mainRows.forEach((tr, index) => {
        const numCell = tr.querySelector('.row-number');
        if (numCell) numCell.textContent = index + 1;
    });
}

function resetF003Table() {
    if (confirm("Reset semua baris?")) {
        document.getElementById('f003-tbody').innerHTML = "";
        f003RowCount = 0;
        addF003Row();
    }
}

function previewPhoto(input, rowId) {
    const previewImg = document.getElementById(`preview-${rowId}`);
    const file = input.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 400; 
                let width = img.width; let height = img.height;
                if (width > MAX_WIDTH) { height = Math.round((height * MAX_WIDTH) / width); width = MAX_WIDTH; }
                canvas.width = width; canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                // Kompres ke JPEG Kualitas 50% agar API enteng
                const safeBase64 = canvas.toDataURL('image/jpeg', 0.5);
                previewImg.src = safeBase64;
                previewImg.classList.remove('hidden');
                previewImg.setAttribute('data-base64', safeBase64);
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) { alert("Isi Store Code & Store Name!"); return; }
    
    // Ambil data hanya dari Main Row, karena Sub-Row tidak punya ID input utama
    const rows = document.querySelectorAll('#f003-tbody tr[id^="row-main-"]');
    if (rows.length === 0) { alert("Belum ada barang!"); return; }

    const btnGenerate = document.querySelector('button[onclick="generateF003Excel()"]');
    const originalText = btnGenerate.innerHTML;
    btnGenerate.disabled = true;
    btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> Memproses...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const scriptUrl = "https://script.google.com/macros/s/AKfycbyGg_4yU44ZetFlNCbsA2vpNaTHZITLd1od7XX_0R2_Cg34py9qMbN0OFX-BwFdDftVDA/exec";

    try {
        let items = [];
        rows.forEach((tr, index) => {
            // Kita butuh rowNum asli untuk narik data dari Sub-Row
            const rowNum = tr.id.replace('row-main-', '');
            
            items.push({
                no: index + 1,
                barcode: document.getElementById(`barcode-${rowNum}`)?.value || "",
                qty: document.getElementById(`qty-${rowNum}`)?.value || "0",
                kategori: document.getElementById(`kategori-${rowNum}`)?.value || "",
                alasan: document.getElementById(`alasan-${rowNum}`)?.value || "",
                invoiceNo: document.getElementById(`invoice-no-${rowNum}`)?.value || "",
                ctmReceipt: document.getElementById(`ctm-receipt-${rowNum}`)?.value || "",
                newReceiptDate: document.getElementById(`new-receipt-date-${rowNum}`)?.value || "",
                expiryDate: document.getElementById(`expiry-date-${rowNum}`)?.value || "",
                serialNumber: document.getElementById(`serial-number-${rowNum}`)?.value || "",
                oldReceiptDate: document.getElementById(`old-receipt-date-${rowNum}`)?.value || "",
                oldReceiptNo: document.getElementById(`old-receipt-no-${rowNum}`)?.value || "",
                custName: document.getElementById(`cust-name-${rowNum}`)?.value || "",
                custPhone: document.getElementById(`cust-phone-${rowNum}`)?.value || "",
                photoBase64: document.getElementById(`preview-${rowNum}`)?.getAttribute('data-base64') || ""
            });
        });

        // Request murni tanpa Headers untuk Bypass CORS preflight
        const response = await fetch(scriptUrl, {
            method: "POST",
            body: JSON.stringify({ storeCode, storeName, sendDate, items })
        });

        const result = await response.json();

        if (result.status === "success") {
            if (confirm(`SUKSES!\nFile berhasil dibuat.\nKlik OK untuk membuka.`)) {
                window.open(result.url, '_blank');
            }
        } else {
            alert("Gagal memproses di server: " + result.message);
        }
    } catch (error) {
        alert("Kesalahan jaringan (Pastikan Apps Script di-Deploy Ulang!): " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
            }
                    
