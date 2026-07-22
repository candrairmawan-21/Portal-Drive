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
    const rowId = 'row-' + f003RowCount;
    
    const tr = document.createElement('tr');
    tr.id = rowId;
    tr.className = "hover:bg-amber-50/30 transition-colors border-b border-slate-100 text-sm";
    
    tr.innerHTML = `
        <td class="px-3 py-3 text-center font-bold text-xs text-slate-400 row-number align-middle">${f003RowCount}</td>
        
        <!-- BARCODE & QTY -->
        <td class="px-3 py-3 align-middle">
            <div class="flex gap-2 items-center">
                <input type="text" id="barcode-${f003RowCount}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="none" class="w-40 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner text-amber-900" placeholder="Scan Barcode...">
                <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-16 px-2 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-center focus:outline-none focus:border-amber-500" title="Qty">
            </div>
        </td>

        <!-- KATEGORI & ALASAN -->
        <td class="px-3 py-3 align-middle">
            <div class="flex gap-2">
                <select id="kategori-${f003RowCount}" onchange="handleCategoryChange(${f003RowCount})" class="w-36 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-amber-500">
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
                <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-44 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-amber-500">
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
            </div>
        </td>

        <!-- KOLOM DINAMIS (MUNCUL JIKA KATEGORI DIPILIH) -->
        <td class="px-3 py-3 align-middle">
            <div id="dynamic-fields-${f003RowCount}" class="flex flex-wrap gap-2 items-center">
                <span class="text-xs text-slate-400 italic">Pilih kategori...</span>
            </div>
        </td>

        <!-- FOTO BUKTI -->
        <td class="px-3 py-3 text-center align-middle">
            <div class="flex items-center justify-center gap-2">
                <label class="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-sm flex items-center">
                    <i data-lucide="camera" class="w-3.5 h-3.5 mr-1.5"></i> Foto
                    <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
                </label>
                <img id="preview-${f003RowCount}" src="" class="hidden w-9 h-9 rounded-lg object-cover border border-slate-200 shadow-sm cursor-pointer" onclick="window.open(this.src)">
            </div>
        </td>
        
        <!-- AKSI -->
        <td class="px-3 py-3 text-center align-middle">
            <button onclick="removeF003Row('${rowId}')" class="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-colors">
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

// Handler Perubahan Kategori (Ditata menyamping agar rapi di tabel)
function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const container = document.getElementById(`dynamic-fields-${rowNum}`);
    
    let html = '';
    
    if (kategori === 'DDR') {
        html += `
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">Invoice No.</span>
                <input type="text" id="invoice-no-${rowNum}" class="w-36 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm" placeholder="No. Invoice">
            </div>
        `;
    }
    else if (kategori === 'DMC' || kategori === 'DMW') {
        html += `
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">CTM Receipt No.</span>
                <input type="text" id="ctm-receipt-${rowNum}" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm" placeholder="CTM Receipt">
            </div>
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">New Receipt Date</span>
                <input type="text" id="new-receipt-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm">
            </div>
        `;
        
        if (kategori === 'DMW') {
            html += `
                <div class="flex flex-col">
                    <span class="text-[9px] font-bold text-amber-600 uppercase">Serial Number</span>
                    <input type="text" id="serial-number-${rowNum}" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm" placeholder="Serial No.">
                </div>
            `;
        }
        
        html += `
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">Old Receipt Date</span>
                <input type="text" id="old-receipt-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm">
            </div>
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">Old Receipt No</span>
                <input type="text" id="old-receipt-no-${rowNum}" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm" placeholder="Old Receipt">
            </div>
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">Customer Name</span>
                <input type="text" id="cust-name-${rowNum}" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm" placeholder="Nama Customer">
            </div>
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">Customer Phone</span>
                <input type="text" id="cust-phone-${rowNum}" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm" placeholder="No. Telp">
            </div>
        `;
    }
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        html += `
            <div class="flex flex-col">
                <span class="text-[9px] font-bold text-amber-600 uppercase">Expiry Date</span>
                <input type="text" id="expiry-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-32 px-2.5 py-1.5 bg-white border border-amber-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:border-amber-500 shadow-sm">
            </div>
        `;
    } else {
        html += `<span class="text-xs text-slate-400 italic">Tidak ada kolom tambahan</span>`;
    }
    
    container.innerHTML = html;
}

// Mekanisme Scanner Handal untuk Android PDT & Manual
function setupBarcodeScannerListener(rowNum) {
    const barcodeInput = document.getElementById(`barcode-${rowNum}`);
    if (!barcodeInput) return;

    let scanTimer;

    function moveNext() {
        const value = barcodeInput.value.trim();
        if (value === "") return;

        const qty = document.getElementById(`qty-${rowNum}`);
        if (qty) {
            qty.focus();
            qty.select();
        }
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
    if(row) {
        row.remove();
        recalculateRowNumbers();
    }
}

function recalculateRowNumbers() {
    const rows = document.querySelectorAll('#f003-tbody tr');
    rows.forEach((tr, index) => {
        const newNum = index + 1;
        const numCell = tr.querySelector('.row-number');
        if (numCell) numCell.textContent = newNum;
    });
}

function resetF003Table() {
    if (confirm("Apakah Anda yakin ingin mereset dan menghapus semua baris?")) {
        const tbody = document.getElementById('f003-tbody');
        tbody.innerHTML = "";
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
                const MAX_WIDTH = 600; 
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
                
                const safeBase64 = canvas.toDataURL('image/jpeg', 0.7);
                previewImg.src = safeBase64;
                previewImg.classList.remove('hidden');
                previewImg.setAttribute('data-base64', safeBase64);
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

// ========================================================
// KIRIM DATA KE GOOGLE SPREADSHEET (DENGAN KOLOM DINAMIS H s.d O)
// ========================================================
async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) {
        alert("Mohon isi Store Code dan Store Name terlebih dahulu!");
        return;
    }

    const rows = document.querySelectorAll('#f003-tbody tr');
    if (rows.length === 0) {
        alert("Belum ada baris barang yang ditambahkan!");
        return;
    }

    const btnGenerate = document.querySelector('button[onclick="generateF003Excel()"]');
    const originalText = btnGenerate.innerHTML;
    btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Memproses File Toko...`;
    btnGenerate.disabled = true;

    let items = [];
    rows.forEach((tr, index) => {
        const rowNumIndex = index + 1;
        const barcodeInput = tr.querySelector('input[id^="barcode-"]');
        const qtyInput = tr.querySelector('input[id^="qty-"]');
        const kategoriSelect = tr.querySelector('select[id^="kategori-"]');
        const alasanSelect = tr.querySelector('select[id^="alasan-"]');
        
        const barcode = barcodeInput ? barcodeInput.value : "";
        const qty = qtyInput ? qtyInput.value : "0";
        const kategori = kategoriSelect ? kategoriSelect.value : "";
        const alasan = alasanSelect ? alasanSelect.value : "";

        const invoiceNo = tr.querySelector(`input[id^="invoice-no-"]`)?.value || "";
        const ctmReceipt = tr.querySelector(`input[id^="ctm-receipt-"]`)?.value || "";
        const newReceiptDate = tr.querySelector(`input[id^="new-receipt-date-"]`)?.value || "";
        const expiryDate = tr.querySelector(`input[id^="expiry-date-"]`)?.value || "";
        const serialNumber = tr.querySelector(`input[id^="serial-number-"]`)?.value || "";
        const oldReceiptDate = tr.querySelector(`input[id^="old-receipt-date-"]`)?.value || "";
        const oldReceiptNo = tr.querySelector(`input[id^="old-receipt-no-"]`)?.value || "";
        const custName = tr.querySelector(`input[id^="cust-name-"]`)?.value || "";
        const custPhone = tr.querySelector(`input[id^="cust-phone-"]`)?.value || "";
        
        const previewImg = tr.querySelector('img[id^="preview-"]');
        let photoBase64 = "";
        if (previewImg && !previewImg.classList.contains('hidden')) {
            photoBase64 = previewImg.getAttribute('data-base64') || "";
        }

        items.push({
            no: rowNumIndex,
            barcode: barcode,
            qty: qty,
            kategori: kategori,
            alasan: alasan,
            invoiceNo: invoiceNo,
            ctmReceipt: ctmReceipt,
            newReceiptDate: newReceiptDate,
            expiryDate: expiryDate,
            serialNumber: serialNumber,
            oldReceiptDate: oldReceiptDate,
            oldReceiptNo: oldReceiptNo,
            custName: custName,
            custPhone: custPhone,
            photoBase64: photoBase64
        });
    });

    const payload = {
        storeCode: storeCode,
        storeName: storeName,
        sendDate: sendDate,
        items: items
    };

    const scriptUrl = "https://script.google.com/macros/s/AKfycbyGg_4yU44ZetFlNCbsA2vpNaTHZITLd1od7XX_0R2_Cg34py9qMbN0OFX-BwFdDftVDA/exec";

    try {
        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            const userChoice = confirm(`BERHASIL!\n\nFile Spreadsheet khusus toko ${storeCode} telah dibuat lengkap dengan data dinamisnya.\n\nKlik OK untuk langsung membuka Google Spreadsheet.`);
            if (userChoice) {
                window.open(result.url, '_blank');
            }
        } else {
            alert("Gagal memproses di server: " + result.message);
        }

    } catch (error) {
        console.error(error);
        alert("Terjadi kesalahan jaringan atau izin akses Apps Script: " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
