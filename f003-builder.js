let f003RowCount = 0;

document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('f003-date');
    if(dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
    addF003Row();
});

// 1. TAMBAH BARIS (CONDENSED & MASUK KE TBODY)
function addF003Row() {
    f003RowCount++;
    const tbody = document.getElementById('f003-tbody'); // <-- Elemen yang benar
    if(!tbody) return; 
    
    const rowId = 'row-' + f003RowCount;
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = "border-b border-slate-200 hover:bg-slate-50 transition-colors";
    
    tr.innerHTML = `
        <td class="px-2 py-3 text-center text-xs font-bold text-slate-500 align-top row-number">${f003RowCount}</td>
        
        <td class="px-2 py-3 align-top">
            <input type="text" id="barcode-${f003RowCount}" autocomplete="off" class="w-36 px-2 py-1.5 text-xs font-bold border border-slate-300 rounded focus:border-amber-500 outline-none" placeholder="Scan Barcode...">
        </td>
        
        <td class="px-2 py-3 align-top">
            <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-16 px-2 py-1.5 text-xs font-bold text-center border border-slate-300 rounded focus:border-amber-500 outline-none">
        </td>
        
        <td class="px-2 py-3 align-top min-w-[140px]">
            <select id="kategori-${f003RowCount}" onchange="handleCategoryChange(${f003RowCount})" class="w-full px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded focus:border-amber-500 outline-none mb-2">
                <option value="">-- Pilih --</option>
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
            <!-- TEMPAT KOLOM DINAMIS MUNCUL DENGAN RAPI -->
            <div id="dynamic-fields-${f003RowCount}" class="flex flex-col gap-1.5 empty:hidden"></div>
        </td>
        
        <td class="px-2 py-3 align-top min-w-[140px]">
            <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-full px-2 py-1.5 text-xs font-semibold border border-slate-300 rounded focus:border-amber-500 outline-none">
                <option value="">-- Alasan --</option>
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
        
        <td class="px-2 py-3 align-top text-center">
            <label class="cursor-pointer bg-slate-100 hover:bg-slate-200 px-2 py-1.5 rounded text-[10px] font-bold border border-slate-300 flex items-center justify-center gap-1 w-20 mx-auto">
                <i data-lucide="camera" class="w-3 h-3 text-amber-600"></i> Foto
                <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
            </label>
            <img id="preview-${f003RowCount}" src="" class="hidden w-12 h-12 mt-2 object-cover rounded border border-amber-500 mx-auto cursor-pointer" onclick="window.open(this.src)">
        </td>
        
        <td class="px-2 py-3 align-top text-center">
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

// 2. KONTROL KOLOM DINAMIS (Muncul di bawah Kategori secara padat)
function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const container = document.getElementById(`dynamic-fields-${rowNum}`);
    
    let html = '';
    
    if (kategori === 'DDR') {
        html += `<input type="text" id="invoice-no-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Invoice No.">`;
    }
    else if (kategori === 'DMC' || kategori === 'DMW') {
        html += `<input type="text" id="ctm-receipt-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="CTM Receipt No.">
                 <input type="text" id="new-receipt-date-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="New Date (DD/MM/YYYY)">`;
        
        if (kategori === 'DMW') {
            html += `<input type="text" id="serial-number-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Serial Number">`;
        }
        
        html += `<input type="text" id="old-receipt-date-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Old Date (DD/MM/YYYY)">
                 <input type="text" id="old-receipt-no-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Old Receipt No.">
                 <input type="text" id="cust-name-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Customer Name">
                 <input type="text" id="cust-phone-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Customer Phone">`;
    }
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        html += `<input type="text" id="expiry-date-${rowNum}" class="w-full px-2 py-1 text-[10px] border border-amber-300 bg-amber-50 rounded outline-none" placeholder="Expiry Date (DD/MM/YYYY)">`;
    }
    
    container.innerHTML = html;
}

// 3. SCANNER PDT LISTENER
function setupBarcodeScannerListener(rowNum) {
    const barcodeInput = document.getElementById(`barcode-${rowNum}`);
    if (!barcodeInput) return;

    let scanTimer;
    function moveNext() {
        const value = barcodeInput.value.trim();
        if (value === "") return;
        const qty = document.getElementById(`qty-${rowNum}`);
        if (qty) { qty.focus(); qty.select(); }
    }

    barcodeInput.addEventListener("input", function () {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(moveNext, 80);
    });

    barcodeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === "Tab" || e.keyCode === 13 || e.keyCode === 9) {
            e.preventDefault();
            clearTimeout(scanTimer);
            moveNext();
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
    if (tbody.children.length <= 1) {
        resetF003Table();
        return;
    }
    const row = document.getElementById(rowId);
    if(row) { row.remove(); recalculateRowNumbers(); }
}

function recalculateRowNumbers() {
    const rows = document.querySelectorAll('#f003-tbody tr');
    rows.forEach((tr, index) => {
        const numCell = tr.querySelector('.row-number');
        if (numCell) numCell.textContent = index + 1;
    });
}

function resetF003Table() {
    if (confirm("Reset semua baris?")) {
        const tbody = document.getElementById('f003-tbody');
        tbody.innerHTML = "";
        f003RowCount = 0;
        addF003Row();
    }
}

// 4. PREVIEW FOTO YANG AMAN
function previewPhoto(input, rowId) {
    const previewImg = document.getElementById(`preview-${rowId}`);
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 500; 
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Kompresi yang diringankan agar Apps Script tidak error
                const safeBase64 = canvas.toDataURL('image/jpeg', 0.6);
                previewImg.src = safeBase64;
                previewImg.classList.remove('hidden');
                previewImg.setAttribute('data-base64', safeBase64);
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

// 5. GENERATE DATA (KOLOM H-O MASUK DENGAN BENAR)
async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) {
        alert("Mohon isi Store Code dan Store Name!");
        return;
    }

    const rows = document.querySelectorAll('#f003-tbody tr');
    if (rows.length === 0) {
        alert("Belum ada baris barang!");
        return;
    }

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
                
                // Ini yang memastikan Data Kolom H-O terkirim akurat
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

        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ storeCode, storeName, sendDate, items })
        });

        const result = await response.json();

        if (result.status === "success") {
            if (confirm(`SUKSES!\nFile berhasil dibuat.\nKlik OK untuk membuka Spreadsheet.`)) {
                window.open(result.url, '_blank');
            }
        } else {
            alert("Gagal: " + result.message);
        }
    } catch (error) {
        alert("Kesalahan jaringan: " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
