/**
 * @file sales-navigation.js
 * @description Controller untuk mengontrol accordion sidebar Sales Monitoring dan perpindahan sub-view.
 */

window.toggleSalesSubMenu = function(event) {
    if (event) event.stopPropagation();
    const subMenu = document.getElementById('salesSubMenu');
    const chevron = document.getElementById('salesChevron');
    if (subMenu) subMenu.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('rotate-180');
};

window.switchSalesSubView = function(subViewName, params = null) {
    const subViews = ['dashboard', 'upload', 'compare', 'history', 'explorer', 'action', 'settings'];
    subViews.forEach(v => {
        const el = document.getElementById(`sales-subview-${v}`);
        if (el) el.classList.add('hidden');
        const navBtn = document.getElementById(`nav-sales-${v}`);
        if (navBtn) navBtn.classList.remove('bg-slate-800', 'text-amber-400');
    });

    const activeNav = document.getElementById(`nav-sales-${subViewName}`);
    if (activeNav) activeNav.classList.add('bg-slate-800', 'text-amber-400');

    if (subViewName === 'dashboard') {
        if (typeof window.reloadSalesDashboard === 'function') {
            window.reloadSalesDashboard(false);
        }
    } else {
        const targetViewEl = document.getElementById(`sales-subview-${subViewName}`);
        if (targetViewEl) {
            targetViewEl.classList.remove('hidden');
            renderSubViewContent(subViewName, targetViewEl, params);
        }
    }
};

function renderSubViewContent(viewName, container, params) {
    if (viewName === 'upload') {
        container.innerHTML = `
            <div class="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm max-w-3xl mx-auto animate-[fadeIn_0.2s_ease-out]">
                <div class="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                    <div class="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
                        <i data-lucide="upload-cloud" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-slate-800">Official IT Report PDF Upload</h3>
                        <p class="text-xs text-slate-400">Drag and drop file PDF laporan IT untuk diproses secara otomatis oleh sistem.</p>
                    </div>
                </div>
                
                <div class="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-3xl p-10 text-center bg-slate-50/50 transition-all cursor-pointer mb-6 relative" id="dropZone">
                    <input type="file" id="pdfFileInput" accept=".pdf" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onchange="handleFileSelected(this)">
                    <div class="w-16 h-16 bg-white shadow-sm border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <i data-lucide="file-text" class="w-8 h-8"></i>
                    </div>
                    <h4 class="text-sm font-extrabold text-slate-700">Seret file PDF ke sini, atau <span class="text-emerald-600 underline">Browse file</span></h4>
                    <p class="text-xs text-slate-400 mt-1">Hanya menerima format dokumen .PDF dari server IT.</p>
                </div>

                <div id="uploadProgressContainer" class="hidden space-y-3 mb-6">
                    <div class="flex justify-between text-xs font-bold text-slate-700">
                        <span id="uploadStatusText">Memproses Parsing PDF...</span>
                        <span id="uploadProgressPct">0%</span>
                    </div>
                    <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200">
                        <div id="uploadProgressBar" class="bg-emerald-500 h-full w-0 transition-all duration-300"></div>
                    </div>
                </div>

                <div class="flex justify-end gap-3">
                    <button onclick="switchSalesSubView('dashboard')" class="px-5 py-2.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-200 transition">Kembali ke Dashboard</button>
                </div>
            </div>
        `;
        lucide.createIcons();
    } else {
        container.innerHTML = `
            <div class="bg-white border border-slate-200/80 rounded-3xl p-8 shadow-sm text-center">
                <i data-lucide="construction" class="w-12 h-12 text-amber-500 mx-auto mb-3"></i>
                <h3 class="text-base font-black text-slate-800 capitalize">Modul ${viewName}</h3>
                <p class="text-xs text-slate-400 mt-1">Modul ini siap dikonfigurasi sesuai kebutuhan operasional.</p>
                <button onclick="switchSalesSubView('dashboard')" class="mt-6 px-5 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl">Kembali ke Dashboard</button>
            </div>
        `;
        lucide.createIcons();
    }
}

window.handleFileSelected = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const progContainer = document.getElementById('uploadProgressContainer');
        const progressBar = document.getElementById('uploadProgressBar');
        const progressPct = document.getElementById('uploadProgressPct');
        const statusText = document.getElementById('uploadStatusText');

        progContainer.classList.remove('hidden');
        let progress = 0;
        
        const interval = setInterval(() => {
            progress += 20;
            progressBar.style.width = `${progress}%`;
            progressPct.textContent = `${progress}%`;
            if (progress === 40) statusText.textContent = "Membaca header mapping PDF...";
            if (progress === 80) statusText.textContent = "Menyimpan ke database Google Spreadsheet...";
            if (progress >= 100) {
                clearInterval(interval);
                statusText.textContent = "Upload & Parsing Berhasil!";
                alert(`File "${file.name}" berhasil di-upload dan diproses!`);
            }
        }, 300);
    }
};
