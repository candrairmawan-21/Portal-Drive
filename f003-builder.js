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
    tr.className = "hover:bg-amber-50/30 transition-colors border-b border-slate-100";
    
    tr.innerHTML = `
        <td class="px-4 py-3 text-center font-bold text-xs text-slate-400">${f003RowCount}</td>
        <td class="px-4 py-3">
            <input type="text" id="barcode-${f003RowCount}" onkeydown="handleBarcodeScan(event, ${f003RowCount})" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all shadow-inner text-amber-900" placeholder="Scan Barcode..." autofocus>
        </td>
        <td class="px-4 py-3">
            <input type="number" id="qty-${f003RowCount}" min="1" value="1" onkeydown="handleEnterOnQty(event, ${f003RowCount})" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-center focus:outline-none focus:border-amber-500">
        </td>
        <td class="px-4 py-3">
            <select id="kategori-${f003RowCount}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-amber-500">
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
        </td>
        <td class="px-4 py-3">
            <input type="text" id="alasan-${f003RowCount}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-semibold text-slate-700 focus:outline-none focus:border-amber-500" placeholder="Ketik alasan...">
        </td>
        <td class="px-4 py-3 text-center">
            <div class="relative flex items-center justify-center gap-2">
                <label class="cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-slate-200 shadow-sm flex items-center">
                    <i data-lucide="camera" class="w-3.5 h-3.5 mr-1.5"></i> Foto
                    <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
                </label>
                <img id="preview-${f003RowCount}" src="" class="hidden w-9 h-9 rounded object-cover border border-slate-200 shadow-sm cursor-pointer" onclick="window.open(this.src)">
            </div>
        </td>
        <td class="px-4 py-3 text-center">
            <button onclick="removeF003Row('${rowId}')" class="p-1.5 bg-rose-50 text-rose-500 hover:bg-rose-500 hover:text-white rounded-lg transition-colors">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </td>
    `;
    
    tbody.appendChild(tr);
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    setTimeout(() => {
        const barcodeInput = document.getElementById(`barcode-${f003RowCount}`);
        if(barcodeInput) barcodeInput.focus();
    }, 100);
}

function handleBarcodeScan(event, rowNum) {
    // Menangkap sinyal Enter atau Tab dari laser scanner PDT
    if (event.key === 'Enter' || event.keyCode === 13 || event.keyCode === 10 || event.key === 'Tab') {
        event.preventDefault(); // Mencegah form submit/reload halaman secara tidak sengaja
        
        const barcodeInput = document.getElementById(`barcode-${rowNum}`);
        
        // Pastikan input barcode tidak kosong sebelum pindah
        if (barcodeInput && barcodeInput.value.trim() !== "") {
            const qtyField = document.getElementById(`qty-${rowNum}`);
            if (qtyField) {
                qtyField.focus(); // Pindahkan kursor ke kolom Qty
                qtyField.select(); // Blok angka '1' bawaan agar mudah langsung diketik jumlah barunya
            }
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

function removeF003Row(rowId) {
    const row = document.getElementById(rowId);
    if(row) row.remove();
}

// Konversi foto agar aman dikirim ke Spreadsheet
function previewPhoto(input, rowId) {
    const previewImg = document.getElementById(`preview-${rowId}`);
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 600; // Kompresi ringan agar pengiriman data cepat
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
// KIRIM DATA KE GOOGLE SPREADSHEET (MULTI-USER & AUTO-COPY)
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
        const rowNum = index + 1;
        const barcode = document.getElementById(`barcode-${rowNum}`)?.value || "";
        const qty = document.getElementById(`qty-${rowNum}`)?.value || "0";
        const kategori = document.getElementById(`kategori-${rowNum}`)?.value || "";
        const alasan = document.getElementById(`alasan-${rowNum}`)?.value || "";
        
        const previewImg = document.getElementById(`preview-${rowNum}`);
        let photoBase64 = "";
        if (previewImg && !previewImg.classList.contains('hidden')) {
            photoBase64 = previewImg.getAttribute('data-base64') || "";
        }

        items.push({
            no: rowNum,
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
        // Menggunakan mode cors standar untuk menangkap link balasan spreadsheet baru
        const response = await fetch(scriptUrl, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8" // Trik aman CORS untuk Google Apps Script
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (result.status === "success") {
            // Tampilkan pop-up interaktif berisi link file spreadsheet khusus toko tersebut
            const userChoice = confirm(`BERHASIL!\n\nFile Spreadsheet khusus toko ${storeCode} telah dibuat dan foto berhasil disematkan.\n\nKlik OK untuk langsung membuka Google Spreadsheet.`);
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
