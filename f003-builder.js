let f003RowCount = 0;

// Inisialisasi baris pertama saat halaman dimuat
document.addEventListener("DOMContentLoaded", function () {
    addF003Row();
});

// Fungsi untuk menambah baris baru
function addF003Row() {
    f003RowCount++;
    const tbody = document.getElementById('f003-tbody');
    
    const tr = document.createElement('tr');
    tr.id = `row-${f003RowCount}`;
    tr.className = "border-b border-slate-100 hover:bg-slate-50/50 transition-colors";
    
    tr.innerHTML = `
        <td class="p-3 text-center font-bold text-slate-500 row-number">${f003RowCount}</td>
        <td class="p-3">
            <input type="text" 
                id="barcode-${f003RowCount}"
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" inputmode="none"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner text-amber-900"
                placeholder="Scan Barcode...">
        </td>
        <td class="p-3">
            <input type="number" 
                id="qty-${f003RowCount}"
                value="1" min="1"
                onkeydown="handleEnterOnQty(event, ${f003RowCount})"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all text-center">
        </td>
        <td class="p-3">
            <select id="kategori-${f003RowCount}" 
                onchange="document.getElementById('alasan-${f003RowCount}').focus()"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all">
                <option value="">Pilih Kategori...</option>
                <option value="Expired">Expired</option>
                <option value="Damaged">Damaged (Rusak)</option>
                <option value="Broken">Broken (Pecah)</option>
                <option value="Other">Other (Lainnya)</option>
            </select>
        </td>
        <td class="p-3">
            <input type="text" 
                id="alasan-${f003RowCount}"
                onkeydown="finishRow(event, ${f003RowCount})"
                class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all"
                placeholder="Alasan kerusakan...">
        </td>
        <td class="p-3">
            <div class="flex items-center gap-2">
                <input type="file" id="foto-${f003RowCount}" accept="image/*" class="hidden" onchange="previewF003Image(event, ${f003RowCount})">
                <button type="button" onclick="document.getElementById('foto-${f003RowCount}').click()" 
                    class="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all">
                    <i data-lucide="camera" class="w-4 h-4"></i> Foto
                </button>
                <span id="preview-text-${f003RowCount}" class="text-xs text-slate-400 italic">Belum ada</span>
                <img id="preview-${f003RowCount}" class="hidden w-10 h-10 object-cover rounded-lg border border-slate-200 cursor-pointer shadow-sm" onclick="openImageModal(this.src)">
            </div>
        </td>
        <td class="p-3 text-center">
            <button type="button" onclick="removeF003Row(${f003RowCount})" class="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    
    // Pasang listener scanner untuk baris ini
    setupBarcodeScannerListener(f003RowCount);
    
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
    
    // Fokus otomatis ke input barcode pada baris baru
    setTimeout(() => {
        document.getElementById(`barcode-${f003RowCount}`)?.focus();
    }, 100);
}

// 1. Mekanisme Scanner Handal untuk Android PDT & Manual
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

    // Tangkap input string cepat dari PDT Android
    barcodeInput.addEventListener("input", function () {
        clearTimeout(scanTimer);
        scanTimer = setTimeout(moveNext, 80);
    });

    // Tangkap jika scanner/keyboard mengirim Enter atau Tab
    barcodeInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === "Tab" || e.keyCode === 13 || e.keyCode === 9) {
            e.preventDefault();
            clearTimeout(scanTimer);
            moveNext();
        }
    });
}

// 2. Alur setelah dari Qty
function handleEnterOnQty(event, rowNum) {
    if (event.key === "Enter") {
        event.preventDefault();
        document.getElementById(`kategori-${rowNum}`)?.focus();
    }
}

// 3. Alur setelah dari kolom Alasan (Tekan Enter langsung buat baris baru)
function finishRow(e, rowNum) {
    if (e.key === "Enter") {
        e.preventDefault();
        addF003Row();
    }
}

// 4. Hapus Baris dan Perbarui Nomor Urut (Fix Bug Indeks)
function removeF003Row(rowNum) {
    const row = document.getElementById(`row-${rowNum}`);
    if (row) {
        row.remove();
        recalculateRowNumbers();
    }
}

function recalculateRowNumbers() {
    const rows = document.querySelectorAll('#f003-tbody tr');
    rows.forEach((tr, index) => {
        const newNum = index + 1;
        // Update nomor tampilan baris
        const numCell = tr.querySelector('.row-number');
        if (numCell) numCell.textContent = newNum;
    });
}

// 5. Preview Foto
function previewF003Image(event, rowNum) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const previewImg = document.getElementById(`preview-${rowNum}`);
            const previewText = document.getElementById(`preview-text-${rowNum}`);
            
            previewImg.src = e.target.result;
            previewImg.setAttribute('data-base64', e.target.result);
            previewImg.classList.remove('hidden');
            previewText.classList.add('hidden');
            
            if (typeof lucide !== 'undefined') lucide.createIcons();
        };
        reader.readAsDataURL(file);
    }
}

// 6. Fungsi Kirim Data Utama ke Google Apps Script (Sudah Optimal)
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
    btnGenerate.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Mengirim Data...`;
    btnGenerate.disabled = true;

    let items = [];
    rows.forEach((tr, index) => {
        const rowNumIndex = index + 1;
        // Ambil ID asli berdasarkan elemen yang ada di dalam baris tersebut agar aman walau ada yang dihapus
        const barcodeInput = tr.querySelector('input[id^="barcode-"]');
        const qtyInput = tr.querySelector('input[id^="qty-"]');
        const kategoriSelect = tr.querySelector('select[id^="kategori-"]');
        const alasanInput = tr.querySelector('input[id^="alasan-"]');
        const previewImg = tr.querySelector('img[id^="preview-"]');

        const barcode = barcodeInput ? barcodeInput.value : "";
        const qty = qtyInput ? qtyInput.value : "0";
        const kategori = kategoriSelect ? kategoriSelect.value : "";
        const alasan = alasanInput ? alasanInput.value : "";
        
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
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            const userChoice = confirm(`SUKSES!\n\nFile spreadsheet toko berhasil dibuat.\n\nKlik OK untuk membuka Google Spreadsheet.`);
            if (userChoice) {
                window.open(result.url, '_blank');
            }
        } else {
            alert("Gagal: " + result.message);
        }

    } catch (error) {
        console.error(error);
        alert("Terjadi kesalahan: " + error.message);
    } finally {
        btnGenerate.innerHTML = originalText;
        btnGenerate.disabled = false;
        if (typeof lucide !== 'undefined') lucide.createIcons();
    }
}
