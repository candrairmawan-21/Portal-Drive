let f003RowCount = 0;

window.addEventListener('DOMContentLoaded', () => {
    initF003Builder();
});

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(initF003Builder, 50);
}

function initF003Builder() {
    try {
        const dateInput = document.getElementById('f003-date');
        if(dateInput && !dateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.value = today;
        }
        
        const storeCodeInput = document.getElementById('f003-store-code');
        if (storeCodeInput && !storeCodeInput.hasAttribute('data-initialized')) {
            storeCodeInput.setAttribute('data-initialized', 'true');
            storeCodeInput.addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });
        }
        
        const storeNameInput = document.getElementById('f003-store-name');
        if (storeNameInput && !storeNameInput.hasAttribute('data-initialized')) {
            storeNameInput.setAttribute('data-initialized', 'true');
            storeNameInput.addEventListener('input', function() {
                this.value = this.value.toUpperCase();
            });
        }
        
        // 1. Inject tombol folder (muncul untuk semua role termasuk guest)
        injectFolderButton();

        // 2. Pastikan baris tabel ter-render dengan aman
        ensureTableStructure();
        
        const tbody = document.getElementById('f003-tbody');
        if (tbody && tbody.children.length === 0) {
            f003RowCount = 0;
            addF003Row();
        }
    } catch (err) {
        console.error("Initialization Error:", err);
        try { if(document.getElementById('f003-tbody')?.children.length === 0) addF003Row(); } catch(e) {}
    }
}

function injectFolderButton() {
    if (document.getElementById('f003-folder-btn')) return;
    
    const headings = document.querySelectorAll('h2, h3, .font-bold, div');
    let targetElement = null;
    
    for (let el of headings) {
        if (el.textContent && el.textContent.trim() === 'Form Pengajuan Damage Items') {
            targetElement = el;
            break;
        }
    }
    
    if (!targetElement) return;

    const btnContainer = document.createElement('div');
    btnContainer.className = "mb-4 flex justify-end";
    btnContainer.innerHTML = `
        <a id="f003-folder-btn" href="https://drive.google.com/drive/folders/1EICp9CwKRLeVEieO-DOvi-FWLuFfcslU" target="_blank" 
           style="background-color: #d97706; color: white;" class="inline-flex items-center gap-2 hover:bg-amber-700 text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-colors">
            <i data-lucide="folder-open" class="w-4 h-4"></i> Klik disini untuk lihat folder nya
        </a>
    `;
    
    targetElement.parentNode.insertBefore(btnContainer, targetElement);
    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function ensureTableStructure() {
    let tbody = document.getElementById('f003-tbody');
    if (!tbody) {
        const table = document.querySelector('table');
        if (table) {
            tbody = document.createElement('tbody');
            tbody.id = 'f003-tbody';
            table.appendChild(tbody);
        }
    }
}

function addF003Row() {
    let tbody = document.getElementById('f003-tbody');
    if(!tbody) {
        ensureTableStructure();
        tbody = document.getElementById('f003-tbody');
        if(!tbody) return;
    }
    
    f003RowCount++;
    const mainRowId = 'row-main-' + f003RowCount;
    const dynRowId = 'row-dyn-' + f003RowCount;
    
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
                <option value="DMO">DMO</option><option value="DDR">DDR</option><option value="DMC">DMC</option>
                <option value="DMP">DMP</option><option value="DPI">DPI</option><option value="2DMP">2DMP</option>
                <option value="DMW">DMW</option><option value="DMQ">DMQ</option><option value="DMN">DMN</option>
                <option value="SCB">SCB</option><option value="DME">DME</option>
            </select>
        </td>
        <td class="p-2 align-middle w-44">
            <select id="alasan-${f003RowCount}" onkeydown="finishRow(event, ${f003RowCount})" class="w-full px-2 py-1 text-xs font-semibold border border-slate-300 rounded focus:border-amber-500 outline-none cursor-pointer">
                <option value="">-- Alasan Rusak --</option>
                <option value="PECAH">PECAH</option><option value="PATAH">PATAH</option><option value="SOBEK">SOBEK</option>
                <option value="KEMASAN RUSAK">KEMASAN RUSAK</option><option value="BOCOR">BOCOR</option>
                <option value="KOTOR">KOTOR</option><option value="TIDAK BERFUNGSI">TIDAK BERFUNGSI</option>
                <option value="PART TIDAK LENGKAP">PART TIDAK LENGKAP</option><option value="DIMAKAN TIKUS">DIMAKAN TIKUS</option>
                <option value="EXPIRED">EXPIRED</option><option value="H-35 EXPIRED">H-35 EXPIRED</option>
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
            <button type="button" onclick="removeF003Row(${f003RowCount})" class="text-rose-500 hover:bg-rose-50 p-1.5 rounded transition-colors inline-block">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
    
    const trDyn = document.createElement('tr');
    trDyn.id = dynRowId;
    trDyn.className = "hidden bg-amber-50/20 border-b border-slate-200"; 
    const inputClass = "hidden w-40 px-3 py-1.5 text-xs font-semibold border border-amber-300 bg-white rounded outline-none focus:border-amber-500 shadow-sm";
    
    trDyn.innerHTML = `
        <td colspan="7" class="p-3">
            <div class="flex flex-wrap gap-2 items-center w-full" onkeydown="handleSubRowKeydown(event, ${f003RowCount})">
                <input type="text" id="invoice-no-${f003RowCount}" class="${inputClass}" placeholder="Invoice No.">
                <input type="text" id="ctm-receipt-${f003RowCount}" class="${inputClass}" placeholder="CTM Receipt">
                <input type="text" id="new-receipt-date-${f003RowCount}" class="${inputClass}" placeholder="New Date (DD/MM)">
                <input type="text" id="serial-number-${f003RowCount}" class="${inputClass}" placeholder="Serial Number">
                <input type="text" id="old-receipt-date-${f003RowCount}" class="${inputClass}" placeholder="Old Date (DD/MM)">
                <input type="text" id="old-receipt-no-${f003RowCount}" class="${inputClass}" placeholder="Old Receipt No">
                <input type="text" id="cust-name-${f003RowCount}" class="${inputClass}" placeholder="Customer Name">
                <input type="text" id="cust-phone-${f003RowCount}" class="${inputClass}" placeholder="Customer Phone">
                <input type="text" id="expiry-date-${f003RowCount}" class="${inputClass}" placeholder="Expiry Date">
            </div>
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

function handleCategoryChange(rowNum) {
    const kategori = document.getElementById(`kategori-${rowNum}`).value;
    const dynRow = document.getElementById(`row-dyn-${rowNum}`);
    
    const allIds = ['invoice-no', 'ctm-receipt', 'new-receipt-date', 'serial-number', 'old-receipt-date', 'old-receipt-no', 'cust-name', 'cust-phone', 'expiry-date'];
    allIds.forEach(id => {
        const el = document.getElementById(`${id}-${rowNum}`);
        if(el) { el.classList.add('hidden'); el.value = ''; }
    });
    
    let showRow = false;

    if (kategori === 'DDR') {
        document.getElementById(`invoice-no-${rowNum}`).classList.remove('hidden');
        showRow = true;
    } 
    else if (kategori === 'DMC' || kategori === 'DMW') {
        ['ctm-receipt', 'new-receipt-date', 'old-receipt-date', 'old-receipt-no', 'cust-name', 'cust-phone'].forEach(id => {
            document.getElementById(`${id}-${rowNum}`).classList.remove('hidden');
        });
        if (kategori === 'DMW') { 
            document.getElementById(`serial-number-${rowNum}`).classList.remove('hidden'); 
        }
        showRow = true;
    } 
    else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
        document.getElementById(`expiry-date-${rowNum}`).classList.remove('hidden');
        showRow = true;
    }
    
    if (showRow) dynRow.classList.remove('hidden');
    else dynRow.classList.add('hidden');
}

function setupBarcodeScannerListener(rowNum) {
    const barcodeInput = document.getElementById(`barcode-${rowNum}`);
    if (!barcodeInput) return;

    let keystrokeTimes = [];

    barcodeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === "Tab" || e.keyCode === 13 || e.keyCode === 9) {
            e.preventDefault();
            moveToQty(rowNum);
        }
    });

    barcodeInput.addEventListener("input", function (e) {
        const now = new Date().getTime();
        keystrokeTimes.push(now);
        if (keystrokeTimes.length > 6) {
            keystrokeTimes.shift();
        }

        if (keystrokeTimes.length >= 4) {
            let intervals = [];
            for (let i = 1; i < keystrokeTimes.length; i++) {
                intervals.push(keystrokeTimes[i] - keystrokeTimes[i-1]);
            }
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;

            if (avgInterval < 35 && barcodeInput.value.trim().length >= 5) {
                clearTimeout(barcodeInput._scanTimer);
                barcodeInput._scanTimer = setTimeout(() => {
                    moveToQty(rowNum);
                }, 80);
            }
        }
    });
}

function moveToQty(rowNum) {
    const barcodeInput = document.getElementById(`barcode-${rowNum}`);
    if (barcodeInput && barcodeInput.value.trim() !== "") {
        const qty = document.getElementById(`qty-${rowNum}`);
        if (qty) {
            qty.focus();
            qty.select();
        }
    }
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
        event.preventDefault();
        addF003Row();
    }
}

function handleSubRowKeydown(event, rowNum) {
    if (event.key === 'Enter' || e.keyCode === 13) {
        event.preventDefault();
    }
}

function removeF003Row(rowNum) {
    const tbody = document.getElementById('f003-tbody');
    if (!tbody) return;
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
        const tbody = document.getElementById('f003-tbody');
        if(tbody) tbody.innerHTML = "";
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
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
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

async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim().toUpperCase();
    const storeName = document.getElementById('f003-store-name').value.trim().toUpperCase();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) { alert("Isi Store Code & Store Name!"); return; }
    
    let items = [];
    let index = 1;
    
    // --- VALIDASI MANDATORY FIELD BERDASARKAN KATEGORI ---
    for (let i = 1; i <= f003RowCount; i++) {
        const trMain = document.getElementById(`row-main-${i}`);
        if (!trMain) continue; 
        
        const barcode = document.getElementById(`barcode-${i}`)?.value.trim() || "";
        const kategori = document.getElementById(`kategori-${i}`)?.value || "";
        const alasan = document.getElementById(`alasan-${i}`)?.value || "";

        // Pastikan baris yang terisi minimal barcode/kategori divalidasi
        if (!barcode && !kategori && !alasan) continue; 

        if (!barcode) {
            alert(`Baris #${index}: Barcode / SKU belum diisi!`);
            document.getElementById(`barcode-${i}`)?.focus();
            return;
        }
        if (!kategori) {
            alert(`Baris #${index}: Kategori belum dipilih!`);
            document.getElementById(`kategori-${i}`)?.focus();
            return;
        }
        if (!alasan) {
            alert(`Baris #${index}: Alasan rusak belum dipilih!`);
            document.getElementById(`alasan-${i}`)?.focus();
            return;
        }

        // Cek Mandatory Field untuk Kolom Dinamis Berdasarkan Kategori
        if (kategori === 'DDR') {
            const invoiceNo = document.getElementById(`invoice-no-${i}`)?.value.trim() || "";
            if (!invoiceNo) {
                alert(`Baris #${index} (Kategori DDR): Kolom "Invoice No." wajib diisi!`);
                document.getElementById(`invoice-no-${i}`)?.focus();
                return;
            }
        } 
        else if (kategori === 'DMC' || kategori === 'DMW') {
            const ctmReceipt = document.getElementById(`ctm-receipt-${i}`)?.value.trim() || "";
            const newDate = document.getElementById(`new-receipt-date-${i}`)?.value.trim() || "";
            const oldDate = document.getElementById(`old-receipt-date-${i}`)?.value.trim() || "";
            const oldNo = document.getElementById(`old-receipt-no-${i}`)?.value.trim() || "";
            const custName = document.getElementById(`cust-name-${i}`)?.value.trim() || "";
            const custPhone = document.getElementById(`cust-phone-${i}`)?.value.trim() || "";

            if (!ctmReceipt || !newDate || !oldDate || !oldNo || !custName || !custPhone) {
                alert(`Baris #${index} (Kategori ${kategori}): Semua kolom tambahan (CTM Receipt, Tanggal, No Nota Lama, Nama & No HP Customer) wajib diisi lengkap!`);
                // Fokus ke elemen pertama yang kosong di sub-row
                if (!ctmReceipt) document.getElementById(`ctm-receipt-${i}`).focus();
                else if (!newDate) document.getElementById(`new-receipt-date-${i}`).focus();
                else if (!oldDate) document.getElementById(`old-receipt-date-${i}`).focus();
                else if (!oldNo) document.getElementById(`old-receipt-no-${i}`).focus();
                else if (!custName) document.getElementById(`cust-name-${i}`).focus();
                else if (!custPhone) document.getElementById(`cust-phone-${i}`).focus();
                return;
            }

            if (kategori === 'DMW') {
                const serialNum = document.getElementById(`serial-number-${i}`)?.value.trim() || "";
                if (!serialNum) {
                    alert(`Baris #${index} (Kategori DMW): Kolom "Serial Number" wajib diisi!`);
                    document.getElementById(`serial-number-${i}`)?.focus();
                    return;
                }
            }
        } 
        else if (kategori === 'DMP' || kategori === 'DPI' || kategori === '2DMP') {
            const expiryDate = document.getElementById(`expiry-date-${i}`)?.value.trim() || "";
            if (!expiryDate) {
                alert(`Baris #${index} (Kategori ${kategori}): Kolom "Expiry Date" wajib diisi!`);
                document.getElementById(`expiry-date-${i}`)?.focus();
                return;
            }
        }

        items.push({
            no: index++,
            barcode: barcode,
            qty: document.getElementById(`qty-${i}`)?.value || "1",
            kategori: kategori,
            alasan: alasan,
            invoiceNo: document.getElementById(`invoice-no-${i}`)?.value || "",
            ctmReceipt: document.getElementById(`ctm-receipt-${i}`)?.value || "",
            newReceiptDate: document.getElementById(`new-receipt-date-${i}`)?.value || "",
            expiryDate: document.getElementById(`expiry-date-${i}`)?.value || "",
            serialNumber: document.getElementById(`serial-number-${i}`)?.value || "",
            oldReceiptDate: document.getElementById(`old-receipt-date-${i}`)?.value || "",
            oldReceiptNo: document.getElementById(`old-receipt-no-${i}`)?.value || "",
            custName: document.getElementById(`cust-name-${i}`)?.value || "",
            custPhone: document.getElementById(`cust-phone-${i}`)?.value || "",
            photoBase64: document.getElementById(`preview-${i}`)?.getAttribute('data-base64') || ""
        });
    }
    
    if (items.length === 0) { alert("Belum ada data barang yang valid untuk diproses!"); return; }

    const btnGenerate = document.querySelector('button[onclick="generateF003Excel()"]');
    const originalText = btnGenerate.innerHTML;
    btnGenerate.disabled = true;
    btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin inline mr-1"></i> Memproses...`;
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const scriptUrl = "https://script.google.com/macros/s/AKfycbyGg_4yU44ZetFlNCbsA2vpNaTHZITLd1od7XX_0R2_Cg34py9qMbN0OFX-BwFdDftVDA/exec";

    try {
        const userRole = sessionStorage.getItem('portalRole') || 'staff';
        const payloadString = JSON.stringify({ storeCode, storeName, sendDate, userRole, items });
        
        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: "data=" + encodeURIComponent(payloadString)
        });

        const result = await response.json();

        if (result.status === "success") {
            const targetUrl = result.url;
            if (targetUrl) {
                window.open(targetUrl, '_blank');
            }
            alert("SUKSES!\nFile berhasil dibuat dan dibuka di tab baru.");
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
