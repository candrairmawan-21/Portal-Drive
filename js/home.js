/* ==========================================================================
   BERANDA "HARI INI" + NAVIGASI BAWAH (HP)  --  Roadmap Tahap 2
   --------------------------------------------------------------------------
   Halaman pertama setelah login (kecuali role guest). Berisi tiga kartu:
     1. Sales MTD       -> dihitung dari tab Store Submission bulan berjalan
     2. UPT             -> rata-rata UPT staff bulan berjalan (sheet Summary UPT)
     3. Tugas           -> tugas monitoring yang belum dikerjakan (BM/ABM/admin)

   Prinsip yang dijaga file ini:
   - TIDAK mengubah state modul lain. Data diambil lewat fetch sendiri dan
     diparse dengan parser yang sudah ada (parseSalesCSV, parseDashboardCSV).
     Satu-satunya state global yang disentuh adalah `dashboardMonthColumns`
     (diisi parseDashboardCSV) -- nilainya disimpan & dipulihkan di tempat.
   - Setiap kartu gagal sendiri-sendiri: kalau satu sumber error, kartu itu
     menampilkan pesan + tombol "Coba lagi", kartu lain tetap jalan.
   - Semua teks dari sheet di-escape sebelum masuk innerHTML.
   - Seluruh kode ada di dalam IIFE, jadi tidak ada nama yang bentrok dengan
     file JS lain. Yang diekspos ke window hanya 3 fungsi (di akhir file).
   - Tidak ada interval/timer baru. Kartu Tugas ikut diperbarui oleh polling
     5 detik milik monitoring.js (lewat hook renderHomeTasksCard).
   ========================================================================== */
(function () {
    'use strict';

    /* ---------------------------------------------------------------------
       KONFIGURASI
       --------------------------------------------------------------------- */
    const HOME_CACHE_MS = 3 * 60 * 1000;       // data Sales/UPT dipakai ulang 3 menit
    const HOME_TASK_PREVIEW_MAX = 3;

    const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const MONTH_LABEL = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

    const cache = {
        sales: { at: 0, data: null, inflight: null },
        upt: { at: 0, data: null, inflight: null }
    };
    let tasksLoadedOnce = false;

    /* ---------------------------------------------------------------------
       HELPER UMUM
       --------------------------------------------------------------------- */
    function byId(id) { return document.getElementById(id); }

    function esc(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function fmtRp(n) { return 'Rp ' + Math.round(Number(n) || 0).toLocaleString('id-ID'); }

    function fmtNum(n, decimals) {
        const d = decimals || 0;
        return (Number(n) || 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
    }

    function getRole() { return (sessionStorage.getItem('portalRole') || '').toLowerCase().trim(); }
    function getUser() { return (sessionStorage.getItem('portalUser') || '').toLowerCase().trim(); }

    function monthKeyOf(date) { return MONTH_ABBR[date.getMonth()] + String(date.getFullYear()).slice(-2); }

    function monthSortOf(key) {
        const m = /^([A-Za-z]{3})(\d{2})$/.exec(String(key || ''));
        if (!m) return 0;
        const idx = MONTH_ABBR.findIndex(a => a.toLowerCase() === m[1].toLowerCase());
        return idx < 0 ? 0 : (2000 + parseInt(m[2], 10)) * 12 + idx;
    }

    function monthLabelOfKey(key) {
        const m = /^([A-Za-z]{3})(\d{2})$/.exec(String(key || ''));
        if (!m) return String(key || '');
        const idx = MONTH_ABBR.findIndex(a => a.toLowerCase() === m[1].toLowerCase());
        return idx < 0 ? String(key) : MONTH_LABEL[idx] + ' 20' + m[2];
    }

    function mutedHtml(text) {
        return '<p class="text-sm font-semibold text-slate-400 py-2">' + esc(text) + '</p>';
    }

    function errorHtml(text) {
        return '<p class="text-sm font-semibold text-rose-600">' + esc(text) + '</p>' +
            '<button type="button" onclick="loadHomeDashboard(true)" ' +
            'class="mt-2 text-xs font-bold text-amber-600 hover:text-amber-700">Coba lagi</button>';
    }

    function refreshIcons() {
        try { if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons(); } catch (e) { /* ikon tidak kritis */ }
    }

    /** Pakai data cache kalau masih segar; satu request per sumber pada satu waktu. */
    function cached(slot, force, producer) {
        const s = cache[slot];
        if (!force && s.data && (Date.now() - s.at) < HOME_CACHE_MS) return Promise.resolve(s.data);
        if (s.inflight) return s.inflight;
        s.inflight = producer().then(function (data) {
            s.data = data;
            s.at = Date.now();
            return data;
        }).finally(function () { s.inflight = null; });
        return s.inflight;
    }

    /* ---------------------------------------------------------------------
       HEADER: SAPAAN + TANGGAL
       --------------------------------------------------------------------- */
    function prettyName(raw) {
        const name = String(raw || '').trim();
        if (!name) return 'Tim';
        if (/^[a-z]{2}\d{4}$/i.test(name)) return name.toUpperCase();   // kode toko, mis. JC2017
        return name.split(/\s+/).map(function (w) {
            const lower = w.toLowerCase();
            if (lower === 'bm' || lower === 'abm') return lower.toUpperCase();
            return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }).join(' ');
    }

    function renderHeader() {
        const now = new Date();
        const h = now.getHours();
        const greeting = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 19 ? 'Selamat sore' : 'Selamat malam';
        const greetEl = byId('homeGreeting');
        const dateEl = byId('homeDate');
        if (greetEl) greetEl.textContent = greeting + ', ' + prettyName(sessionStorage.getItem('portalUser'));
        if (dateEl) {
            dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        }
    }

    /* ---------------------------------------------------------------------
       KARTU 1: SALES MTD
       --------------------------------------------------------------------- */
    /** Pilih key bulan yang GID-nya ada: bulan berjalan, atau bulan terbaru yang tidak melewati bulan berjalan. */
    function pickSalesKey(curKey) {
        if (SHEET_GIDS[curKey]) return curKey;
        const curSort = monthSortOf(curKey);
        const keys = Object.keys(SHEET_GIDS)
            .filter(function (k) { return monthSortOf(k) > 0; })
            .sort(function (a, b) { return monthSortOf(b) - monthSortOf(a); });
        return keys.find(function (k) { return monthSortOf(k) <= curSort; }) || keys[0] || null;
    }

    async function fetchSales() {
        if (typeof SALES_BASE_URL === 'undefined' || typeof SHEET_GIDS === 'undefined' || typeof parseSalesCSV !== 'function') {
            throw new Error('Modul Sales belum siap.');
        }
        const curKey = monthKeyOf(new Date());
        const key = pickSalesKey(curKey);
        if (!key) throw new Error('GID bulan Sales tidak ditemukan.');

        const res = await fetch(SALES_BASE_URL + '&gid=' + SHEET_GIDS[key] + '&t=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text.trim()) throw new Error('CSV Sales kosong.');

        const rows = parseSalesCSV(text, 'SUBMISSION') || [];
        let sales = 0, target = 0, achieved = 0;
        rows.forEach(function (r) {
            sales += Number(r.mtdSales) || 0;
            target += Number(r.mtdTarget) || 0;
            if ((Number(r.achPercent) || 0) >= 100) achieved++;
        });
        return {
            key: key,
            isFallback: key !== curKey,
            sales: sales,
            target: target,
            ach: target > 0 ? (sales / target) * 100 : 0,
            achieved: achieved,
            count: rows.length
        };
    }

    function renderSalesCard(d) {
        const body = byId('home-sales-body');
        const period = byId('home-sales-period');
        if (!body) return;
        if (period) period.textContent = monthLabelOfKey(d.key);

        if (!d.count) {
            body.innerHTML = mutedHtml('Belum ada data sales untuk ' + monthLabelOfKey(d.key) + '.');
            return;
        }
        const barPct = Math.max(0, Math.min(100, d.ach));
        const note = d.isFallback
            ? '<p class="mt-2 text-[11px] font-semibold text-amber-700">Data bulan berjalan belum tersedia; menampilkan ' + esc(monthLabelOfKey(d.key)) + '.</p>'
            : '';
        body.innerHTML =
            '<p class="text-2xl font-black text-slate-900 tabular-nums">' + esc(fmtRp(d.sales)) + '</p>' +
            '<p class="text-xs font-semibold text-slate-500 mt-1">dari target ' + esc(d.target > 0 ? fmtRp(d.target) : '-') + '</p>' +
            '<div class="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden"><div class="h-full bg-amber-500" style="width:' + barPct.toFixed(1) + '%"></div></div>' +
            '<div class="flex items-center justify-between gap-2 mt-2 text-xs font-bold">' +
            '<span class="text-slate-800 tabular-nums">Ach ' + esc(fmtNum(d.ach, 1)) + '%</span>' +
            '<span class="text-slate-500 tabular-nums">' + esc(d.achieved) + ' dari ' + esc(d.count) + ' toko &ge; 100%</span>' +
            '</div>' + note;
    }

    async function loadSalesCard(force) {
        const body = byId('home-sales-body');
        if (!body) return;
        try {
            renderSalesCard(await cached('sales', force, fetchSales));
        } catch (err) {
            console.error('[Beranda] Sales gagal dimuat:', err);
            body.innerHTML = errorHtml('Gagal memuat data sales.');
        }
    }

    /* ---------------------------------------------------------------------
       KARTU 2: UPT
       --------------------------------------------------------------------- */
    async function fetchUpt() {
        if (typeof DASHBOARD_API_URL === 'undefined' || typeof parseDashboardCSV !== 'function') {
            throw new Error('Modul UPT belum siap.');
        }
        const res = await fetch(DASHBOARD_API_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const text = await res.text();
        if (!text.trim()) throw new Error('CSV UPT kosong.');

        // parseDashboardCSV mengisi `dashboardMonthColumns` (state milik halaman Performa UPT).
        // Simpan nilai lama, ambil yang kita butuhkan, lalu pulihkan -- semuanya sinkron,
        // jadi tidak mungkin terselip di antara dua pemanggilan lain.
        const hasColumnsVar = typeof dashboardMonthColumns !== 'undefined';
        const previousColumns = hasColumnsVar ? dashboardMonthColumns : null;
        let rows, columns;
        try {
            rows = parseDashboardCSV(text) || [];
            columns = hasColumnsVar && Array.isArray(dashboardMonthColumns) ? dashboardMonthColumns.slice() : [];
        } finally {
            if (hasColumnsVar) dashboardMonthColumns = previousColumns;
        }

        const key = monthKeyOf(new Date());
        const hasColumn = columns.some(function (c) { return c.key === key; });
        let sum = 0, count = 0, top = null;
        rows.forEach(function (r) {
            const v = (r && r.uptByMonth && Number(r.uptByMonth[key])) || 0;
            if (v > 0) {
                sum += v;
                count++;
                if (!top || v > top.value) top = { value: v, staff: r.namaStaff || '-', store: r.namaStore || '-' };
            }
        });
        return { key: key, hasColumn: hasColumn, count: count, avg: count ? sum / count : 0, top: top };
    }

    function renderUptCard(d) {
        const body = byId('home-upt-body');
        const period = byId('home-upt-period');
        if (!body) return;
        if (period) period.textContent = monthLabelOfKey(d.key);

        if (!d.count) {
            body.innerHTML = mutedHtml(d.hasColumn
                ? 'Belum ada nilai UPT untuk ' + monthLabelOfKey(d.key) + '.'
                : 'Kolom UPT ' + monthLabelOfKey(d.key) + ' belum ada di sheet.');
            return;
        }
        const topHtml = d.top
            ? '<p class="mt-3 text-xs font-semibold text-slate-500">Tertinggi: <span class="font-black text-slate-800">' + esc(d.top.staff) +
              '</span> (' + esc(d.top.store) + ') <span class="tabular-nums font-black text-slate-800">' + esc(fmtNum(d.top.value, 2)) + '</span></p>'
            : '';
        body.innerHTML =
            '<p class="text-2xl font-black text-slate-900 tabular-nums">' + esc(fmtNum(d.avg, 2)) + '</p>' +
            '<p class="text-xs font-semibold text-slate-500 mt-1">rata-rata UPT &middot; ' + esc(d.count) + ' staff terdata</p>' +
            topHtml;
    }

    async function loadUptCard(force) {
        const body = byId('home-upt-body');
        if (!body) return;
        try {
            renderUptCard(await cached('upt', force, fetchUpt));
        } catch (err) {
            console.error('[Beranda] UPT gagal dimuat:', err);
            body.innerHTML = errorHtml('Gagal memuat data UPT.');
        }
    }

    /* ---------------------------------------------------------------------
       KARTU 3: TUGAS  (memakai data & fungsi milik monitoring.js, tanpa fetch sendiri)
       --------------------------------------------------------------------- */
    function taskBadge(label, overdue) {
        const cls = overdue ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
        return '<span class="shrink-0 px-2 py-0.5 rounded-md border text-[10px] font-bold ' + cls + '">' + esc(label) + '</span>';
    }

    function renderTasksCard(loaded) {
        try {
            if (loaded === true) tasksLoadedOnce = true;
            const card = byId('home-card-tasks');
            const body = byId('home-tasks-body');
            if (!card || !body) return;

            const role = getRole();
            const me = getUser();
            if (role === 'staff' || role === 'guest') { card.classList.add('hidden'); return; }
            card.classList.remove('hidden');

            const ready = typeof allMonitoringTasks !== 'undefined' && Array.isArray(allMonitoringTasks) &&
                typeof SYSTEM_TEAM !== 'undefined' && typeof getAssignedUsersForTask === 'function' &&
                typeof getTaskTemporalStatusForUser === 'function';
            if (!ready) { body.innerHTML = mutedHtml('Data tugas belum siap.'); return; }
            if (!allMonitoringTasks.length && !tasksLoadedOnce) return;   // biarkan skeleton sampai fetch pertama selesai

            if (role === 'admin' || me === 'admin') {
                renderTasksAdmin(body);
            } else {
                renderTasksPersonal(body, me, role);
            }
        } catch (err) {
            console.error('[Beranda] Kartu tugas gagal dirender:', err);
            const body = byId('home-tasks-body');
            if (body) body.innerHTML = mutedHtml('Tugas tidak dapat ditampilkan saat ini.');
        }
    }

    /** BM/ABM: tugas milik sendiri yang jatuh tempo hari ini / terlambat dan belum selesai. */
    function renderTasksPersonal(body, me, role) {
        const meObj = SYSTEM_TEAM.find(function (u) { return u.username === me; }) || { username: me, name: me, role: role };
        const pending = [];
        allMonitoringTasks.forEach(function (task) {
            if (!task || !task.Jenis_Tugas) return;
            const assigned = getAssignedUsersForTask(task);
            const mine = assigned.some(function (u) { return u.username === me || String(u.role).toLowerCase() === role; });
            if (!mine) return;
            const st = getTaskTemporalStatusForUser(task, meObj);
            if (st.code === 'TODAY' || st.code === 'OVERDUE') pending.push({ task: task, st: st });
        });

        if (!pending.length) {
            body.innerHTML =
                '<p class="text-2xl font-black text-slate-900 tabular-nums">0</p>' +
                '<p class="text-xs font-semibold text-slate-500 mt-1">tidak ada tugas yang menunggu hari ini</p>';
            return;
        }
        pending.sort(function (a, b) { return (a.st.code === 'OVERDUE' ? 0 : 1) - (b.st.code === 'OVERDUE' ? 0 : 1); });
        const overdue = pending.filter(function (p) { return p.st.code === 'OVERDUE'; }).length;
        const today = pending.length - overdue;

        const items = pending.slice(0, HOME_TASK_PREVIEW_MAX).map(function (p) {
            return '<li class="flex items-center justify-between gap-2 py-1.5">' +
                '<span class="min-w-0 text-xs font-bold text-slate-700 truncate">' + esc(p.task.Judul_Tugas || '-') + '</span>' +
                taskBadge(p.st.code === 'OVERDUE' ? 'Terlambat' : 'Hari ini', p.st.code === 'OVERDUE') + '</li>';
        }).join('');
        const more = pending.length > HOME_TASK_PREVIEW_MAX
            ? '<p class="text-[11px] font-semibold text-slate-400 mt-1">+' + (pending.length - HOME_TASK_PREVIEW_MAX) + ' tugas lainnya</p>' : '';

        body.innerHTML =
            '<p class="text-2xl font-black text-slate-900 tabular-nums">' + pending.length + '</p>' +
            '<p class="text-xs font-semibold text-slate-500 mt-1">tugas menunggu &middot; ' + overdue + ' terlambat &middot; ' + today + ' hari ini</p>' +
            '<ul class="mt-3 divide-y divide-slate-100">' + items + '</ul>' + more;
    }

    /** Admin: ringkasan seluruh tim (pasangan tugas-orang yang belum dikerjakan). */
    function renderTasksAdmin(body) {
        let pairs = 0;
        const perUser = {};
        allMonitoringTasks.forEach(function (task) {
            if (!task || !task.Jenis_Tugas) return;
            getAssignedUsersForTask(task).forEach(function (u) {
                const st = getTaskTemporalStatusForUser(task, u);
                if (st.code === 'TODAY' || st.code === 'OVERDUE') {
                    pairs++;
                    const k = u.username || u.name || '-';
                    if (!perUser[k]) perUser[k] = { name: u.name || k, n: 0 };
                    perUser[k].n++;
                }
            });
        });
        const people = Object.keys(perUser).map(function (k) { return perUser[k]; })
            .sort(function (a, b) { return b.n - a.n; });

        if (!pairs) {
            body.innerHTML =
                '<p class="text-2xl font-black text-slate-900 tabular-nums">0</p>' +
                '<p class="text-xs font-semibold text-slate-500 mt-1">semua tugas tim hari ini sudah selesai</p>';
            return;
        }
        const items = people.slice(0, HOME_TASK_PREVIEW_MAX).map(function (p) {
            return '<li class="flex items-center justify-between gap-2 py-1.5">' +
                '<span class="min-w-0 text-xs font-bold text-slate-700 truncate">' + esc(p.name) + '</span>' +
                '<span class="shrink-0 text-xs font-black text-slate-800 tabular-nums">' + p.n + ' tugas</span></li>';
        }).join('');
        const more = people.length > HOME_TASK_PREVIEW_MAX
            ? '<p class="text-[11px] font-semibold text-slate-400 mt-1">+' + (people.length - HOME_TASK_PREVIEW_MAX) + ' orang lainnya</p>' : '';

        body.innerHTML =
            '<p class="text-2xl font-black text-slate-900 tabular-nums">' + pairs + '</p>' +
            '<p class="text-xs font-semibold text-slate-500 mt-1">tugas belum dikerjakan &middot; ' + people.length + ' orang</p>' +
            '<ul class="mt-3 divide-y divide-slate-100">' + items + '</ul>' + more;
    }

    /** Dipanggil dari monitoring.js setiap polling selesai; hanya bekerja kalau Beranda sedang tampil. */
    function renderHomeTasksCardFromPolling() {
        const section = byId('section-home');
        if (!section || section.classList.contains('hidden')) { tasksLoadedOnce = true; return; }
        renderTasksCard(true);
    }

    /* ---------------------------------------------------------------------
       PINTU MASUK: dipanggil switchView('home') dan tombol "Muat ulang"
       --------------------------------------------------------------------- */
    async function loadHomeDashboard(force) {
        const refreshBtn = byId('homeRefreshBtn');
        try {
            if (!byId('section-home')) return;
            if (refreshBtn) refreshBtn.classList.add('opacity-50', 'pointer-events-none');
            renderHeader();
            renderTasksCard();
            refreshIcons();
            await Promise.all([
                loadSalesCard(force === true),
                loadUptCard(force === true)
            ]);
        } catch (err) {
            console.error('[Beranda] Gagal memuat:', err);
        } finally {
            if (refreshBtn) refreshBtn.classList.remove('opacity-50', 'pointer-events-none');
        }
    }

    /* ---------------------------------------------------------------------
       NAVIGASI BAWAH (HP)
       Tampil hanya di layar < 768px (diatur css/style.css lewat class
       `has-bottom-nav` di <body>). Disembunyikan untuk guest dan untuk
       halaman AI SOP (kolom chat butuh tinggi penuh).
       --------------------------------------------------------------------- */
    function updateBottomNav(view) {
        try {
            const nav = byId('bottomNav');
            if (!nav) return;
            const role = getRole();
            const loggedIn = sessionStorage.getItem('portalLoggedIn') === 'true';
            const show = loggedIn && role !== 'guest' && view !== 'ai-sop';
            document.body.classList.toggle('has-bottom-nav', show);

            const tasksBtn = byId('bn-monitoring');
            if (tasksBtn) tasksBtn.classList.toggle('hidden', role === 'staff' || role === 'guest');

            nav.querySelectorAll('[data-bn-view]').forEach(function (btn) {
                const active = btn.getAttribute('data-bn-view') === view;
                btn.classList.toggle('text-amber-600', active);
                btn.classList.toggle('text-slate-500', !active);
                if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
            });
        } catch (err) {
            console.error('[Navigasi bawah] Gagal diperbarui:', err);
        }
    }

    /* ---------------------------------------------------------------------
       EKSPOR KE WINDOW (hanya yang dipakai file lain / atribut onclick)
       --------------------------------------------------------------------- */
    window.loadHomeDashboard = loadHomeDashboard;
    window.renderHomeTasksCard = renderHomeTasksCardFromPolling;
    window.updateBottomNav = updateBottomNav;
})();
