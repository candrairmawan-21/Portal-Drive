// Variable untuk menghitung jumlah baris
let f003RowCount = 0;

// Otomatis isi tanggal hari ini saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('f003-date');
    if(dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
    }
    
    // Otomatis tambahkan 1 baris pertama
    addF003Row();
});

// Fungsi untuk menambah baris tabel
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
                    <!-- Ini input yang akan memanggil kamera / galeri di HP Android -->
                    <input type="file" accept="image/*" capture="environment" class="hidden" onchange="previewPhoto(this, ${f003RowCount})">
                </label>
                <!-- Tempat foto kecil akan muncul setelah di-upload -->
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
    
    // Panggil ulang ikon Lucide agar ikon kamera & tempat sampah muncul
    if (typeof lucide !== 'undefined') lucide.createIcons();
    
    // Trik Scanner: Otomatis memfokuskan kursor ke kolom barcode yang baru dibuat
    setTimeout(() => {
        const barcodeInput = document.getElementById(`barcode-${f003RowCount}`);
        if(barcodeInput) barcodeInput.focus();
    }, 100);
}

// Fungsi untuk menghapus baris jika salah klik
function removeF003Row(rowId) {
    const row = document.getElementById(rowId);
    if(row) row.remove();
}

// Fungsi untuk membaca foto lokal dan menampilkannya di tabel
function previewPhoto(input, rowId) {
    const previewImg = document.getElementById(`preview-${rowId}`);
    const file = input.files[0];
    
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            // Tampilkan fotonya
            previewImg.src = e.target.result;
            previewImg.classList.remove('hidden');
            
            // Simpan data foto secara rahasia untuk dimasukkan ke Excel nanti
            previewImg.setAttribute('data-base64', e.target.result);
        }
        // Proses pembacaan foto di dalam browser (tanpa internet/cloud)
        reader.readAsDataURL(file);
    }
}

// Fungsi sementara sebelum kita masuk ke Tahap 3B (Ekspor Excel)
function generateF003Excel() {
    alert("Keren! Form sudah bisa diisi. Kita akan aktifkan fitur download Excel di tahap selanjutnya!");
}
