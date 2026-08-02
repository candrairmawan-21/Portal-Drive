/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (WIB FILTER & SUPERIOR DASHBOARD)
   ========================================================================== */
const MONITORING_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=1912450864&single=true&output=csv';
let allMonitoringTasks = [];
let currentTaskFilter = 'today'; 
let currentInboxFilter = 'today';

function getWIBDateInfo() {
    const now = new Date();
    const weekdayName = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long' }).format(now).toLowerCase();
    const dayNumber = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(now);
    return { weekdayName, dayNumber };
}

function isTaskForToday(task) {
    const jenis = (task.Jenis_Tugas || '').toLowerCase().trim();
    const jadwal = (task.Detail_Jadwal || '').trim().toLowerCase();
    const { weekdayName, dayNumber } = getWIBDateInfo();

    if (jenis.includes('mingguan')) {
        return jadwal === weekdayName;
    } else if (jenis.includes('bulanan')) {
        return jadwal === dayNumber;
    } else {
        return true;
    }
}

function changeTaskFilter(val) {
    currentTaskFilter = val;
    renderMonitoringTable();
}

function changeInboxFilter(val) {
    currentInboxFilter = val;
    toggleInboxModal(true);
}

async function fetchMonitoringData() {
    try {
        const response = await fetch(`${MONITORING_API_URL}&t=${Date.now()}`);
        const csvText = await response.text();
        allMonitoringTasks = parseCSV(csvText);
        renderMonitoringTable();
        updateInboxBadge();
    } catch (error) {
        console.error('Gagal mengambil data monitoring tugas:', error);
    }
}

/* ==========================================================================
   ROUTING TAMPILAN: ADMIN (SUPERIOR VIEW) VS STAFF/ABM/BM (USER VIEW)
   ========================================================================== */
function renderMonitoringTable() {
    const tbody = document.getElementById('monitoringTableBody');
    if (!tbody) return;

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    // 1. JIKA ADMIN / SUPERIOR: Tampilkan Executive Progress Dashboard
    if (userRole === 'admin' || loggedInUser === 'admin') {
        renderSuperiorDashboard(tbody);
        return;
    }

    // 2. JIKA ABM / BM: Tampilkan Tabel Tugasan Pribadi seperti biasa
    renderUserTaskTable(tbody, loggedInUser, userRole);
}

/* ==========================================================================
   TAMPILAN KHUSUS ADMIN / SUPERIOR: PROGRESS COMPLETION TIM
   ========================================================================== */
function renderSuperiorDashboard(tbody) {
    let tasks = [...allMonitoringTasks].filter(task => task.Jenis_Tugas && task.Jenis_Tugas.trim() !== '');

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Tidak ada data tugasan untuk periode waktu ini.</td></tr>`;
        return;
    }

    // Kelompokkan data berdasarkan Target_User (BM, ABM, dll)
    const userSummary = {};
    tasks.forEach(task => {
        const target = (task.Target_User || 'Umum').toUpperCase().trim();
        if (!userSummary[target]) {
            userSummary[target] = {
                total: 0,
                completed: 0,
                pending: 0,
                tasksList: []
            };
        }

        const isDone = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        userSummary[target].total += 1;
        if (isDone) {
            userSummary[target].completed += 1;
        } else {
            userSummary[target].pending += 1;
        }
        userSummary[target].tasksList.push({ ...task, isDone });
    });

    // 1. Buat Kartu Rangkuman Completion Rate per Target Role
    let summaryCardsHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 w-full">`;
    
    Object.keys(userSummary).sort().forEach(roleName => {
        const data = userSummary[roleName];
        const percentage = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        
        let barColor = 'bg-rose-500';
        let badgeStyle = 'bg-rose-50 text-rose-600 border-rose-200';
        if (percentage >= 100) {
            barColor = 'bg-emerald-500';
            badgeStyle = 'bg-emerald-50 text-emerald-600 border-emerald-200';
        } else if (percentage >= 50) {
            barColor = 'bg-amber-500';
            badgeStyle = 'bg-amber-50 text-amber-600 border-amber-200';
        }

        summaryCardsHTML += `
            <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                <div class="flex justify-between items-center mb-2">
                    <span class="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1.5">
                        <i data-lucide="users" class="w-3.5 h-3.5 text-amber-500"></i> TIM ${roleName}
                    </span>
                    <span class="text-xs font-black px-2.5 py-0.5 rounded-lg border ${badgeStyle}">
                        ${percentage}% Done
                    </span>
                </div>
                <div class="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-3">
                    <div class="${barColor} h-full transition-all duration-500 rounded-full" style="width: ${percentage}%"></div>
                </div>
                <div class="flex justify-between items-center text-[11px] font-bold text-slate-500 pt-2 border-t border-slate-100">
                    <span class="text-emerald-600 flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3 h-3"></i> Selesai: ${data.completed}</span>
                    <span class="text-amber-600 flex items-center gap-1"><i data-lucide="clock" class="w-3 h-3"></i> Pending: ${data.pending}</span>
                    <span>Total: ${data.total}</span>
                </div>
            </div>
        `;
    });
    summaryCardsHTML += `</div>`;

    // 2. Buat Tabel Detail Bawahan Siapa Saja yang Sudah Done vs Pending
    let rowsHTML = '';
    Object.keys(userSummary).sort().forEach((roleName, rIdx) => {
        const group = userSummary[roleName];
        
        // Baris Header Grup Role
        rowsHTML += `
            <tr class="bg-slate-100/80 font-black text-slate-700 border-y border-slate-200">
                <td colspan="7" class="py-3 px-4 text-xs uppercase tracking-wider">
                    <div class="flex items-center justify-between">
                        <span>👥 Target Role: ${roleName}</span>
                        <span class="text-[11px] font-bold text-slate-500">Progress: ${group.completed} / ${group.total} Selesai</span>
                    </div>
                </td>
            </tr>
        `;

        // Daftar Tugas per Role
        group.tasksList.forEach((task, index) => {
            const statusBadge = task.isDone 
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 font-extrabold rounded-lg border border-emerald-200/60 text-[11px]"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> SELESAI</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 font-extrabold rounded-lg border border-amber-200/60 text-[11px]"><i data-lucide="clock" class="w-3.5 h-3.5"></i> PENDING</span>`;

            rowsHTML += `
                <tr class="hover:bg-amber-50/20 transition-colors border-b border-slate-100 bg-white">
                    <td class="py-3.5 px-4 font-bold text-slate-600">${task.Jenis_Tugas || '-'}</td>
                    <td class="py-3.5 px-4 text-slate-500 font-medium">${task.Detail_Jadwal || '-'}</td>
                    <td class="py-3.5 px-4 font-extrabold text-amber-600 uppercase">${task.Target_User || '-'}</td>
                    <td class="py-3.5 px-4">
                        <p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p>
                        <p class="text-[11px] text-slate-400 mt-0.5">${task.Deskripsi || '-'}</p>
                    </td>
                    <td class="py-3.5 px-4">
                        <p class="text-xs font-semibold text-slate-700 italic bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                            "${task.Catatan_User || 'Belum ada catatan'}"
                        </p>
                    </td>
                    <td class="py-3.5 px-4 text-center">${statusBadge}</td>
                    <td class="py-3.5 px-4 text-center">
                        <span class="text-[11px] font-bold text-slate-400">Mode Pengawas</span>
                    </td>
                </tr>
            `;
        });
    });

    // Sisipkan Kartu Summary + Tabel Rincian ke dalam container
    const tableContainer = tbody.closest('table').parentElement;
    
    // Hapus summary card lama jika ada agar tidak duplikat saat filter berubah
    const existingSummary = document.getElementById('superiorSummaryContainer');
    if (existingSummary) existingSummary.remove();

    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'superiorSummaryContainer';
    summaryDiv.innerHTML = summaryCardsHTML;
    tableContainer.parentNode.insertBefore(summaryDiv, tableContainer);

    tbody.innerHTML = rowsHTML;
    lucide.createIcons();
}

/* ==========================================================================
   TAMPILAN KHUSUS USER (BM & ABM): TABEL TUGAS PRIBADI & REMARK
   ========================================================================== */
function renderUserTaskTable(tbody, loggedInUser, userRole) {
    // Bersihkan kartu summary Admin jika sebelumnya tertinggal di DOM
    const existingSummary = document.getElementById('superiorSummaryContainer');
    if (existingSummary) existingSummary.remove();

    let tasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const target = (task.Target_User || '').toLowerCase().trim();
        return target === loggedInUser || target === userRole;
    });

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Tidak ada tugasan aktif untuk Anda pada kriteria ini.</td></tr>`;
        return;
    }

    tasks.forEach((task, index) => {
        const isCompleted = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 font-bold rounded-lg border border-emerald-100">Selesai</span>`
            : `<span class="px-2.5 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg border border-amber-100">Pending</span>`;

        const buttonClass = isCompleted
            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
            : 'bg-slate-900 hover:bg-amber-500 text-white shadow-xs';

        const actionButton = `
            <button onclick="openResponseModal('${task.ID_Tugas || index}', '${task.Judul_Tugas}')" class="px-3.5 py-1.5 ${buttonClass} font-extrabold rounded-xl transition-all text-[11px] flex items-center justify-center gap-1.5 w-full">
                <i data-lucide="${isCompleted ? 'check-circle-2' : 'play'}" class="w-3.5 h-3.5"></i>
                ${isCompleted ? 'Selesai (Edit Remark)' : 'Selesaikan & Beri Remark'}
            </button>
        `;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-50 bg-white">
                <td class="py-3.5 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3.5 px-4 text-slate-500 font-medium">${task.Detail_Jadwal || '-'}</td>
                <td class="py-3.5 px-4 font-semibold text-slate-600 uppercase">${task.Target_User || '-'}</td>
                <td class="py-3.5 px-4">
                    <p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">${task.Deskripsi || '-'}</p>
                </td>
                <td class="py-3.5 px-4">
                    <p class="text-xs font-semibold text-slate-700 italic bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        "${task.Catatan_User || 'Belum ada catatan'}"
                    </p>
                </td>
                <td class="py-3.5 px-4 text-center">${statusBadge}</td>
                <td class="py-3.5 px-4 text-center w-36">
                    ${actionButton}
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
}

function openResponseModal(taskId, taskTitle) {
    const catatan = prompt(
        `Berikan remark / catatan pengerjaan untuk tugas:\n"${taskTitle}"\n\n(Tugas akan ditandai Selesai dan warna tombol berubah Hijau):`,
        "Selesai dikerjakan dengan baik"
    );
    
    if (catatan !== null) {
        const targetTask = allMonitoringTasks.find(t => (t.ID_Tugas || '') === taskId || t.Judul_Tugas === taskTitle);
        if (targetTask) {
            targetTask.Status = 'Selesai';
            targetTask.Catatan_User = catatan;
            
            renderMonitoringTable();
            updateInboxBadge();
        }
    }
}

/* ==========================================================================
   BADGE LONCENG & INBOX MODAL
   ========================================================================== */
function updateInboxBadge() {
    const badge = document.getElementById('inboxBadge');
    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    // 1. KECUALIKAN ADMIN: Admin tidak memiliki notifikasi pending tugasan pribadi
    if (userRole === 'admin' || loggedInUser === 'admin') {
        if (badge) {
            badge.innerText = '0';
            badge.classList.add('hidden');
        }
        return;
    }

    // 2. AKUMULASI PENDING: Hitung semua tugas yang masih 'Pending' untuk role ABM/BM
    const pendingCount = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const status = (task.Status || '').toLowerCase().trim();
        if (status === 'selesai' || status === 'done') return false;

        const target = (task.Target_User || '').toLowerCase().trim();
        return target === loggedInUser || target === userRole;
    }).length;

    if (badge) {
        if (pendingCount > 0) {
            badge.innerText = pendingCount;
            badge.classList.remove('hidden');
        } else {
            badge.classList.add('hidden');
        }
    }
}

function toggleInboxModal(isRefresh = false) {
    const modal = document.getElementById('inboxModal');
    const container = document.getElementById('inboxListContainer');
    if (!modal || !container) return;

    if (!modal.classList.contains('hidden') && !isRefresh) {
        modal.classList.add('hidden');
        return;
    }

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    // 1. JIKA ADMIN: Berikan pesan keterangan bahwa Admin adalah pengawas
    if (userRole === 'admin' || loggedInUser === 'admin') {
        container.innerHTML = `
            <div class="text-center py-6 px-4 bg-slate-50 rounded-2xl border border-slate-100">
                <i data-lucide="shield-check" class="w-8 h-8 text-amber-500 mx-auto mb-2"></i>
                <p class="text-xs font-bold text-slate-700">Mode Pengawas (Superior)</p>
                <p class="text-[11px] text-slate-400 mt-1 leading-relaxed">
                    Role Admin tidak memiliki tagihan tugas pending pribadi. Untuk memantau progres pengerjaan tugas seluruh tim BM & ABM, silakan buka menu <strong class="text-slate-600">Monitoring Tugas</strong>.
                </p>
                <button onclick="switchView('monitoring'); toggleInboxModal();" class="mt-3 px-4 py-2 bg-slate-900 hover:bg-amber-500 text-white text-[11px] font-bold rounded-xl transition-all">
                    Buka Monitoring Tugas &rarr;
                </button>
            </div>
        `;
        modal.classList.remove('hidden');
        lucide.createIcons();
        return;
    }
    
    // 2. JIKA ABM/BM: Tampilkan daftar tugas pending
    let activeTasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const status = (task.Status || '').toLowerCase().trim();
        if (status === 'selesai' || status === 'done') return false;

        const target = (task.Target_User || '').toLowerCase().trim();
        return target === loggedInUser || target === userRole;
    });

    if (currentInboxFilter === 'today') {
        activeTasks = activeTasks.filter(task => isTaskForToday(task));
    }

    container.innerHTML = '';
    if (activeTasks.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs font-medium">Tidak ada tugas pending untuk kriteria ini.</div>`;
    } else {
        activeTasks.forEach(task => {
            const isToday = isTaskForToday(task);
            const badgeWaktu = isToday 
                ? `<span class="text-[9px] bg-emerald-500 text-white font-bold px-1.5 py-0.5 rounded">Hari Ini</span>` 
                : `<span class="text-[9px] bg-rose-500 text-white font-bold px-1.5 py-0.5 rounded">Overdue / Akumulasi</span>`;

            container.innerHTML += `
                <div class="bg-amber-50/50 border border-amber-100 p-3.5 rounded-2xl flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[10px] font-extrabold uppercase bg-amber-500 text-white px-2 py-0.5 rounded-md">${task.Jenis_Tugas}</span>
                            ${badgeWaktu}
                        </div>
                        <span class="text-[10px] text-slate-400 font-bold">Jadwal: ${task.Detail_Jadwal}</span>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-slate-800">${task.Judul_Tugas}</h4>
                        <p class="text-[11px] text-slate-600 mt-0.5">${task.Deskripsi}</p>
                    </div>
                    <button onclick="switchView('monitoring'); toggleInboxModal();" class="self-end mt-1 px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-amber-500 transition-all">
                        Buka & Selesaikan &rarr;
                    </button>
                </div>
            `;
        });
    }
    modal.classList.remove('hidden');
    lucide.createIcons();
}
