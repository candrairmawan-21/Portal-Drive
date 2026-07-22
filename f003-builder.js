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
    const container = document.getElementById('f003-container');
    const cardId = 'card-item-' + f003RowCount;
    
    const cardDiv = document.createElement('div');
    cardDiv.id = cardId;
    cardDiv.className = "bg-slate-50/90 border border-slate-200 rounded-xl p-3.5 shadow-sm transition-all hover:border-amber-400";
    
    cardDiv.innerHTML = `
        <!-- HEADER CARD -->
        <div class="flex justify-between items-center mb-3 pb-2 border-b border-slate-200">
            <span class="bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded row-number">Item #${f003RowCount}</span>
            <button type="button" onclick="removeF003Card('${cardId}')" class="text-rose-500 hover:bg-rose-50 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 transition-colors">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Hapus Item
            </button>
        </div>

        <!-- GRID UTAMA (KECIL, PADAT, PAS DI MOBILE) -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5">
            <div>
                <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Barcode / SKU</label>
                <input type="text" id="barcode-${f003RowCount}" autocomplete="off" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:outline-none focus:border-amber-500 shadow-inner" placeholder="Scan Barcode...">
            </div>

            <div>
                <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Qty</label>
                <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 text-center focus:outline-none focus:border-amber-500 shadow-inner">
            </div>

            <div>
                <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Category</label>
                <select id="kategori-${f003RowCount}" onchange="handleCategoryChange(${f003RowCount})" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-inner">
                    <option value="">-- Pilih Kategori --</option>
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

            <div>
                <label class="block text-[10px] font-bold uppercase text-slate-500 mb-1">Reason (Alasan)</label>
                <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500 shadow-inner">
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

        <!-- KOLOM DINAMIS H s.d O (MUNCUL OTOMATIS & RAPI) -->
        <div id="dynamic-fields-${f003RowCount}" class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-2.5"></div>

        <!-- FOTO BUKTI -->
        <div class="flex items-center gap-2 pt-2 border-t border-slate-200">
            <label class="cursor-pointer bg-white hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-300 shadow-sm flex items-center gap-1.5">
                <i data-lucide="camera" class="w-4 h-4 text-amber-600"></i> Upload Foto Bukti
                <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
            </label>
            <span id="preview-text-${f003RowCount}" class="text-[11px] text-slate-400 italic">Belum ada foto</span>
            <img id="preview-${f003RowCount}" src="" class="hidden w-9 h-9 rounded-lg object-cover border-2 border-amber-500 shadow cursor-pointer" onclick="window.open(this.src)">
        </div>
    `;
    
    container.appendChild(cardDiv);
    setupBarcodeScannerListener(f003RowCount);
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => {
        const barcodeInput = document.getElementById(`barcode-${f003RowCount}`);
        if(barcodeInput) barcodeInput.focus();
    }, 100);
}

function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const container = document.getElementById(`dynamic-fields-${rowNum}`);
    
    let html = '';
    
    if (kategori === 'DDR') {
        html += `
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Invoice No. (Col H)</label>
                <input type="text" id="invoice-no-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="No. Invoice">
            </div>
        `;
    }
    else if (kategori === 'DMC' || kategori === 'DMW') {
        html += `
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">CTM Receipt (Col H)</label>
                <input type="text" id="ctm-receipt-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="CTM Receipt">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">New Date (Col I)</label>
                <input type="text" id="new-receipt-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
            </div>
        `;
        
        if (kategori === 'DMW') {
            html += `
                <div>
                    <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Serial No. (Col K)</label>
                    <input type="text" id="serial-number-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Serial No.">
                </div>
            `;
        }
        
        html += `
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Old Date (Col L)</label>
                <input type="text" id="old-receipt-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Old Receipt No (Col M)</label>
                <input type="text" id="old-receipt-no-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Old Receipt">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Customer Name (Col N)</label>
                <input type="text" id="cust-name-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="Nama Customer">
            </div>
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Customer Phone (Col O)</label>
                <input type="text" id="cust-phone-${rowNum}" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500" placeholder="No. Telp">
            </div>
        `;
    }
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        html += `
            <div>
                <label class="block text-[10px] font-bold uppercase text-amber-700 mb-1">Expiry Date (Col J)</label>
                <input type="text" id="expiry-date-${rowNum}" placeholder="DD/MM/YYYY" class="w-full px-2.5 py-1.5 bg-amber-50 border border-amber-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:border-amber-500">
            </div>
        `;
    }
    
    container.innerHTML = html;
}

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

function removeF003Card(cardId) {
    const container = document.getElementById('f003-container');
    if (container.children.length <= 1) {
        resetF003Table();
        return;
    }
    const card = document.getElementById(cardId);
    if(card) { card.remove(); recalculateRowNumbers(); }
}

function recalculateRowNumbers() {
    const cards = document.querySelectorAll('#f003-container > div');
    cards.forEach((card, index) => {
        const newNum = index + 1;
        const numCell = card.querySelector('.row-number');
        if (numCell) numCell.textContent = `Item #${newNum}`;
    });
}

function resetF003Table() {
    if (confirm("Reset semua baris?")) {
        const container = document.getElementById('f003-container');
        container.innerHTML = "";
        f003RowCount = 0;
        addF003Row();
    }
}

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
                
                const safeBase64 = canvas.toDataURL('image/jpeg', 0.6);
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

async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) {
        alert("Mohon isi Store Code dan Store Name!");
        return;
    }

    const cards = document.querySelectorAll('#f003-container > div');
    if (cards.length === 0) {
        alert("Belum ada baris barang!");
        return;
    }

    const btnGenerate = document.querySelector('button[onclick="generateF003Excel()"]');
    const originalText = btnGenerate.innerHTML;
    btnGenerate.disabled = true;
    btnGenerate.classList.add('opacity-90', 'cursor-not-allowed');
    
    let step = 0;
    const loadingMessages = ["Memproses data...", "Menyiapkan template...", "Memasukkan foto in-cell...", "Finalisasi..."];
    btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> ${loadingMessages[0]}`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const intervalAnimasi = setInterval(() => {
        step = (step + 1) % loadingMessages.length;
        btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> ${loadingMessages[step]}`;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }, 1000);

    const scriptUrl = "https://script.google.com/macros/s/AKfycbyGg_4yU44ZetFlNCbsA2vpNaTHZITLd1od7XX_0R2_Cg34py9qMbN0OFX-BwFdDftVDA/exec";

    try {
        let items = [];
        cards.forEach((card, index) => {
            const rowNumIndex = index + 1;
            items.push({
                no: rowNumIndex,
                barcode: card.querySelector('input[id^="barcode-"]')?.value || "",
                qty: card.querySelector('input[id^="qty-"]')?.value || "0",
                kategori: card.querySelector('select[id^="kategori-"]')?.value || "",
                alasan: card.querySelector('select[id^="alasan-"]')?.value || "",
                invoiceNo: card.querySelector('input[id^="invoice-no-"]')?.value || "",
                ctmReceipt: card.querySelector('input[id^="ctm-receipt-"]')?.value || "",
                newReceiptDate: card.querySelector('input[id^="new-receipt-date-"]')?.value || "",
                expiryDate: card.querySelector('input[id^="expiry-date-"]')?.value || "",
                serialNumber: card.querySelector('input[id^="serial-number-"]')?.value || "",
                oldReceiptDate: card.querySelector('input[id^="old-receipt-date-"]')?.value || "",
                oldReceiptNo: card.querySelector('input[id^="old-receipt-no-"]')?.value || "",
                custName: card.querySelector('input[id^="cust-name-"]')?.value || "",
                custPhone: card.querySelector('input[id^="cust-phone-"]')?.value || "",
                photoBase64: card.querySelector('img[id^="preview-"]')?.getAttribute('data-base64') || ""
            });
        });

        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ storeCode, storeName, sendDate, items })
        });

        const result = await response.json();
        clearInterval(intervalAnimasi);

        if (result.status === "success") {
            if (confirm(`SUKSES!\nFile berhasil dibuat.\nKlik OK untuk membuka Spreadsheet.`)) {
                window.open(result.url, '_blank');
            }
        } else {
            alert("Gagal: " + result.message);
        }
    } catch (error) {
        clearInterval(intervalAnimasi);
        alert("Kesalahan jaringan: " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        btnGenerate.classList.remove('opacity-90', 'cursor-not-allowed');
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
