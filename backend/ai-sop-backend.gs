/* ==========================================================================
   AI OPERATIONS ASSISTANT - MR.DIY  (Backend Google Apps Script, v2)
   Pengganti utuh script AI SOP sebelumnya. Tempel menggantikan SELURUH isi
   Code.gs di project Apps Script AI SOP, lalu DEPLOY ULANG (New version).

   ARSITEKTUR (sama seperti sebelumnya, dengan perbaikan):
   - PDF & gambar di folder Drive dibaca visual oleh Gemini lewat Files API.
     Hasil upload di-CACHE per file (selama file belum berubah & < 47 jam),
     jadi isi PDF tidak diupload ulang di setiap pertanyaan.
   - Google Docs / teks biasa dibaca langsung sebagai teks (dibatasi panjangnya).
   - Folder ditelusuri rekursif, termasuk SHORTCUT Drive.
   - Pertanyaan SOP/teknis wajib dijawab hanya dari pustaka + sitasi dokumen.

   YANG DIPERBAIKI DIBANDING VERSI LAMA
   1. ERROR "high demand" (HTTP 503): dulu error Gemini dikembalikan sebagai
      TEKS JAWABAN ("Error dari Gemini API: ..."), jadi frontend mengira itu
      jawaban dan tidak pernah mencoba ulang. Sekarang: retry dengan jeda
      bertahap + pindah ke model cadangan, dan kalau tetap gagal dikirim sebagai
      {error, exhausted:true} supaya frontend menampilkan tombol "Coba Lagi".
   2. Daftar file Drive di-cache 5 menit (dulu menelusuri seluruh folder di
      SETIAP pertanyaan = lambat, dan salah satu sumber timeout).
   3. Slot MAX_FILES dulu bisa terpakai file yang tidak didukung (xlsx, dll).
      Sekarang hanya file yang benar-benar bisa dibaca yang masuk antrean.
   4. Manifest cache dulu satu properti ~9KB (bisa meluap diam-diam). Sekarang
      satu properti per file, tanpa batas praktis.
   5. Upload pertama kali tidak lagi bisa menghabiskan waktu sampai timeout:
      ada anggaran waktu; file yang belum sempat diupload dilewati dulu dan
      dilaporkan "sedang disiapkan" (akan siap di pertanyaan berikutnya).
   6. Menunggu file Gemini berstatus ACTIVE sebelum dipakai (dulu langsung
      dipakai -> kadang gagal untuk PDF besar).
   7. URI file kedaluwarsa/terhapus di sisi Gemini dideteksi, cache dibuang,
      lalu otomatis diulang sekali dengan upload baru.
   8. API key dikirim lewat header (bukan di URL, yang bisa muncul di log).
   9. Instruksi sistem memakai field system_instruction, riwayat chat dikirim
      sebagai giliran percakapan asli (bukan ditempel ke teks prompt).
   10. Dua request yang sama-sama perlu upload file yang sama tidak lagi
       mengupload dobel (LockService).
   11. Shortcut yang menunjuk ke folder induknya tidak lagi menyebabkan
       rekursi tanpa akhir; file ganda (fisik + shortcut) dibuang.
   12. Respons Gemini yang diblokir / terpotong ditangani dengan pesan jelas.
   13. warmUpLibrary() + installWarmupTrigger(): menyiapkan semua file di
       latar belakang supaya user tidak menunggu upload.

   SCRIPT PROPERTIES (Project Settings > Script properties)
   - GEMINI_API_KEY      (WAJIB)
   - GEMINI_MODEL_CHAIN  (opsional) daftar model dipisah koma, urutan = prioritas.
                         Contoh: gemini-3.5-flash-lite,gemini-3.8-flash
                         Bisa diubah tanpa deploy ulang kode. Cek nama model
                         terbaru di https://ai.google.dev/gemini-api/docs/deprecations
   - ADMIN_TOKEN         (opsional) kalau diisi, endpoint diagnostik doGet wajib
                         menyertakan &token=NILAINYA.
   ========================================================================== */

/* ------------------------------ KONFIGURASI ------------------------------ */

const FOLDER_ID = "18xwtLtJY_U7_q7UPFLdlIydKzx4VV6qs";

// Urutan prioritas model. Model pertama dipakai dulu; kalau tetap sibuk/hilang,
// pindah ke berikutnya. Bisa ditimpa lewat Script property GEMINI_MODEL_CHAIN.
const DEFAULT_MODEL_CHAIN = ["gemini-3.5-flash-lite", "gemini-3.8-flash", "gemini-3.6-flash"];

const GEMINI_BASE = "https://generativelanguage.googleapis.com";
const GEMINI_ATTEMPTS_PER_MODEL = 2;                 // percobaan per model sebelum pindah model
const GEMINI_BACKOFF_MS = 1500;                      // jeda dasar antar percobaan (1.5s, 3s, ...)
const GEMINI_RETRYABLE_CODES = [429, 500, 502, 503, 504];

// Anggaran waktu per request. Frontend menunggu maks 90 detik (ai-sop.js),
// jadi percobaan baru tidak dimulai lagi setelah REQUEST_BUDGET_MS.
const REQUEST_BUDGET_MS = 45000;
const UPLOAD_PHASE_BUDGET_MS = 22000;                // lewat ini, file yang belum ter-cache ditunda

const FILE_PROP_PREFIX = "GF1_";                     // properti cache per file: GF1_<driveFileId>
const FILE_URI_TTL_MS = 47 * 60 * 60 * 1000;         // Gemini menghapus file di 48 jam; pakai 47 jam
const WARMUP_REFRESH_AFTER_MS = 40 * 60 * 60 * 1000; // warm-up memperbarui file yang umurnya > 40 jam
const MAX_FILES = 20;                                // dokumen yang dikirim ke AI per pertanyaan
const MAX_WARM_FILES = 40;                           // dokumen yang disiapkan warm-up
const MAX_FILE_MB = 45;                              // batas ukuran per PDF/gambar
const MAX_TEXT_CHARS = 80000;                        // batas teks per Google Docs/teks biasa

const LIST_CACHE_KEY = "LIB_LIST_V2";
const LIST_CACHE_SEC = 300;                          // daftar file di-cache 5 menit

const MAX_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS = 4000;
const MAX_QUESTION_CHARS = 2000;

const MIME_SHORTCUT = "application/vnd.google-apps.shortcut";
const MIME_FOLDER = "application/vnd.google-apps.folder";

/* ------------------------------ ENDPOINT ------------------------------ */

function doPost(e) {
  const startedAt = Date.now();
  try {
    if (!getApiKey_()) {
      return jsonOutput_({ error: "GEMINI_API_KEY belum diset di Script Properties (Project Settings)." });
    }

    let data;
    try {
      data = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonOutput_({ error: "Format permintaan tidak valid." });
    }

    const question = String(data.question || "").trim().slice(0, MAX_QUESTION_CHARS);
    if (!question) return jsonOutput_({ error: "Pertanyaan kosong." });

    const history = sanitizeHistory_(data.history);
    const answer = answerWithLibrary_(question, history, startedAt);
    return jsonOutput_({ answer: answer });

  } catch (err) {
    console.error("doPost gagal: " + errMessage_(err));
    // exhausted=true: semua retry & model cadangan sudah dicoba di server, jadi
    // frontend TIDAK perlu mengulang otomatis (cukup tombol "Coba Lagi").
    return jsonOutput_({ error: errMessage_(err), exhausted: !!(err && err.exhausted) });
  }
}

/**
 * Endpoint diagnostik (GET):
 *   ?action=list_library  -> daftar mentah semua file yang ditemukan (tanpa Gemini)
 *   ?action=status        -> konfigurasi aktif & jumlah file yang ter-cache di Gemini
 *   ?action=clear_cache   -> buang cache daftar file & cache upload (paksa upload ulang)
 * Kalau Script property ADMIN_TOKEN diisi, tambahkan &token=... pada URL.
 */
function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    const action = params.action;

    if (!action) {
      return jsonOutput_({ info: "AI SOP Assistant backend aktif. Kirim POST untuk chat. Diagnostik: GET ?action=list_library | status | clear_cache" });
    }

    const adminToken = PropertiesService.getScriptProperties().getProperty("ADMIN_TOKEN");
    if (adminToken && params.token !== adminToken) {
      return jsonOutput_({ error: "Token tidak valid." });
    }

    if (action === "list_library") return jsonOutput_(debugListLibrary_());
    if (action === "status") return jsonOutput_(debugStatus_());
    if (action === "clear_cache") return jsonOutput_(clearAllCaches_());
    return jsonOutput_({ error: "Aksi tidak dikenal: " + action });
  } catch (err) {
    return jsonOutput_({ error: errMessage_(err) });
  }
}

/* ------------------------------ ALUR JAWABAN ------------------------------ */

function answerWithLibrary_(question, history, startedAt) {
  // Maksimal 2 putaran: kalau Gemini bilang file di cache sudah tidak valid
  // (kedaluwarsa/terhapus), buang cache file itu lalu ulangi sekali dengan upload baru.
  for (let pass = 0; pass < 2; pass++) {
    const library = buildLibraryParts_(question, startedAt);
    const systemInstruction = buildSystemInstruction_(library.names);
    try {
      return callGeminiWithFallback_(systemInstruction, history, library.parts, question, startedAt);
    } catch (err) {
      if (pass === 0 && err && err.fileProblem) {
        console.log("URI file Gemini tidak valid, cache dibuang & diulang: " + errMessage_(err));
        library.fileIds.forEach(deleteFileCache_);
        continue;
      }
      throw err;
    }
  }
}

function sanitizeHistory_(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  raw.slice(-MAX_HISTORY_MESSAGES).forEach(function (h) {
    if (!h || typeof h.text !== "string") return;
    const role = h.role === "model" ? "model" : "user";
    const text = h.text.trim().slice(0, MAX_HISTORY_CHARS);
    if (!text) return;
    if (out.length === 0 && role !== "user") return;            // harus diawali giliran user
    if (out.length > 0 && out[out.length - 1].role === role) {   // giliran sama berturut-turut: gabung
      out[out.length - 1].text += "\n" + text;
      return;
    }
    out.push({ role: role, text: text });
  });
  // Pertanyaan baru adalah giliran user, jadi riwayat harus diakhiri giliran model.
  if (out.length > 0 && out[out.length - 1].role === "user") out.pop();
  return out;
}

/* ------------------------------ PUSTAKA DOKUMEN ------------------------------ */

function isPdfOrImage_(mime) {
  return mime === "application/pdf" || String(mime).indexOf("image/") === 0;
}

function isTextLike_(mime) {
  return mime === "application/vnd.google-apps.document" || mime === "text/plain";
}

function isSupported_(meta) {
  return isPdfOrImage_(meta.mime) || isTextLike_(meta.mime);
}

/**
 * Daftar metadata semua file di folder + sub-folder (rekursif, termasuk shortcut).
 * Hasilnya di-cache LIST_CACHE_SEC detik supaya tidak menelusuri Drive di setiap chat.
 * Format: [{id, name, mime, size, updated(ms), path}]
 */
function getLibraryIndex_(forceFresh) {
  const cache = CacheService.getScriptCache();
  if (!forceFresh) {
    const raw = cache.get(LIST_CACHE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch (e) { /* cache rusak: telusuri ulang */ }
    }
  }

  const root = DriveApp.getFolderById(FOLDER_ID);
  const out = [];
  const seenFolders = {};
  const seenFiles = {};
  collectFiles_(root, root.getName(), out, seenFolders, seenFiles);

  try {
    cache.put(LIST_CACHE_KEY, JSON.stringify(out), LIST_CACHE_SEC);
  } catch (e) {
    console.log("Daftar file terlalu besar untuk CacheService, lanjut tanpa cache: " + e);
  }
  return out;
}

function pushFileMeta_(file, path, out, seenFiles) {
  const id = file.getId();
  if (seenFiles[id]) return; // file yang sama lewat jalur fisik + shortcut: cukup sekali
  seenFiles[id] = true;
  out.push({
    id: id,
    name: file.getName(),
    mime: file.getMimeType(),
    size: file.getSize(),
    updated: file.getLastUpdated().getTime(),
    path: path
  });
}

function collectFiles_(folder, path, out, seenFolders, seenFiles) {
  const folderId = folder.getId();
  if (seenFolders[folderId]) return; // cegah rekursi tanpa akhir (shortcut menunjuk ke folder induk)
  seenFolders[folderId] = true;

  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() === MIME_SHORTCUT) {
      resolveShortcut_(file, path, out, seenFolders, seenFiles);
    } else {
      pushFileMeta_(file, path, out, seenFiles);
    }
  }

  const subs = folder.getFolders();
  while (subs.hasNext()) {
    const sub = subs.next();
    collectFiles_(sub, path + " / " + sub.getName(), out, seenFolders, seenFiles);
  }
}

function resolveShortcut_(shortcutFile, path, out, seenFolders, seenFiles) {
  try {
    const targetId = shortcutFile.getTargetId();
    if (!targetId) return;
    const targetMime = shortcutFile.getTargetMimeType ? shortcutFile.getTargetMimeType() : null;
    if (targetMime === MIME_FOLDER) {
      const target = DriveApp.getFolderById(targetId);
      collectFiles_(target, path + " / " + target.getName() + " (shortcut)", out, seenFolders, seenFiles);
    } else {
      pushFileMeta_(DriveApp.getFileById(targetId), path + " (via shortcut)", out, seenFiles);
    }
  } catch (err) {
    console.log("Gagal resolve shortcut '" + shortcutFile.getName() + "': " + err);
  }
}

/** Kata kunci sederhana dari pertanyaan (buang kata umum & kata pendek). */
function extractKeywords_(query) {
  const stopWords = {
    yang: 1, dan: 1, dari: 1, untuk: 1, pada: 1, adalah: 1, apakah: 1, bagaimana: 1,
    jelaskan: 1, tentang: 1, atau: 1, dengan: 1, saya: 1, bisa: 1, boleh: 1, tolong: 1,
    gimana: 1, kalau: 1, kalo: 1, sama: 1, juga: 1, ada: 1
  };
  return String(query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (w) { return w.length >= 4 && !stopWords[w]; });
}

/** Skor relevansi: jumlah kata kunci yang muncul di NAMA file atau nama sub-folder-nya. */
function keywordMatchScore_(meta, keywords) {
  if (keywords.length === 0) return 0;
  const haystack = (meta.name + " " + meta.path).toLowerCase();
  let score = 0;
  keywords.forEach(function (k) { if (haystack.indexOf(k) !== -1) score++; });
  return score;
}

function buildLibraryParts_(userQuery, startedAt) {
  const keywords = extractKeywords_(userQuery);
  const index = getLibraryIndex_(false);

  // Hanya file yang BISA dibaca yang berebut slot MAX_FILES. Urutan: relevansi nama
  // file/folder dulu (agar SOP lama yang jarang diubah tetap terpilih), baru yang terbaru.
  const candidates = index.filter(isSupported_).sort(function (a, b) {
    const sa = keywordMatchScore_(a, keywords);
    const sb = keywordMatchScore_(b, keywords);
    if (sa !== sb) return sb - sa;
    return b.updated - a.updated;
  });
  const truncatedCount = Math.max(0, candidates.length - MAX_FILES);
  const selected = candidates.slice(0, MAX_FILES);

  const parts = [];
  const names = [];
  const fileIds = [];

  selected.forEach(function (meta) {
    try {
      if (isPdfOrImage_(meta.mime)) {
        const res = ensureGeminiFile_(meta, startedAt, null);
        if (res.status === "ok") {
          parts.push({ text: '[DOKUMEN PUSTAKA RESMI BERJUDUL: "' + meta.name + '"]\n---' });
          parts.push({ fileData: { mimeType: res.mimeType, fileUri: res.uri } });
          names.push(meta.name);
          fileIds.push(meta.id);
        } else if (res.status === "toolarge") {
          names.push(meta.name + " (dilewati, terlalu besar)");
        } else if (res.status === "pending") {
          names.push(meta.name + " (sedang disiapkan, belum bisa dibaca; coba tanya lagi sebentar lagi)");
        } else {
          names.push(meta.name + " (gagal dibaca)");
        }
      } else {
        let text = "";
        if (meta.mime === "application/vnd.google-apps.document") {
          text = DocumentApp.openById(meta.id).getBody().getText();
        } else {
          text = DriveApp.getFileById(meta.id).getBlob().getDataAsString();
        }
        if (text.length > MAX_TEXT_CHARS) {
          text = text.slice(0, MAX_TEXT_CHARS) + "\n...(dipotong, dokumen terlalu panjang)...";
        }
        parts.push({ text: '=== DOKUMEN PUSTAKA TEKS: "' + meta.name + '" ===\n' + text + "\n===\n" });
        names.push(meta.name);
      }
    } catch (err) {
      console.log('Gagal memproses file "' + meta.name + '": ' + errMessage_(err));
      names.push(meta.name + " (gagal dibaca)");
    }
  });

  if (truncatedCount > 0) {
    names.push("(+" + truncatedCount + " dokumen lain tidak ikut dibaca, melebihi batas " + MAX_FILES + " file per pertanyaan)");
  }

  return { parts: parts, names: names, fileIds: fileIds };
}

/* ------------------------------ CACHE UPLOAD PER FILE ------------------------------ */

function readFileCache_(fileId) {
  const raw = PropertiesService.getScriptProperties().getProperty(FILE_PROP_PREFIX + fileId);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}

function writeFileCache_(fileId, entry) {
  PropertiesService.getScriptProperties().setProperty(FILE_PROP_PREFIX + fileId, JSON.stringify(entry));
}

function deleteFileCache_(fileId) {
  PropertiesService.getScriptProperties().deleteProperty(FILE_PROP_PREFIX + fileId);
}

function isCacheFresh_(entry, meta, now, maxAgeMs) {
  return !!entry && entry.upd === meta.updated && (now - entry.up) < maxAgeMs;
}

/**
 * Pastikan file Drive sudah ada di Gemini Files API.
 * @param startedAt  waktu mulai request (untuk anggaran waktu); null = tanpa anggaran (warm-up)
 * @param maxAgeMs   umur maksimum cache; null = FILE_URI_TTL_MS
 * @return {{status:'ok'|'pending'|'toolarge'|'failed', uri?:string, mimeType?:string}}
 */
function ensureGeminiFile_(meta, startedAt, maxAgeMs) {
  const maxAge = maxAgeMs || FILE_URI_TTL_MS;
  const now = Date.now();

  let cached = readFileCache_(meta.id);
  if (isCacheFresh_(cached, meta, now, maxAge)) {
    return { status: "ok", uri: cached.uri, mimeType: cached.mime };
  }

  if (meta.size / (1024 * 1024) > MAX_FILE_MB) return { status: "toolarge" };

  // Upload pertama kali bisa lama. Kalau anggaran waktu habis, tunda file ini
  // (akan di-upload di pertanyaan berikutnya / warm-up) daripada membuat user timeout.
  if (startedAt && (now - startedAt) > UPLOAD_PHASE_BUDGET_MS) return { status: "pending" };

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { status: "pending" };
  try {
    // Cek ulang: request lain mungkin baru saja mengupload file yang sama.
    cached = readFileCache_(meta.id);
    if (isCacheFresh_(cached, meta, Date.now(), maxAge)) {
      return { status: "ok", uri: cached.uri, mimeType: cached.mime };
    }

    const file = DriveApp.getFileById(meta.id);
    const uploaded = uploadFileToGemini_(file.getBlob(), meta.name, meta.size);
    writeFileCache_(meta.id, { uri: uploaded.uri, mime: uploaded.mimeType, up: Date.now(), upd: meta.updated, name: meta.name });
    return { status: "ok", uri: uploaded.uri, mimeType: uploaded.mimeType };
  } catch (err) {
    console.error('Upload "' + meta.name + '" gagal: ' + errMessage_(err));
    return { status: "failed" };
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------ GEMINI FILES API ------------------------------ */

function uploadFileToGemini_(blob, displayName, fileSizeBytes) {
  const apiKey = getApiKey_();
  const mimeType = blob.getContentType();

  const startResponse = UrlFetchApp.fetch(GEMINI_BASE + "/upload/v1beta/files", {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-goog-api-key": apiKey,
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(fileSizeBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType
    },
    payload: JSON.stringify({ file: { display_name: displayName } }),
    muteHttpExceptions: true
  });

  const uploadUrl = getHeaderCaseInsensitive_(startResponse.getHeaders(), "x-goog-upload-url");
  if (!uploadUrl) {
    throw new Error('Gagal memulai upload Gemini untuk "' + displayName + '": [' +
      startResponse.getResponseCode() + "] " + shortError_(startResponse.getContentText()));
  }

  const uploadResponse = UrlFetchApp.fetch(uploadUrl, {
    method: "post",
    contentType: mimeType,
    headers: { "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
    payload: blob,
    muteHttpExceptions: true
  });

  let result;
  try {
    result = JSON.parse(uploadResponse.getContentText());
  } catch (e) {
    throw new Error('Upload Gemini untuk "' + displayName + '" mengembalikan respons tidak valid.');
  }
  if (!result.file || !result.file.uri) {
    throw new Error('Upload Gemini gagal untuk "' + displayName + '": ' + shortError_(uploadResponse.getContentText()));
  }

  const file = waitUntilFileActive_(result.file, apiKey, displayName);
  return { uri: file.uri, mimeType: file.mimeType || mimeType };
}

/** File baru kadang berstatus PROCESSING; harus ACTIVE sebelum dipakai di generateContent. */
function waitUntilFileActive_(file, apiKey, displayName) {
  let current = file;
  for (let i = 0; i < 10 && current.state === "PROCESSING"; i++) {
    Utilities.sleep(1000);
    const resp = UrlFetchApp.fetch(GEMINI_BASE + "/v1beta/" + current.name, {
      method: "get",
      headers: { "x-goog-api-key": apiKey },
      muteHttpExceptions: true
    });
    try { current = JSON.parse(resp.getContentText()); } catch (e) { break; }
  }
  if (current.state === "FAILED") {
    throw new Error('Gemini gagal memproses file "' + displayName + '".');
  }
  return current;
}

function getHeaderCaseInsensitive_(headers, name) {
  const target = name.toLowerCase();
  for (const key in headers) {
    if (key.toLowerCase() === target) return headers[key];
  }
  return null;
}

/* ------------------------------ PANGGIL GEMINI (RETRY + FALLBACK) ------------------------------ */

function getModelChain_() {
  const raw = PropertiesService.getScriptProperties().getProperty("GEMINI_MODEL_CHAIN");
  if (raw) {
    const list = raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (list.length) return list;
  }
  return DEFAULT_MODEL_CHAIN;
}

/**
 * Memanggil Gemini dengan retry (exponential backoff) dan pindah ke model cadangan.
 * Melempar Error (BUKAN mengembalikan teks error) supaya doPost mengirim {error}.
 *   err.exhausted   = semua model & percobaan sudah habis (frontend tidak perlu retry otomatis)
 *   err.fileProblem = URI file di cache ditolak Gemini (caller membuang cache & mengulang)
 */
function callGeminiWithFallback_(systemInstruction, history, libraryParts, question, startedAt) {
  const apiKey = getApiKey_();

  const contents = history.map(function (h) {
    return { role: h.role, parts: [{ text: h.text }] };
  });
  contents.push({
    role: "user",
    parts: libraryParts.concat([{ text: "PERTANYAAN BARU USER: " + question }])
  });

  const payload = JSON.stringify({
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: contents,
    generationConfig: { temperature: 0.2, maxOutputTokens: 8192 }
  });

  const chain = getModelChain_();
  let lastMessage = "Tidak ada respons dari Gemini.";

  outer:
  for (let m = 0; m < chain.length; m++) {
    const model = chain[m];
    const url = GEMINI_BASE + "/v1beta/models/" + model + ":generateContent";

    for (let attempt = 1; attempt <= GEMINI_ATTEMPTS_PER_MODEL; attempt++) {
      if (Date.now() - startedAt > REQUEST_BUDGET_MS) break outer;

      let code, body;
      try {
        const resp = UrlFetchApp.fetch(url, {
          method: "post",
          contentType: "application/json",
          headers: { "x-goog-api-key": apiKey },
          payload: payload,
          muteHttpExceptions: true // 503 tidak melempar exception mentah; ditangani di bawah
        });
        code = resp.getResponseCode();
        body = resp.getContentText();
      } catch (netErr) {
        lastMessage = "Gagal menghubungi Gemini (" + model + "): " + shortError_(errMessage_(netErr));
        if (attempt < GEMINI_ATTEMPTS_PER_MODEL) sleepBackoff_(attempt, startedAt);
        continue;
      }

      if (code === 200) {
        const parsed = parseGeminiResponse_(body);
        if (parsed.text) return parsed.text;
        if (parsed.blocked) throw new Error(parsed.message); // diblokir filter: model lain pun akan sama
        lastMessage = "Respons Gemini kosong (" + model + ").";
        continue outer; // kosong bukan soal kapasitas: coba model berikutnya, jangan ulang yang sama
      }

      const apiMsg = shortError_(body);
      lastMessage = "HTTP " + code + " (" + model + "): " + apiMsg;
      console.log("Gemini " + lastMessage);

      // URI file di cache kedaluwarsa/terhapus -> minta caller membuang cache lalu mengulang.
      if ((code === 400 || code === 403 || code === 404) && /files\/|\bfile\b/i.test(apiMsg)) {
        const fileErr = new Error(lastMessage);
        fileErr.fileProblem = true;
        throw fileErr;
      }

      if (code === 404) continue outer; // model sudah dimatikan/nama salah: lanjut ke model cadangan

      if (GEMINI_RETRYABLE_CODES.indexOf(code) === -1) {
        throw new Error(lastMessage); // 400/401/403 lain = permanen (key salah, request salah), jangan diulang
      }

      if (attempt < GEMINI_ATTEMPTS_PER_MODEL) sleepBackoff_(attempt, startedAt);
    }
  }

  const exhausted = new Error("Semua model Gemini sedang sibuk atau gagal. Terakhir: " + lastMessage);
  exhausted.exhausted = true;
  throw exhausted;
}

function sleepBackoff_(attempt, startedAt) {
  const delay = GEMINI_BACKOFF_MS * attempt + Math.floor(Math.random() * 500);
  // Jangan tidur kalau sisa anggaran waktu tidak cukup untuk percobaan berikutnya.
  if (Date.now() - startedAt + delay < REQUEST_BUDGET_MS) Utilities.sleep(delay);
}

function parseGeminiResponse_(body) {
  let data;
  try {
    data = JSON.parse(body);
  } catch (e) {
    return { text: "" };
  }

  if (data.promptFeedback && data.promptFeedback.blockReason) {
    return {
      text: "",
      blocked: true,
      message: "Pertanyaan tidak dapat diproses oleh filter keamanan Gemini (" +
        data.promptFeedback.blockReason + "). Coba ubah susunan kalimat pertanyaan."
    };
  }

  const cand = data.candidates && data.candidates[0];
  if (!cand || !cand.content || !cand.content.parts) {
    if (cand && cand.finishReason && cand.finishReason !== "STOP") {
      return {
        text: "",
        blocked: true,
        message: "Gemini tidak menghasilkan jawaban (alasan: " + cand.finishReason + "). Coba ubah susunan kalimat pertanyaan."
      };
    }
    return { text: "" };
  }

  // Lewati bagian "thought" (proses berpikir internal) bila ada.
  let text = cand.content.parts
    .filter(function (p) { return !p.thought; })
    .map(function (p) { return p.text || ""; })
    .join("")
    .trim();

  if (text && cand.finishReason === "MAX_TOKENS") {
    text += '\n\n_(Jawaban terpotong karena terlalu panjang. Ketik "lanjutkan" agar AI meneruskan.)_';
  }
  return { text: text };
}

/* ------------------------------ SYSTEM INSTRUCTION ------------------------------ */

function buildSystemInstruction_(fileNames) {
  return `Anda adalah AI Operations Assistant MR.DIY yang cerdas, ramah, hangat, dan komunikatif seperti rekan kerja yang enak diajak bicara.

Pustaka Dokumen Perusahaan yang tersedia saat ini: ${fileNames.join(", ") || "(belum ada dokumen di pustaka)"}.

PANDUAN BERSIKAP & MENJAWAB:

1. OBROLAN UMUM & SAPAAN (LUWES & MANUSIAWI):
   Jika pengguna menyapa, basa-basi, atau bertanya hal di luar ranah kerja/SOP, jawablah dengan ramah, natural, dan hangat layaknya asisten yang humanis. Tidak perlu kaku atau formal berlebihan di percakapan seperti ini.

2. PERTANYAAN TEKNIS, SOP, JUKNIS, & PROSEDUR KERJA (WAJIB DARI DOKUMEN, TANPA KECUALI):
   * Untuk pertanyaan seputar SOP, juknis, prosedur kerja, aturan, atau kebijakan operasional MR.DIY, Anda WAJIB menjawab HANYA berdasarkan isi dokumen pustaka yang dilampirkan (baik dokumen teks maupun PDF/gambar hasil scan yang Anda baca langsung).
   * Baca dengan teliti seluruh teks maupun visual/PDF scan yang dilampirkan sebelum menjawab.
   * DILARANG KERAS menjawab dari pengetahuan umum/pelatihan Anda sendiri, DILARANG mengarang kebijakan toko, dan DILARANG mencari atau mengasumsikan informasi dari sumber di luar pustaka ini, sekalipun Anda merasa "tahu" jawabannya secara umum.
   * Jika suatu prosedur yang ditanyakan benar-benar TIDAK ADA di dalam dokumen pustaka yang tersedia, sampaikan dengan jujur dan ramah, misalnya: "Maaf, untuk detail prosedur tersebut belum tercantum di dokumen SOP/Handbook yang ada di Pustaka saat ini."
   * Jika di daftar pustaka ada dokumen berstatus "(sedang disiapkan...)", "(dilewati...)" atau "(gagal dibaca)" dan dokumen itu kemungkinan relevan dengan pertanyaan, beri tahu user dengan jujur bahwa dokumen tersebut belum bisa dibaca saat ini (untuk "sedang disiapkan", sarankan bertanya lagi sebentar lagi). Jangan menebak isinya.

3. WAJIB SITASI SUMBER UNTUK SETIAP JAWABAN TEKNIS/SOP:
   Setiap kali menjawab pertanyaan seputar SOP, juknis, prosedur, atau kebijakan kerja, WAJIB tambahkan blok referensi di akhir jawaban dengan format:
     **Sumber Dokumen**: [nama file dokumen persis, misal: "Retail Operations Handbook 2023.pdf"]
     **Halaman / Bagian**: [nomor halaman PDF, bab, atau poin pasal yang spesifik agar bisa dicek ulang oleh user]

4. ISTILAH RESMI INTERNAL:
   Gunakan istilah internal resmi MR.DIY (Kepala Toko, Supervisor, Assistant Supervisor, ABM, BM), hindari istilah eksternal seperti "Store Manager".

5. MEMORI PERCAKAPAN:
   Perhatikan riwayat percakapan agar bisa merespons pertanyaan lanjutan/revisi tanpa meminta user mengulang pertanyaan sebelumnya.`;
}

/* ------------------------------ DIAGNOSTIK ------------------------------ */

function debugListLibrary_() {
  const index = getLibraryIndex_(true); // selalu telusuri ulang (abaikan cache)
  return {
    rootFolderId: FOLDER_ID,
    totalFilesFound: index.length,
    supportedFiles: index.filter(isSupported_).length,
    files: index.map(function (f) {
      return {
        name: f.name,
        subFolderPath: f.path,
        mimeType: f.mime,
        sizeMB: (f.size / (1024 * 1024)).toFixed(2),
        lastUpdated: new Date(f.updated),
        dibaca: isSupported_(f),
        cacheGemini: isPdfOrImage_(f.mime) ? describeCache_(f) : "-"
      };
    })
  };
}

function describeCache_(meta) {
  const c = readFileCache_(meta.id);
  if (!c) return "belum diupload";
  if (c.upd !== meta.updated) return "kedaluwarsa (file berubah)";
  const ageH = (Date.now() - c.up) / 3600000;
  return ageH < FILE_URI_TTL_MS / 3600000 ? "siap (" + ageH.toFixed(1) + " jam lalu)" : "kedaluwarsa (> 47 jam)";
}

function debugStatus_() {
  const props = PropertiesService.getScriptProperties().getKeys();
  return {
    apiKeyTerpasang: !!getApiKey_(),
    modelChain: getModelChain_(),
    fileTerCacheDiGemini: props.filter(function (k) { return k.indexOf(FILE_PROP_PREFIX) === 0; }).length,
    batas: { maxFiles: MAX_FILES, requestBudgetMs: REQUEST_BUDGET_MS, uploadPhaseBudgetMs: UPLOAD_PHASE_BUDGET_MS }
  };
}

function clearAllCaches_() {
  CacheService.getScriptCache().remove(LIST_CACHE_KEY);
  const props = PropertiesService.getScriptProperties();
  let removed = 0;
  props.getKeys().forEach(function (k) {
    if (k.indexOf(FILE_PROP_PREFIX) === 0) { props.deleteProperty(k); removed++; }
  });
  return { ok: true, cacheUploadDibuang: removed };
}

/* ------------------------------ WARM-UP (LATAR BELAKANG) ------------------------------ */

/**
 * Menyiapkan (upload) semua PDF/gambar ke Gemini lebih dulu, dan memperbarui yang
 * hampir kedaluwarsa, supaya user tidak menunggu upload saat bertanya.
 * Jalankan manual sekali dari editor Apps Script, atau pasang trigger otomatis
 * lewat installWarmupTrigger().
 */
function warmUpLibrary() {
  const startedAt = Date.now();
  const WARMUP_LIMIT_MS = 5 * 60 * 1000; // batas eksekusi Apps Script 6 menit; sisakan margin
  const index = getLibraryIndex_(true);
  const targets = index
    .filter(function (f) { return isPdfOrImage_(f.mime); })
    .sort(function (a, b) { return b.updated - a.updated; })
    .slice(0, MAX_WARM_FILES);

  let ready = 0, failed = 0, skipped = 0;
  for (let i = 0; i < targets.length; i++) {
    if (Date.now() - startedAt > WARMUP_LIMIT_MS) { skipped = targets.length - i; break; }
    // startedAt=null: tanpa anggaran waktu request. Perbarui kalau umur cache > 40 jam.
    const res = ensureGeminiFile_(targets[i], null, WARMUP_REFRESH_AFTER_MS);
    if (res.status === "ok") ready++; else if (res.status !== "toolarge") failed++;
  }

  cleanupOrphanFileCache_(index);
  const summary = { siap: ready, gagal: failed, belumSempatDiproses: skipped, totalTarget: targets.length };
  console.log("warmUpLibrary selesai: " + JSON.stringify(summary));
  return summary;
}

/** Buang entri cache untuk file yang sudah tidak ada di folder. */
function cleanupOrphanFileCache_(index) {
  const alive = {};
  index.forEach(function (f) { alive[f.id] = true; });
  const props = PropertiesService.getScriptProperties();
  props.getKeys().forEach(function (k) {
    if (k.indexOf(FILE_PROP_PREFIX) === 0 && !alive[k.substring(FILE_PROP_PREFIX.length)]) {
      props.deleteProperty(k);
    }
  });
}

/** Jalankan SEKALI dari editor untuk memasang warm-up otomatis tiap 6 jam. */
function installWarmupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "warmUpLibrary") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("warmUpLibrary").timeBased().everyHours(6).create();
  return "Trigger warmUpLibrary terpasang (setiap 6 jam).";
}

/* ------------------------------ UTILITAS ------------------------------ */

function getApiKey_() {
  return PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
}

function errMessage_(err) {
  return err && err.message ? String(err.message) : String(err);
}

/** Ambil pesan error ringkas dari body respons Gemini (JSON atau teks mentah). */
function shortError_(body) {
  try {
    const data = JSON.parse(body);
    if (data.error && data.error.message) return String(data.error.message).substring(0, 250);
  } catch (e) { /* bukan JSON */ }
  return String(body).substring(0, 250);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
