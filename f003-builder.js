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
    
    const rowId = 'row-' + f003RowCount;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = "border-b border-slate-200 hover:bg-slate-50 transition-colors";
    
    tr.innerHTML = `
        <td class="p-2 text-center text-xs font-bold text-slate-500 align-top row-number" style="width: 40px;">${f003RowCount}</td>
        
        <td class="p-2 align-top" style="width: 130px;">
            <input type="text" id="barcode-${f003RowCount}" autocomplete="off" class="w-full px-2 py-1.5 text-[11px] font-bold border border-slate-300 rounded focus:border-amber-500 outline-none" placeholder="Scan Barcode">
        </td>
        
        <td class="p-2 align-top" style="width: 60px;">
            <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-full px-1 py-1.5 text-[11px] font-bold text-center border border-slate-300 rounded focus:border-amber-500 outline-none">
        </td>
        
        <td class="p-2 align-top" style="width: 110px;">
            <select id="kategori-${f003RowCount}" onchange="handleCategoryChange(${f003RowCount})" class="w-full px-1 py-1.5 text-[11px] font-bold border border-slate-300 rounded focus:border-amber-500 outline-none cursor-pointer">
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
        
        <!-- ALASAN & KOLOM DINAMIS (Disusun Rapi ke Bawah Menggunakan Grid) -->
        <td class="p-2 align-top">
            <div class="flex flex-col gap-1.5 w-full">
                <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-full px-2 py-1.5 text-[11px] font-bold border border-slate-300 rounded focus:border-amber-500 outline-none cursor-pointer">
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
                <!-- TEMPAT KOLOM DINAMIS -->
                <div id="dynamic-fields-${f003RowCount}" class="grid grid-cols-2 gap-1.5 w-full empty:hidden"></div>
            </div>
        </td>
        
        <td class="p-2 align-top text-center" style="width: 70px;">
            <label class="cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-[10px] font-bold border border-slate-300 flex items-center justify-center gap-1 w-full transition-colors">
                <i data-lucide="camera" class="w-3 h-3 text-amber-600"></i> Foto
                <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
            </label>
            <img id="preview-${f003RowCount}" src="" class="hidden w-10 h-10 mt-1 object-cover rounded border border-amber-500 mx-auto cursor-pointer" onclick="window.open(this.src)">
        </td>
        
        <td class="p-2 align-top text-center" style="width: 40px;">
            <button onclick="removeF003Row('${rowId}')" class="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors inline-block">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    setupBarcodeScannerListener(f003RowCount);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => {
        const barcodeInput = document.getElementById(`barcode-${f003RowCount}`);
        if(barcodeInput) barcodeInput.focus();
    }, 100);
}

// 2. KONTROL KOLOM DINAMIS (Akan masuk sempurna ke dalam Grid)
function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const container = document.getElementById(`dynamic-fields-${rowNum}`);
    
    let html = '';
    const inputClass = "w-full px-2 py-1 text-[10px] font-bold border border-amber-300 bg-amber-50 rounded outline-none placeholder-slate-500 focus:bg-white focus:border-amber-500";
    
    if (kategori === 'DDR') {
        html += `<input type="text" id="invoice-no-${rowNum}" class="${inputClass} col-span-2" placeholder="Invoice No.">`;
    }
    else if (kategori === 'DMC' || kategori === 'DMW') {
        html += `<input type="text" id="ctm-receipt-${rowNum}" class="${inputClass}" placeholder="CTM Receipt">
                 <input type="text" id="new-receipt-date-${rowNum}" class="${inputClass}" placeholder="New Date">`;
        if (kategori === 'DMW') {
            html += `<input type="text" id="serial-number-${rowNum}" class="${inputClass} col-span-2" placeholder="Serial No.">`;
        }
        html += `<input type="text" id="old-receipt-date-${rowNum}" class="${inputClass}" placeholder="Old Date">
                 <input type="text" id="old-receipt-no-${rowNum}" class="${inputClass}" placeholder="Old Receipt">
                 <input type="text" id="cust-name-${rowNum}" class="${inputClass}" placeholder="Cust. Name">
                 <input type="text" id="cust-phone-${rowNum}" class="${inputClass}" placeholder="Cust. Phone">`;
    }
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        html += `<input type="text" id="expiry-date-${rowNum}" class="${inputClass} col-span-2" placeholder="Expiry Date">`;
    }
    
    container.innerHTML = html;
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

function removeF003Row(rowId) {
    const tbody = document.getElementById('f003-tbody');
    if (tbody.children.length <= 1) { resetF003Table(); return; }
    const row = document.getElementById(rowId);
    if(row) { row.remove(); recalculateRowNumbers(); }
}

function recalculateRowNumbers() {
    document.querySelectorAll('#f003-tbody tr').forEach((tr, index) => {
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

// 5. FETCH API (DENGAN HEADER DAN REDIRECT YANG BENAR ANTI FAILED TO FETCH)
async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) { alert("Isi Store Code & Store Name!"); return; }
    
    const rows = document.querySelectorAll('#f003-tbody tr');
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
            items.push({
                no: index + 1,
                barcode: tr.querySelector('input[id^="barcode-"]')?.value || "",
                qty: tr.querySelector('input[id^="qty-"]')?.value || "0",
                kategori: tr.querySelector('select[id^="kategori-"]')?.value || "",
                alasan: tr.querySelector('select[id^="alasan-"]')?.value || "",
                invoiceNo: tr.querySelector(`input[id^="invoice-no-"]`)?.value || "",
                ctmReceipt: tr.querySelector(`input[id^="ctm-receipt-"]`)?.value || "",
                newReceiptDate: tr.querySelector(`input[id^="new-receipt-date-"]`)?.value || "",
                expiryDate: tr.querySelector(`input[id^="expiry-date-"]`)?.value || "",
                serialNumber: tr.querySelector(`input[id^="serial-number-"]`)?.value || "",
                oldReceiptDate: tr.querySelector(`input[id^="old-receipt-date-"]`)?.value || "",
                oldReceiptNo: tr.querySelector(`input[id^="old-receipt-no-"]`)?.value || "",
                custName: tr.querySelector(`input[id^="cust-name-"]`)?.value || "",
                custPhone: tr.querySelector(`input[id^="cust-phone-"]`)?.value || "",
                photoBase64: tr.querySelector('img[id^="preview-"]')?.getAttribute('data-base64') || ""
            });
        });

        // INI KUNCI UTAMA ANTI ERROR JARINGAN: 
        // Wajib menggunakan 'text/plain;charset=utf-8' dan redirect: 'follow'
        const response = await fetch(scriptUrl, {
            method: "POST",
            redirect: "follow",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
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
        alert("Kesalahan jaringan: " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
