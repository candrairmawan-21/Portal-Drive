/* ==========================================================================
   MODUL AI SOP ASSISTANT (READABLE FONT SIZE & CLEAN MARKDOWN PARSER)
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

    // 1. Bubble Chat User (Huruf lebih besar: text-sm font-medium)
    container.innerHTML += `
        <div class="flex justify-end mb-5 animate-[fadeIn_0.2s_ease-out]">
            <div class="bg-slate-900 text-white px-5 py-3.5 rounded-2xl rounded-tr-xs max-w-2xl text-sm font-medium shadow-sm leading-relaxed">
                ${escapeHtml(question)}
            </div>
        </div>
    `;

    inputField.value = '';
    container.scrollTop = container.scrollHeight;

    // 2. Loading State (Ukuran huruf disesuaikan)
    const loadingId = 'ai-loading-' + Date.now();
    container.innerHTML += `
        <div id="${loadingId}" class="flex justify-start mb-5 animate-[fadeIn_0.2s_ease-out]">
            <div class="flex items-start gap-3 max-w-xl">
                <div class="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                    AI
                </div>
                <div class="bg-white border border-slate-200/80 px-5 py-3.5 rounded-2xl rounded-tl-xs text-sm text-slate-500 shadow-sm flex items-center gap-2">
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2 h-2 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span class="ml-1 font-semibold text-slate-600">AI sedang membaca dokumen SOP...</span>
                </div>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();

    try {
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({ question: question })
        });

        const rawText = await response.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Server mengembalikan respons non-JSON (Periksa konfigurasi Who has access = Anyone).");
        }
        
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        let aiAnswerText = "";
        if (result.answer) {
            aiAnswerText = formatAiResponse(result.answer);
        } else if (result.error) {
            aiAnswerText = `<p class="text-rose-600 font-bold text-sm">Terjadi kesalahan sistem: ${escapeHtml(result.error)}</p>`;
        } else {
            aiAnswerText = `<p class="text-slate-600 text-sm">Maaf, AI tidak dapat merespon saat ini.</p>`;
        }

        // 3. Bubble Chat AI (Ukuran text-sm nyaman dibaca, lebar kotak maksimal ditingkatkan max-w-3xl)
        container.innerHTML += `
            <div class="flex justify-start mb-6 animate-[fadeIn_0.2s_ease-out]">
                <div class="flex items-start gap-3.5 max-w-3xl w-full">
                    <div class="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-xs">
                        AI
                    </div>
                    <div class="bg-white border border-slate-200/80 px-6 py-5 rounded-2xl rounded-tl-xs text-sm text-slate-700 shadow-sm leading-relaxed space-y-3 w-full">
                        <div class="font-extrabold text-slate-900 border-b border-slate-100 pb-2 mb-3 flex items-center justify-between">
                            <span class="text-xs tracking-wide uppercase text-slate-500">MR.DIY Operations Assistant</span>
                            <span class="text-[10px] bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-bold">Live Drive</span>
                        </div>
                        <div class="text-sm text-slate-700 space-y-2 font-normal">
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
            <div class="flex justify-start mb-5">
                <div class="bg-rose-50 border border-rose-200 px-5 py-4 rounded-2xl text-sm text-rose-700 shadow-sm space-y-1">
                    <p class="font-bold">Gagal terhubung ke server Google Apps Script</p>
                    <p class="text-xs text-rose-600">${escapeHtml(error.message)}</p>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
    }
}

// Fungsi Parser untuk merapikan Markdown (Heading, Garis Pembatas, Bold/Italic, & Poin Bullet)
function formatAiResponse(text) {
    return text
        // Headings (### atau ##)
        .replace(/^### (.*?)$/gm, '<h4 class="font-bold text-slate-900 text-base mt-4 mb-1">$1</h4>')
        .replace(/^## (.*?)$/gm, '<h3 class="font-extrabold text-slate-900 text-lg mt-4 mb-2">$1</h3>')
        // Garis Pembatas (---)
        .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
        // Bold & Italic
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Bullet points (* atau - di awal baris)
        .replace(/^[\*\-] (.*?)$/gm, '<div class="flex items-start gap-2 ml-1 my-1"><span class="text-emerald-500 font-bold">•</span><span>$1</span></div>')
        // Ganti baris baru ganda menjadi paragraf berspasi
        .replace(/\n\n/g, '<div class="h-2"></div>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
