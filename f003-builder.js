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
    
    // Auto-focus ke input barcode saat baris baru dibuat
    setTimeout(() => {
        const barcodeInput = document.getElementById(`barcode-${f003RowCount}`);
        if(barcodeInput) barcodeInput.focus();
    }, 100);
}

// MESIN PENANGKAP SCANNER PDT SUPER RESPONSIVE
function handleBarcodeScan(event, rowNum) {
    // Menangkap sinyal Enter (13), Tab (9), atau Line Feed (10) dari PDT
    if (event.key === 'Enter' || event.keyCode === 13 || event.keyCode === 10 || event.key === 'Tab') {
        event.preventDefault(); // Jangan biarkan browser me-refresh halaman!
        
        const qtyField = document.getElementById(`qty-${rowNum}`);
        if (qtyField) {
            qtyField.focus(); // Pindahkan kursor ke QTY
            qtyField.select(); // Langsung blok angka '1' agar mudah diganti jika lebih dari 1
        }
    }
}

// Pindah dari QTY ke Kategori jika ditekan Enter
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

function previewPhoto(input, rowId) {
    const previewImg = document.getElementById(`preview-${rowId}`);
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            previewImg.src = e.target.result;
            previewImg.classList.remove('hidden');
            previewImg.setAttribute('data-base64', e.target.result);
        }
        reader.readAsDataURL(file);
    }
}

// MESIN EXCEL (Menggunakan Template yang Diupload User)
async function generateF003Excel() {
    const templateInput = document.getElementById('f003-template-file');
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!templateInput.files || templateInput.files.length === 0) {
        alert("Wajib: Pilih file 'F003 STORE DAMAGE FILE (Indonesia).xlsx' di kotak template paling kiri atas!");
        return;
    }
    if (!storeCode || !storeName) {
        alert("Mohon isi Store Code dan Store Name terlebih dahulu!");
        return;
    }

    const rows = document.querySelectorAll('#f003-tbody tr');
    if (rows.length === 0) {
        alert("Belum ada baris barang yang ditambahkan!");
        return;
    }

    try {
        // 1. Baca file template asli dari inputan user
        const templateFile = templateInput.files[0];
        const arrayBuffer = await templateFile.arrayBuffer();

        // 2. Load template ke ExcelJS
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        // 3. Akses Sheet yang tepat
        const wsQm = workbook.getWorksheet('QM Report (Template)');
        const wsBefore = workbook.getWorksheet('BEFORE');

        if (!wsQm || !wsBefore) {
            alert("Error: File template salah! Pastikan file Excel Anda memiliki sheet bernama 'QM Report (Template)' dan 'BEFORE'.");
            return;
        }

        // 4. Masukkan Data Header ke QM Report
        wsQm.getCell('C1').value = storeCode;
        wsQm.getCell('C2').value = storeName;
        wsQm.getCell('C3').value = sendDate;

        // 5. Looping Data Tabel dan Masukkan ke Sheet
        let qmStartRow = 8; 
        let beforeStartRow = 2;

        rows.forEach((tr, index) => {
            const rowNum = index + 1;
            const barcode = document.getElementById(`barcode-${rowNum}`)?.value || "";
            const qty = document.getElementById(`qty-${rowNum}`)?.value || "0";
            const kategori = document.getElementById(`kategori-${rowNum}`)?.value || "";
            const alasan = document.getElementById(`alasan-${rowNum}`)?.value || "";

            // --- ISI KE QM REPORT ---
            const qmRow = qmStartRow + index;
            wsQm.getCell(`B${qmRow}`).value = rowNum;
            wsQm.getCell(`C${qmRow}`).value = barcode;
            wsQm.getCell(`D${qmRow}`).value = Number(qty);
            wsQm.getCell(`E${qmRow}`).value = kategori;
            wsQm.getCell(`F${qmRow}`).value = alasan;

            // --- ISI KE SHEET BEFORE & INJECT FOTO ---
            const beforeRow = beforeStartRow + index;
            wsBefore.getCell(`A${beforeRow}`).value = rowNum;
            wsBefore.getCell(`B${beforeRow}`).value = barcode;
            wsBefore.getCell(`C${beforeRow}`).value = Number(qty);
            wsBefore.getCell(`D${beforeRow}`).value = alasan;

            // Proses Inject Foto
            const previewImg = document.getElementById(`preview-${rowNum}`);
            if (previewImg && !previewImg.classList.contains('hidden')) {
                const base64Data = previewImg.getAttribute('data-base64');
                if (base64Data) {
                    const base64String = base64Data.split(',')[1];
                    const formatData = base64Data.substring("data:image/".length, base64Data.indexOf(";base64"));
                    const extension = formatData === 'jpeg' ? 'jpeg' : 'png';

                    const imageId = workbook.addImage({
                        base64: base64String,
                        extension: extension,
                    });

                    // Tempelkan foto di cell kolom BEFORE (Kolom E)
                    wsBefore.addImage(imageId, {
                        tl: { col: 4, row: beforeRow - 1 }, // col 4 = Kolom E
                        extents: { width: 140, height: 140 }
                    });

                    wsBefore.getRow(beforeRow).height = 110; // Perlebar baris agar foto muat
                }
            }
        });

        // 6. Generate dan Download
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        saveAs(blob, `F003_Damage_${storeCode}_${sendDate}.xlsx`);
        
    } catch (error) {
        console.error(error);
        alert("Gagal meracik Excel. Pastikan file template tidak corrupt/rusak. Detail Error: " + error.message);
    }
}
