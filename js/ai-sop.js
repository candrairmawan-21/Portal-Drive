/* ==========================================================================
   MODUL AI SOP ASSISTANT (CONNECTED TO GOOGLE DRIVE & GEMINI API)
   ========================================================================== */

// Ganti URL di bawah ini dengan Web App URL dari Google Apps Script Anda (.exec)
const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyJsQtbg2LvMVenLQoy0uyYd3MBZbXP_r_hVVevzrs0AahU07aJj-9-2ltU8DQ58Tx_/exec";

async function sendAiPrompt() {
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

    // 2. Tampilkan Loading State saat AI membaca folder Google Drive
    const loadingId = 'ai-loading-' + Date.now();
    container.innerHTML += `
        <div id="${loadingId}" class="flex justify-start mb-4">
            <div class="bg-emerald-50/80 border border-emerald-200/60 p-4 rounded-2xl max-w-lg text-xs text-slate-700 flex items-center gap-2.5 shadow-sm">
                <i data-lucide="loader-2" class="w-4 h-4 text-emerald-600 animate-spin"></i>
                <span class="font-bold text-emerald-900">AI sedang membaca isi dokumen di folder Google Drive...</span>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();

    try {
        // 3. Kirim request ke Google Apps Script (Backend)
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ question: question })
        });

        const result = await response.json();
        
        // Hapus elemen loading
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        let aiAnswerText = "";
        if (result.answer) {
            aiAnswerText = formatAiResponse(result.answer);
        } else if (result.error) {
            aiAnswerText = `<p class="text-rose-600 font-bold">Terjadi kesalahan sistem: ${escapeHtml(result.error)}</p>`;
        } else {
            aiAnswerText = `<p class="text-slate-600">Maaf, AI tidak dapat menghasilkan jawaban saat ini.</p>`;
        }

        // 4. Tampilkan Jawaban Asli dari AI Gemini & Google Drive
        container.innerHTML += `
            <div class="flex justify-start mb-4">
                <div class="bg-white border border-emerald-200/80 p-4 rounded-2xl max-w-2xl text-xs text-slate-700 shadow-sm leading-relaxed">
                    <div class="flex items-center gap-2 mb-2 pb-2 border-b border-slate-100">
                        <span class="w-6 h-6 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">AI</span>
                        <span class="font-black text-slate-800 uppercase tracking-wider text-[11px]">AI Operations Assistant (Live Drive)</span>
                    </div>
                    <div class="space-y-2 text-slate-700 font-medium">
                        ${aiAnswerText}
                    </div>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();

    } catch (error) {
        console.error('Error fetching AI response:', error);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        container.innerHTML += `
            <div class="flex justify-start mb-4">
                <div class="bg-rose-50 border border-rose-200 p-4 rounded-2xl max-w-lg text-xs text-rose-700 shadow-sm">
                    <p class="font-bold mb-1">Gagal Menghubungkan ke Server AI</p>
                    Periksa kembali URL Web App Google Apps Script atau koneksi internet Anda.
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
    }
}

// Fungsi bantu untuk merapikan teks markdown dari Gemini menjadi HTML yang bersih
function formatAiResponse(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold markdown
        .replace(/\*(.*?)\*/g, '<em>$1</em>')       // Italic markdown
        .replace(/\n/g, '<br>');                    // Enter ke newline HTML
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
