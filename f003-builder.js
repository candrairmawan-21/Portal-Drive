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
            <input type="text" id="barcode-${f003RowCount}" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 focus:outline-none focus:border-amber-500 focus:bg-white transition-all" placeholder="Scan Barcode..." autofocus>
        </td>
        <td class="px-4 py-3">
            <input type="number" id="qty-${f003RowCount}" min="1" value="1" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-700 text-center focus:outline-none focus:border-amber-500">
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

// ==========================================
// MESIN PEMBUAT EXCEL OTOMATIS
// ==========================================
async function generateF003Excel() {
    const storeCode = document.getElementById('f003-store-code').value.trim();
    const storeName = document.getElementById('f003-store-name').value.trim();
    const sendDate = document.getElementById('f003-date').value;

    if (!storeCode || !storeName) {
        alert("Mohon isi Store Code dan Store Name terlebih dahulu!");
        return;
    }

    // Ambil data dari semua baris tabel
    const rows = document.querySelectorAll('#f003-tbody tr');
    if (rows.length === 0) {
        alert("Belum ada baris barang yang ditambahkan!");
        return;
    }

    // Siapkan struktur Sheet 'QM Report (Template)'
    let qmData = [
        ["", "STORE CODE :", "", "", "", "F003 STORE DAMAGE FILE", "", "", "", "", "DIBUAT", "", "MENGETAHUI", "", "MENYETUJUI", ""],
        ["", "STORE NAME :", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "DATE SEND DM FILE:", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["", "", "", "", "", "", "", "DDR / DMC / DMW / DME", "DMC & DMW DETAILS", "DMP / DPI / 2DMP DETAILS", "DMW DETAILS", "DMC & DMW USE - CUSTOMER DETAILS", "", "", "", "FOR QM USE"],
        ["", "NO.", "BARCODE", "DAMAGE QUANTITY", "CATEGORY", "REASON DAMAGE", "OTHER REASON", "DDR/DMC/DMW/DME NUMBER", "NEW RECEIPT DATE", "EXPIRY DATE", "SERIAL NUMBER", "OLD RECEIPT DATE", "OLD RECEIPT NUMBER", "CUSTOMER NAME", "CUSTOMER PHONE", "FEEDBACK"]
    ];

    // Masukkan data Header Store
    qmData[0][2] = storeCode;
    qmData[1][2] = storeName;
    qmData[2][2] = sendDate;

    // Siapkan struktur Sheet 'BEFORE' untuk rekap foto
    let beforeData = [
        ["No", "BARCODE", "QTY", "REASON DAMAGE", "BEFORE", "AFTER", "", "", "", "EXP PHOTOS :"],
    ];

    // Loop setiap baris tabel di web
    rows.forEach((tr, index) => {
        const rowNum = index + 1;
        const barcode = document.getElementById(`barcode-${rowNum}`)?.value || "";
        const qty = document.getElementById(`qty-${rowNum}`)?.value || "0";
        const kategori = document.getElementById(`kategori-${rowNum}`)?.value || "";
        const alasan = document.getElementById(`alasan-${rowNum}`)?.value || "";
        
        // Cek apakah ada foto yang di-upload di baris ini
        const previewImg = document.getElementById(`preview-${rowNum}`);
        let hasPhoto = previewImg && !previewImg.classList.contains('hidden');

        // Masukkan ke QM Report
        qmData.push([
            "", rowNum, barcode, qty, kategori, alasan, "", "", "", "", "", "", "", "", "", ""
        ]);

        // Masukkan ke Sheet Before
        beforeData.push([
            rowNum, barcode, qty, alasan, hasPhoto ? "[ADA FOTO]" : "", "", "", "", "", ""
        ]);
    });

    // Buat Workbook Excel baru menggunakan SheetJS
    const wb = XLSX.utils.book_new();

    // Buat Sheet QM Report
    const wsQm = XLSX.utils.aoa_to_sheet(qmData);
    XLSX.utils.book_append_sheet(wb, wsQm, "QM Report (Template)");

    // Buat Sheet Before
    const wsBefore = XLSX.utils.aoa_to_sheet(beforeData);
    XLSX.utils.book_append_sheet(wb, wsBefore, "BEFORE");

    // Download file Excel secara otomatis ke komputer/PDT user
    const fileName = `F003_Damage_${storeCode}_${sendDate}.xlsx`;
    XLSX.writeFile(wb, fileName);

    alert("File Excel berhasil di-generate dan di-download!");
}
