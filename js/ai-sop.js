/* ==========================================================================
   MODUL AI SOP ASSISTANT (CONVERSATION MEMORY + ANTI-CORS + AUTO-RETRY)
   ==========================================================================
   Alur: browser -> Google Apps Script (Web App) -> Gemini API.
   Frontend TIDAK memegang API key; semua pemanggilan Gemini ada di Apps Script.

   Kenapa ada retry di sini:
   Gemini API sesekali membalas 503 "This model is currently experiencing high
   demand" / 429 / UNAVAILABLE. Ini kondisi SEMENTARA di sisi Google, bukan
   bug portal. Sebelumnya satu kali gagal langsung ditampilkan sebagai error
   ke user. Sekarang error sementara dicoba ulang otomatis (exponential
   backoff + jitter), dan kalau tetap gagal user dapat pesan ramah + tombol
   "Coba Lagi" tanpa harus mengetik ulang pertanyaan.
   ========================================================================== */

const APPS_SCRIPT_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyJsQtbg2LvMVenLQoy0uyYd3MBZbXP_r_hVVevzrs0AahU07aJj-9-2ltU8DQ58Tx_/exec";

// ---- Konfigurasi retry & timeout (aman diubah) ----
const AI_MAX_ATTEMPTS = 4;            // total percobaan per pertanyaan (1 awal + 3 ulang)
const AI_RETRY_BASE_MS = 2000;        // jeda dasar: 2s, 4s, 8s (+ jitter acak)
const AI_REQUEST_TIMEOUT_MS = 90000;  // Apps Script + Gemini bisa lambat (baca banyak PDF); backend berhenti memulai percobaan baru di ~45 dtk
const AI_HISTORY_LIMIT = 6;           // jumlah pesan (user+model) yang dikirim sebagai konteks

// Menyimpan memori riwayat percakapan (maksimal AI_HISTORY_LIMIT pesan terakhir)
let aiChatHistory = [];

// Mencegah kirim ganda (Enter ditekan dua kali / klik tombol saat masih memproses)
let aiIsSending = false;

// Pertanyaan terakhir yang gagal, dipakai tombol "Coba Lagi"
let aiLastFailedQuestion = '';

document.addEventListener('DOMContentLoaded', () => {
    const inputField = document.getElementById('aiPromptInput');
    if (inputField) {
        inputField.addEventListener('keydown', function(event) {
            // isComposing: jangan kirim saat user masih memilih huruf di keyboard IME (mis. HP)
            if (event.key === 'Enter' && !event.isComposing) {
                event.preventDefault();
                sendAiPrompt();
            }
        });
    }
});

/* --------------------------------------------------------------------------
   Deteksi error SEMENTARA (layak dicoba ulang) vs error PERMANEN (tidak).
   Error permanen (mis. API key salah, kuota habis harian, prompt diblokir)
   tidak ada gunanya diulang, jadi langsung ditampilkan.
   -------------------------------------------------------------------------- */
function isTransientAiError_(message) {
    const m = String(message || '').toLowerCase();
    return (
        m.includes('high demand') ||
        m.includes('overloaded') ||
        m.includes('unavailable') ||
        m.includes('try again later') ||
        m.includes('503') ||
        m.includes('429') ||
        m.includes('500') ||
        m.includes('resource_exhausted') ||
        m.includes('rate limit') ||
        m.includes('timeout') ||
        m.includes('timed out') ||
        m.includes('deadline') ||
        m.includes('non-json') ||
        m.includes('failed to fetch') ||
        m.includes('networkerror') ||
        m.includes('aborted')
    );
}

function aiSleep_(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Satu kali panggilan ke backend. Melempar Error kalau gagal.
async function callAiBackendOnce_(question) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(APPS_SCRIPT_WEB_APP_URL, {
            method: 'POST',
            // text/plain = "simple request" -> tidak memicu preflight CORS (anti-CORS Apps Script)
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ question: question, history: aiChatHistory }),
            signal: controller.signal
        });

        const rawText = await response.text();
        let result;
        try {
            result = JSON.parse(rawText);
        } catch (e) {
            // Apps Script kadang membalas halaman HTML error saat kena kuota/timeout.
            throw new Error("Server mengembalikan respons non-JSON.");
        }

        if (result && result.answer) return result.answer;
        if (result && result.error) {
            const backendErr = new Error(String(result.error));
            // exhausted = backend SUDAH mencoba ulang + pindah model cadangan; mengulang lagi dari
            // browser hanya akan melipatgandakan beban, jadi cukup tombol "Coba Lagi" manual.
            backendErr.exhausted = !!result.exhausted;
            throw backendErr;
        }
        throw new Error("AI tidak mengembalikan jawaban.");
    } catch (err) {
        if (err && err.name === 'AbortError') {
            throw new Error("Permintaan timeout: server AI terlalu lama merespons.");
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
}

// Panggilan dengan retry otomatis. onRetry dipanggil sebelum tiap percobaan ulang
// supaya UI bisa memberi tahu user ("mencoba lagi 2/4...").
async function callAiWithRetry_(question, onRetry) {
    let lastError;
    for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
        try {
            return await callAiBackendOnce_(question);
        } catch (err) {
            lastError = err;
            const canRetry = attempt < AI_MAX_ATTEMPTS && !err.exhausted && isTransientAiError_(err.message);
            if (!canRetry) break;

            // Exponential backoff + jitter: 2s, 4s, 8s (+0-700ms acak)
            const delay = AI_RETRY_BASE_MS * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 700);
            if (typeof onRetry === 'function') onRetry(attempt + 1, AI_MAX_ATTEMPTS, delay);
            await aiSleep_(delay);
        }
    }
    throw lastError;
}

// Ubah pesan error teknis jadi bahasa yang dimengerti user operasional.
function friendlyAiErrorMessage_(message) {
    const m = String(message || '').toLowerCase();
    // Timeout dicek PERTAMA: pesan timeout dari backend ikut menyertakan error terakhir
    // (mis. 503), padahal penyebab utamanya waktu habis, bukan sekadar "sibuk".
    if (m.includes('waktu pemrosesan habis') || m.includes('timeout') || m.includes('timed out') || m.includes('aborted')) {
        return {
            title: 'Server AI terlalu lama merespons',
            body: 'Permintaan melewati batas waktu karena server AI sedang lambat/sibuk atau dokumen yang dibaca terlalu banyak. Tunggu sebentar lalu tekan "Coba Lagi". Kalau berulang, coba pertanyaan yang lebih spesifik (sebut nama dokumen/topiknya).'
        };
    }
    if (m.includes('high demand') || m.includes('overloaded') || m.includes('unavailable') || m.includes('503') || m.includes('sibuk')) {
        return {
            title: 'Server AI sedang sangat sibuk',
            body: 'Layanan Gemini sedang kelebihan permintaan (bukan masalah di portal). Sudah dicoba otomatis beberapa kali tetapi belum berhasil. Tunggu sekitar satu menit lalu tekan "Coba Lagi".'
        };
    }
    if (m.includes('429') || m.includes('rate limit') || m.includes('resource_exhausted') || m.includes('quota')) {
        return {
            title: 'Batas penggunaan AI tercapai',
            body: 'Terlalu banyak pertanyaan dalam waktu singkat atau kuota harian habis. Tunggu beberapa saat lalu coba lagi.'
        };
    }
    if (m.includes('non-json') || m.includes('failed to fetch') || m.includes('networkerror')) {
        return {
            title: 'Gagal terhubung ke server',
            body: 'Periksa koneksi internet Anda. Jika koneksi normal, server Google Apps Script mungkin sedang bermasalah sementara.'
        };
    }
    return { title: 'Terjadi kesalahan sistem', body: String(message || 'Kesalahan tidak diketahui.') };
}

async function sendAiPrompt(retryQuestion) {
    if (aiIsSending) return;

    const inputField = document.getElementById('aiPromptInput');
    const container = document.getElementById('aiChatContainer');
    if (!inputField || !container) return;

    // retryQuestion hanya string kalau dipanggil dari tombol "Coba Lagi".
    // (onclick="sendAiPrompt()" biasa tidak mengirim argumen string.)
    const isRetry = typeof retryQuestion === 'string' && retryQuestion.length > 0;
    const question = isRetry ? retryQuestion : inputField.value.trim();
    if (!question) return;

    aiIsSending = true;
    setAiSendingUi_(true);

    const welcomeBox = document.getElementById('aiWelcomeBox');
    if (welcomeBox) welcomeBox.style.display = 'none';

    // Hapus kartu error lama (kalau ini "Coba Lagi") supaya tidak menumpuk
    container.querySelectorAll('[data-ai-error="1"]').forEach(el => el.remove());

    // 1. Bubble Chat User (tidak diulang saat "Coba Lagi" karena sudah tampil)
    if (!isRetry) {
        container.insertAdjacentHTML('beforeend', `
            <div class="flex justify-end mb-6 animate-[fadeIn_0.2s_ease-out]">
                <div class="bg-slate-900 text-white px-6 py-4 rounded-2xl rounded-tr-xs max-w-3xl text-base font-medium shadow-sm leading-relaxed">
                    ${escapeHtml(question)}
                </div>
            </div>
        `);
        inputField.value = '';
    }
    container.scrollTop = container.scrollHeight;

    // 2. Loading State
    const loadingId = 'ai-loading-' + Date.now();
    const statusId = loadingId + '-status';
    container.insertAdjacentHTML('beforeend', `
        <div id="${loadingId}" class="flex justify-start mb-6 animate-[fadeIn_0.2s_ease-out]">
            <div class="flex items-start gap-3 max-w-xl">
                <div class="w-10 h-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm font-bold text-sm">
                    AI
                </div>
                <div class="bg-white border border-slate-200/80 px-5 py-4 rounded-2xl rounded-tl-xs text-base text-slate-500 shadow-sm flex items-center gap-2.5">
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce"></span>
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span class="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    <span id="${statusId}" class="ml-1 font-semibold text-slate-600">AI sedang membaca dokumen SOP...</span>
                </div>
            </div>
        </div>
    `);
    container.scrollTop = container.scrollHeight;
    if (window.lucide) lucide.createIcons();

    try {
        const rawAnswer = await callAiWithRetry_(question, (nextAttempt, maxAttempts, delayMs) => {
            const statusEl = document.getElementById(statusId);
            if (statusEl) {
                statusEl.textContent = `Server AI sedang sibuk, mencoba lagi otomatis (${nextAttempt}/${maxAttempts})...`;
            }
        });

        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        // Riwayat HANYA disimpan kalau berhasil, supaya pertanyaan gagal tidak
        // mengotori konteks percakapan berikutnya.
        aiChatHistory.push({ role: 'user', text: question });
        aiChatHistory.push({ role: 'model', text: rawAnswer });
        if (aiChatHistory.length > AI_HISTORY_LIMIT) {
            aiChatHistory = aiChatHistory.slice(-AI_HISTORY_LIMIT);
        }
        aiLastFailedQuestion = '';

        // 3. Bubble Chat AI
        container.insertAdjacentHTML('beforeend', `
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
                            ${formatAiResponse(rawAnswer)}
                        </div>
                    </div>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
        if (window.lucide) lucide.createIcons();

    } catch (error) {
        console.error('Error detail:', error);
        const loadingElement = document.getElementById(loadingId);
        if (loadingElement) loadingElement.remove();

        aiLastFailedQuestion = question;
        const friendly = friendlyAiErrorMessage_(error.message);

        container.insertAdjacentHTML('beforeend', `
            <div data-ai-error="1" class="flex justify-start mb-6">
                <div class="bg-rose-50 border border-rose-200 px-6 py-4 rounded-2xl text-base text-rose-700 shadow-sm space-y-2 max-w-2xl">
                    <p class="font-bold">${escapeHtml(friendly.title)}</p>
                    <p class="text-sm text-rose-600">${escapeHtml(friendly.body)}</p>
                    <p class="text-xs text-rose-400 break-words">Detail teknis: ${escapeHtml(String(error.message || '').slice(0, 300))}</p>
                    <button type="button" onclick="retryLastAiPrompt()" class="mt-1 inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold rounded-xl shadow-sm transition-all">
                        <i data-lucide="refresh-cw" class="w-4 h-4"></i> Coba Lagi
                    </button>
                </div>
            </div>
        `);
        container.scrollTop = container.scrollHeight;
        if (window.lucide) lucide.createIcons();
    } finally {
        aiIsSending = false;
        setAiSendingUi_(false);
        const inp = document.getElementById('aiPromptInput');
        if (inp) inp.focus();
    }
}

// Dipanggil dari atribut onclick (harus global).
window.retryLastAiPrompt = function () {
    if (aiLastFailedQuestion) sendAiPrompt(aiLastFailedQuestion);
};

// Kunci input + tombol kirim selama proses berjalan.
function setAiSendingUi_(isSending) {
    const inputField = document.getElementById('aiPromptInput');
    if (inputField) inputField.disabled = isSending;
    const sendBtn = document.querySelector('#aiPromptInput ~ button');
    if (sendBtn) {
        sendBtn.disabled = isSending;
        sendBtn.classList.toggle('opacity-50', isSending);
        sendBtn.classList.toggle('cursor-not-allowed', isSending);
    }
}

/* --------------------------------------------------------------------------
   Format jawaban AI (markdown ringan -> HTML).
   PENTING: teks di-escape DULU, baru diformat. Sebelumnya jawaban AI dimasukkan
   ke innerHTML mentah, sehingga HTML/script di dalam jawaban (atau di dokumen
   SOP yang dibaca AI) bisa tereksekusi di browser user.
   Urutan: bullet diproses sebelum italic supaya "* item" tidak dianggap
   pembuka tanda miring.
   -------------------------------------------------------------------------- */
function formatAiResponse(text) {
    return escapeHtml(String(text || ''))
        .replace(/^### (.*?)$/gm, '<h4 class="font-bold text-slate-900 text-base mt-4 mb-1">$1</h4>')
        .replace(/^## (.*?)$/gm, '<h3 class="font-extrabold text-slate-900 text-lg mt-4 mb-2">$1</h3>')
        .replace(/^---$/gm, '<hr class="my-4 border-slate-200">')
        .replace(/^[\*\-] (.*?)$/gm, '<div class="flex items-start gap-2 ml-1 my-1"><span class="text-emerald-500 font-bold">•</span><span>$1</span></div>')
        .replace(/^(\d+)\. (.*?)$/gm, '<div class="flex items-start gap-2 ml-1 my-1"><span class="text-emerald-600 font-bold min-w-[1.25rem]">$1.</span><span>$2</span></div>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        // Newline tepat setelah elemen blok tidak perlu <br> lagi (kalau tidak, jarak antar baris jadi renggang)
        .replace(/(<\/div>|<\/h3>|<\/h4>|<hr[^>]*>)\n/g, '$1')
        .replace(/\n\n/g, '<div class="h-2"></div>')
        .replace(/\n/g, '<br>');
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text == null ? '' : text).replace(/[&<>"']/g, function(m) { return map[m]; });
}
