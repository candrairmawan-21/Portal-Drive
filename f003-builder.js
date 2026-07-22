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
    tr.className = "border-b border-slate-200 block md:table-row mb-3 md:mb-0 bg-white md:bg-transparent p-3 md:p-0 rounded-xl shadow-sm md:shadow-none";
    
    tr.innerHTML = `
        <td colspan="7" class="p-2 md:p-3">
            <div class="bg-slate-50 border border-slate-200 rounded-xl p-3 relative transition-all shadow-sm">
                
                <!-- HEADER CARD -->
                <div class="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                    <span class="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded row-number">Item #${f003RowCount}</span>
                    <button type="button" onclick="removeF003Row('${rowId}')" class="text-rose-500 hover:bg-rose-50 p-1 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold">
                        <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus
                    </button>
                </div>

                <!-- GRID UTAMA (DIPADATKAN AGAR TIDAK BOROS RUANG) -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                    
                    <!-- Barcode -->
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Barcode / SKU</label>
                        <input type="text" id="barcode-${f003RowCount}" autocomplete="off" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Scan Barcode...">
                    </div>

                    <!-- Qty -->
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Qty</label>
                        <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-none focus:border-amber-500">
                    </div>

                    <!-- Kategori -->
                    <div>
                        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Category</label>
                        <select id="kategori-${f003RowCount}" onchange="handleCategoryChange(${f003RowCount})" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
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
                    </div>

                    <!-- Alasan -->
                    <div class="col-span-2 md:col-span-1">
                        <label class="block text-[10px] font-bold uppercase text-slate-500 mb-0.5">Reason</label>
                        <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
                            <option value="">-- Pilih Alasan --</option>
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
                </div>

                <!-- KONTainer KOLOM DINAMIS (H s.d O) -->
                <div id="dynamic-fields-${f003RowCount}" class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2"></div>

                <!-- FOTO BUKTI -->
                <div class="flex items-center gap-2 pt-2 border-t border-slate-200">
                    <label class="cursor-pointer bg-white hover:bg-amber-50 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-300 shadow-sm flex items-center gap-1">
                        <i data-lucide="camera" class="w-3.5 h-3.5 text-amber-600"></i> Upload Foto
                        <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
                    </label>
                    <span id="preview-text-${f003RowCount}" class="text-[11px] text-slate-400 italic">Belum ada foto</span>
                    <img id="preview-${f003RowCount}" src="" class="hidden w-9 h-9 rounded object-cover border border-amber-500 shadow cursor-pointer" onclick="window.open(this.src)">
                </div>

            </div>
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

// Handler Perubahan Kategori (Input Ringkas & Terstruktur)
function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const container = document.getElementById(`dynamic-fields-${rowNum}`);
    
    let html = '';
    
    if (kategori === 'DDR') {
        html += `
            <div class="col-span-2 md:col-span-1">
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Invoice No. (Col H)</label>
                <input type="text" id="invoice-no-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="No. Invoice">
            </div>
        `;
    }
    else if (kategori === 'DMC' || kategori === 'DMW') {
        html += `
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">CTM Receipt (Col H)</label>
                <input type="text" id="ctm-receipt-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="CTM Receipt">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">New Date (Col I)</label>
                <input type="text" id="new-receipt-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
            </div>
        `;
        
        if (kategori === 'DMW') {
            html += `
                <div>
                    <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Serial No. (Col K)</label>
                    <input type="text" id="serial-number-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Serial No.">
                </div>
            `;
        }
        
        html += `
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Old Date (Col L)</label>
                <input type="text" id="old-receipt-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Old Receipt No (Col M)</label>
                <input type="text" id="old-receipt-no-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Old Receipt">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Customer Name (Col N)</label>
                <input type="text" id="cust-name-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Nama Customer">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Customer Phone (Col O)</label>
                <input type="text" id="cust-phone-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="No. Telp">
            </div>
        `;
    }
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        html += `
            <div class="col-span-2 md:col-span-1">
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-0.5">Expiry Date (Col J)</label>
                <input type="text" id="expiry-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
            </div>
        `;
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
        if (numCell) numCell.textContent = `Item #${newNum}`;
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

// Preview Foto Stabil & Aman
function previewPhoto(input, rowId) {
    const previewImg = document.getElementById(`preview-${rowId}`);
    const previewText = document.getElementById(`preview-text-${rowId}`);
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
                if(previewText) previewText.classList.add('hidden');
                previewImg.setAttribute('data-base64', safeBase64);
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
}

// ========================================================
// KIRIM DATA KE GOOGLE SPREADSHEET (DENGAN PEMETAAN H s.d O YANG PRESISI)
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
    
    btnGenerate.disabled = true;
    btnGenerate.classList.add('opacity-90', 'cursor-not-allowed', 'scale-95');
    
    let step = 0;
    const loadingMessages = [
        "Memproses data barang...",
        "Menyiapkan template spreadsheet...",
        "Menyematkan foto bukti in-cell...",
        "Finalisasi file toko..."
    ];
    
    btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2"></i> ${loadingMessages[0]}`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const intervalAnimasi = setInterval(() => {
        step = (step + 1) % loadingMessages.length;
        btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin inline mr-2"></i> ${loadingMessages[step]}`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 1200);

    const scriptUrl = "https://script.google.com/macros/s/AKfycbyGg_4yU44ZetFlNCbsA2vpNaTHZITLd1od7XX_0R2_Cg34py9qMbN0OFX-BwFdDftVDA/exec";

    try {
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

            // Pengambilan nilai kolom dinamis H s.d O secara presisi
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

        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        clearInterval(intervalAnimasi);

        if (result.status === "success") {
            const userChoice = confirm(`BERHASIL!\n\nFile Spreadsheet khusus toko ${storeCode} telah dibuat lengkap dengan foto in-cell dan kolom dinamisnya.\n\nKlik OK untuk langsung membuka Google Spreadsheet.`);
            if (userChoice) {
                window.open(result.url, '_blank');
            }
        } else {
            alert("Gagal memproses di server: " + result.message);
        }

    } catch (error) {
        clearInterval(intervalAnimasi);
        console.error(error);
        alert("Terjadi kesalahan jaringan atau izin akses Apps Script: " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        btnGenerate.classList.remove('opacity-90', 'cursor-not-allowed', 'scale-95');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
