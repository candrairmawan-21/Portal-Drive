/* ==========================================================================
   MODUL AI SOP ASSISTANT (CONVERSATION MEMORY + ANTI-CORS)
   ========================================================================== */

const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyJsQtbg2LvMVenLQoy0uyYd3MBZbXP_r_hVVevzrs0AahU07aJj-9-2ltU8DQ58Tx_/exec";

// Menyimpan memori riwayat percakapan (Maksimal 6 giliran terakhir)
let aiChatHistory = [];

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
        <div class="flex justify-end mb-6 animate-[fadeIn_0.2s_ease-out]">
            <div class="bg-slate-900 text-white px-6 py-4 rounded-2xl rounded-tr-xs max-w-3xl text-base font-medium shadow-sm leading-relaxed">
                ${escapeHtml(question)}
            </div>
        </div>
    `;

    inputField.value = '';
    container.scrollTop = container.scrollHeight;

    // 2. Loading State
    const loadingId = 'ai-loading-' + Date.now();
    container.innerHTML += `
        <div id="${loadingId}" class="flex justify-start mb-6 animate-[fadeIn_0.2s_ease-out]">
            <div class="flex items-start gap-3 max-w-xl">
                <div class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                    AI
                </div>
                <div class="bg-white border border-slate-200/80 px-5 py-4 rounded-2xl rounded-tl-xs text-base text-slate-500 shadow-sm flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span class="ml-1 font-semibold text-slate-600">AI sedang membaca dokumen SOP...</span>
                </div>
            </div>
        </div>
    `;
    container.scrollTop = container.scrollHeight;
    lucide.createIcons();

    try {
        // MENGIRIM PERTANYAAN SEKALIGUS RIWAYAT OBROLAN KE BACKEND
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify({ 
                question: question,
                history: aiChatHistory 
            })
        });

        const rawText = await response.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Server mengembalikan respons non-JSON.");
        }
        
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        let aiAnswerText = "";
        let rawAnswer = "";
        
        if (result.answer) {
            rawAnswer = result.answer;
            aiAnswerText = formatAiResponse(rawAnswer);
            
            // SIMPAN PERCAKAPAN KE MEMORI HISTORY (Maksimal simpan 6 percakapan terakhir)
            aiChatHistory.push({ role: 'user', text: question });
            aiChatHistory.push({ role: 'model', text: rawAnswer });
            if (aiChatHistory.length > 6) {
                aiChatHistory = aiChatHistory.slice(-6);
            }
        } else if (result.error) {
            aiAnswerText = `<p class="text-rose-600 font-bold text-base">Terjadi kesalahan sistem: ${escapeHtml(result.error)}</p>`;
        } else {
            aiAnswerText = `<p class="text-slate-600 text-base">Maaf, AI tidak dapat merespon saat ini.</p>`;
        }

        // 3. Bubble Chat AI
        container.innerHTML += `
            <div class="flex justify-start mb-8 animate-[fadeIn_0.2s_ease-out]">
                <div class="flex items-start gap-4 max-w-5xl w-full">
                    <div class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                        AI
                    </div>
                    <div class="bg-white border border-slate-200/80 px-7 py-6 rounded-2xl rounded-tl-xs text-base text-slate-700 shadow-sm leading-relaxed space-y-4 w-full">
                        <div class="font-extrabold text-slate-900 border-b border-slate-100 pb-3 mb-3 flex items-center justify-between">
                            <span class="text-sm tracking-wide uppercase text-slate-500">MR.DIY Operations Assistant</span>
                            <div class="flex items-center gap-2">
                                <a href="https://drive.google.com/drive/folders/18xwtLtJY_U7_q7UPFLdlIydKzx4VV6qs?usp=drive_link" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-full shadow-sm transition-all border border-emerald-500/30">
                                    <i data-lucide="folder" class="w-3.5 h-3.5"></i> Arsip SOP Google Drive
                                </a>
                                <span class="text-xs bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full font-bold">Live Drive</span>
                            </div>
                        </div>
                        <div class="text-base text-slate-800 space-y-3 font-normal">
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
            <div class="flex justify-start mb-6">
                <div class="bg-rose-50 border border-rose-200 px-6 py-4 rounded-2xl text-base text-rose-700 shadow-sm space-y-1">
                    <p class="font-bold">Gagal terhubung ke server Google Apps Script</p>
                    <p class="text-sm text-rose-600">${escapeHtml(error.message)}</p>
                </div>
            </div>
        `;
        container.scrollTop = container.scrollHeight;
        lucide.createIcons();
    }
}

function formatAiResponse(text) {
    return text
        .replace(/^### (.*?)$/gm, '<h4 class="font-bold text-slate-900 text-base mt-4 mb-1">$1</h4>')
        .replace(/^## (.*?)$/gm, '<h3 class="font-extrabold text-slate-900 text-lg mt-4 mb-2">$1</h3>')
        .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^[\*\-] (.*?)$/gm, '<div class="flex items-start gap-2 ml-1 my-1"><span class="text-emerald-500 font-bold">•</span><span>$1</span></div>')
        .replace(/\n\n/g, '<div class="h-2"></div>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}
