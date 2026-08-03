/* ==========================================================================
   MODUL AI SOP ASSISTANT (ANTI-CORS & REAL ERROR REPORTING)
   ========================================================================== */

const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyJsQtbg2LvMVenLQoy0uyYd3MBZbXP_r_hVVevzrs0AahU07aJj-9-2ltU8DQ58Tx_/exec";

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('aiPromptInput');
    if (inputField) {
        inputField.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendAiPrompt();
            }
        });
    }
});

async function sendAiPrompt() {
    const inputField = document.getElementById('aiPromptInput');
    const container = document.getElementById('aiChatContainer');
    if (!inputField || !container) return;

    const question = inputField.value.trim();
    if (!question) return;

    const welcomeBox = document.getElementById('aiWelcomeBox');
    if (welcomeBox) welcomeBox.style.display = 'none';

    // 1. Bubble Chat User
    container.innerHTML += `
        <div class="flex justify-end mb-4 animate-[fadeIn_0.2s_ease-out]">
            <div class="bg-slate-900 text-white px-4 py-3 rounded-2xl rounded-tr-xs max-w-xl text-xs font-medium shadow-sm leading-relaxed">
                ${escapeHtml(question)}
            </div>
        </div>
    `;

    inputField.value = '';
    container.scrollTop = container.scrollHeight;

    // 2. Loading State
    const loadingId = 'ai-loading-' + Date.now();
    container.innerHTML += `
        <div id="${loadingId}" class="flex justify-start mb-4 animate-[fadeIn_0.2s_ease-out]">
            <div class="flex items-start gap-3 max-w-xl">
                <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                    AI
                </div>
                <div class="bg-white border border-slate-200/80 px-4 py-3 rounded-2xl rounded-tl-xs text-xs text-slate-500 shadow-sm flex items-center gap-2">
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span class="ml-1 font-semibold text-slate-600">AI sedang menganalisa dokumen SOP...</span>
                </div>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();

    try {
        // PERBAIKAN PENTING: Menggunakan Content-Type text/plain agar tidak diblokir CORS oleh Google Apps Script
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({ question: question })
        });

        // Membaca teks mentah terlebih dahulu untuk mendeteksi error HTML dari Google
        const rawText = await response.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Server mengembalikan respons non-JSON (Kemungkinan izin 'Who has access' belum diatur ke 'Anyone').");
        }
        
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        let aiAnswerText = "";
        if (result.answer) {
            aiAnswerText = formatAiResponse(result.answer);
        } else if (result.error) {
            aiAnswerText = `<p class="text-rose-600 font-bold">Terjadi kesalahan sistem: ${escapeHtml(result.error)}</p>`;
        } else {
            aiAnswerText = `<p class="text-slate-600">Maaf, AI tidak dapat merespon.</p>`;
        }

        container.innerHTML += `
            <div class="flex justify-start mb-4 animate-[fadeIn_0.2s_ease-out]">
                <div class="flex items-start gap-3 max-w-2xl">
                    <div class="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                        AI
                    </div>
                    <div class="bg-white border border-slate-200/80 px-5 py-4 rounded-2xl rounded-tl-xs text-xs text-slate-700 shadow-sm leading-relaxed space-y-2">
                        <div class="font-extrabold text-slate-900 border-b border-slate-100 pb-1 mb-2 flex items-center justify-between">
                            <span>MR.DIY Operations Assistant</span>
                            <span class="text-[9px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-bold">Live Drive</span>
                        </div>
                        <div class="font-medium text-slate-700 space-y-2">
                            ${aiAnswerText}
                        </div>
                    </div>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();

    } catch (error) {
        console.error('Error detail:', error);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        container.innerHTML += `
            <div class="flex justify-start mb-4">
                <div class="bg-rose-50 border border-rose-200 px-4 py-3 rounded-2xl text-xs text-rose-700 shadow-sm space-y-1">
                    <p class="font-bold">Gagal terhubung ke server Google Apps Script</p>
                    <p class="text-[11px] text-rose-600">${escapeHtml(error.message)}</p>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
    }
}

function formatAiResponse(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
