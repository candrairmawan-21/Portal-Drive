/* ==========================================================================
   MODUL AI SOP ASSISTANT (MULTI-DOCUMENT RAG & HANDBOOK REFERENCE)
   ========================================================================== */

function sendAiPrompt() {
    const inputField = document.getElementById('aiPromptInput');
    const container = document.getElementById('aiChatContainer');
    if (!inputField || !container) return;

    const question = inputField.value.trim();
    if (!question) return;

    // 1. Tampilkan Pertanyaan User di Chat Box
    container.innerHTML += `
        <div class="flex justify-end mb-4">
            <div class="bg-slate-900 text-white p-3.5 rounded-2xl max-w-lg text-xs font-semibold shadow-sm">
                <p class="text-[10px] text-amber-400 font-bold mb-1 uppercase tracking-wider">Anda bertanya:</p>
                ${escapeHtml(question)}
            </div>
        </div>
    `;

    inputField.value = '';
    container.scrollTop = container.scrollHeight;

    // 2. Simulasi Proses Berpikir AI (Loading State)
    const loadingId = 'ai-loading-' + Date.now();
    container.innerHTML += `
        <div id="${loadingId}" class="flex justify-start mb-4">
            <div class="bg-emerald-50/80 border border-emerald-200/60 p-4 rounded-2xl max-w-lg text-xs text-slate-700 flex items-center gap-2.5 shadow-sm">
                <i data-lucide="loader-2" class="w-4 h-4 text-emerald-600 animate-spin"></i>
                <span class="font-bold text-emerald-900">AI sedang menelusuri Retail Operations Handbook...</span>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();

    // 3. Simulasi Respon Pintar AI Berdasarkan Pertanyaan
    setTimeout(() => {
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        let aiAnswer = generateMockAiResponse(question);

        container.innerHTML += `
            <div class="flex justify-start mb-4">
                <div class="bg-white border border-emerald-200/80 p-4 rounded-2xl max-w-2xl text-xs text-slate-700 shadow-sm leading-relaxed">
                    <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <span class="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">AI</span>
                        <span class="font-black text-slate-800 uppercase tracking-wider text-[11px]">AI Operations Assistant</span>
                    </div>
                    <div class="space-y-2 text-slate-700 font-medium">
                        ${aiAnswer}
                    </div>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
    }, 1200);
}

// Mesin Analisa Placeholder Cerdas (Nanti bisa dihubungkan langsung ke API Gemini)
function generateMockAiResponse(query) {
    const q = query.toLowerCase();

    if (q.includes('rusak') || q.includes('damage') || q.includes('retur')) {
        return `
            <p>Menurut <strong>Retail Operations Handbook MR.DIY - Bab 4 (Store Receiving & Inventory) Halaman 42</strong>, dijelaskan bahwa:</p>
            <ol class="list-decimal pl-4 space-y-1 mt-1">
                <li>Barang rusak atau <em>defective</em> wajib difoto fisik barang dan barcode SKU-nya maksimal <strong>2x24 jam</strong> sejak kedatangan truk pengiriman.</li>
                <li>ABM wajib mengisi Form Damaged Goods (FDG) melalui sistem LARK dan meminta validasi dari Branch Manager (BM).</li>
                <li>Barang tidak boleh dipajang di area jual dan wajib disimpan di rak khusus 'Retur/Defect' di area gudang toko.</li>
            </ol>
            <p class="mt-2 text-[10px] text-emerald-600 font-extrabold">[📑 Referensi: Retail Operations Handbook v2026 - Halaman 42]</p>
        `;
    } else if (q.includes('klaim') || q.includes('petty cash') || q.includes('uang')) {
        return `
            <p>Menurut <strong>SOP Finance & Cash Handling MR.DIY Halaman 18</strong>:</p>
            <p>Batas maksimal pengeluaran petty cash toko tanpa approval regional manager adalah Rp 500.000. Setiap transaksi wajib dilampirkan nota asli bertuliskan stempel toko.</p>
            <p class="mt-2 text-[10px] text-emerald-600 font-extrabold">[📑 Referensi: SOP Cash Handling - Halaman 18]</p>
        `;
    } else {
        return `
            <p>Berdasarkan penelusuran di dalam seluruh pustaka dokumen SOP dan Handbook MR.DIY:</p>
            <p>Untuk pertanyaan mengenai <em>"${escapeHtml(query)}"</em>, prosedur standarnya mewajibkan seluruh ABM dan BM untuk selalu berkoordinasi langsung dengan Area Supervisor serta merujuk pada bab operasional umum toko terkait.</p>
            <p class="mt-2 text-[10px] text-emerald-600 font-extrabold">[📑 Referensi: Retail Operations Handbook - Pustaka Umum]</p>
        `;
    }
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
