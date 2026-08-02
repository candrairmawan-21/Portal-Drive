/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (WIB FILTER & SMART USER CLASSIFICATION)
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
   ROUTING TAMPILAN: ADMIN (SMART SUPERIOR DASHBOARD) VS USER
   ========================================================================== */
function renderMonitoringTable() {
    const tbody = document.getElementById('monitoringTableBody');
    if (!tbody) return;

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    // 1. JIKA ADMIN / SUPERIOR: Tampilkan Smart Superior Dashboard Berbasis Personal User
    if (userRole === 'admin' || loggedInUser === 'admin') {
        renderSuperiorDashboard(tbody);
        return;
    }

    // 2. JIKA ABM / BM: Tampilkan Tabel Tugasan Pribadi
    renderUserTaskTable(tbody, loggedInUser, userRole);
}

/* ==========================================================================
   TAMPILAN KHUSUS ADMIN: KLASIFIKASI PINTAR BERDASARKAN USERNAME / JABATAN
   ========================================================================== */
function renderSuperiorDashboard(tbody) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper untuk deteksi overdue akurat (bulanan/mingguan)
    const isOverdue = (task) => {
        const isDone = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        if (isDone) return false;
        
        const jenis = (task.Jenis_Tugas || '').toLowerCase().trim();
        const jadwalStr = (task.Detail_Jadwal || '').trim();
        if (!jadwalStr) return false;

        let taskDate = null;
        if (jenis.includes('bulanan')) {
            const dayNum = parseInt(jadwalStr);
            if (!isNaN(dayNum)) {
                taskDate = new Date(today.getFullYear(), today.getMonth(), dayNum);
            }
        } else {
            taskDate = new Date(jadwalStr);
        }

        return taskDate && !isNaN(taskDate.getTime()) && taskDate < today;
    };

    let tasks = [...allMonitoringTasks].filter(task => task.Jenis_Tugas && task.Jenis_Tugas.trim() !== '');

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Tidak ada data tugasan untuk periode waktu ini.</td></tr>`;
        const existingSummary = document.getElementById('superiorSummaryContainer');
        if (existingSummary) existingSummary.remove();
        return;
    }

    const attentionList = tasks.filter(t => isOverdue(t));
    const todayList = tasks.filter(t => !isOverdue(t) && isTaskForToday(task));
    const doneList = tasks.filter(t => (t.Status || '').toLowerCase().trim() === 'selesai' || (t.Status || '').toLowerCase().trim() === 'done');
    const totalTasks = tasks.length;
    const overallPercentage = totalTasks > 0 ? Math.round((doneList.length / totalTasks) * 100) : 0;

    /* KECERDASAN SISTEM: Klasifikasi beban tugas & progress per Personal User (berdasarkan prefix jabatan abm/bm) */
    const personalSummary = {};
    tasks.forEach(task => {
        let rawTarget = (task.Target_User || 'Umum').trim();
        let targetKey = rawTarget.toLowerCase();
        
        if (!personalSummary[targetKey]) {
            personalSummary[targetKey] = {
                name: rawTarget,
                roleCategory: targetKey.startsWith('bm') ? 'BM' : (targetKey.startsWith('abm') ? 'ABM' : 'Lainnya'),
                total: 0,
                completed: 0,
                pending: 0,
                tasksList: []
            };
        }

        const isDone = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        personalSummary[targetKey].total += 1;
        if (isDone) {
            personalSummary[targetKey].completed += 1;
        } else {
            personalSummary[targetKey].pending += 1;
        }
        personalSummary[targetKey].tasksList.push({ ...task, isDone });
    });

    // 1. KPI Cards Superior
    let kpiHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
        <div class="bg-rose-50 border border-rose-100 rounded-2xl p-4 shadow-sm">
            <p class="text-[10px] uppercase font-black text-rose-500 mb-1">Perhatian (Overdue)</p>
            <h3 class="text-2xl font-black text-rose-700">${attentionList.length} <span class="text-xs font-semibold text-rose-500">Tugas</span></h3>
        </div>
        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <p class="text-[10px] uppercase font-black text-slate-400 mb-1">Tugas Hari Ini</p>
            <h3 class="text-2xl font-black text-slate-700">${todayList.length} <span class="text-xs font-semibold text-slate-400">Tugas</span></h3>
        </div>
        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <p class="text-[10px] uppercase font-black text-slate-400 mb-1">Total Selesai (Done)</p>
            <h3 class="text-2xl font-black text-emerald-600">${doneList.length} <span class="text-xs font-semibold text-emerald-500">Tugas</span></h3>
        </div>
        <div class="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
            <p class="text-[10px] uppercase font-black text-slate-400 mb-1">Completion Rate</p>
            <h3 class="text-2xl font-black text-slate-800">${overallPercentage}%</h3>
        </div>
    </div>`;

    // 2. Personal Progress Cards (Menampilkan nama personal ABM / BM yang masih pending)
    let teamProgressHTML = `
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm mb-6 w-full">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
            <i data-lucide="users" class="w-4 h-4 text-amber-500"></i> Progress Completion Per Personal Team (BM & ABM)
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">`;

    Object.keys(personalSummary).sort().forEach(key => {
        const data = personalSummary[key];
        const percentage = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
        let barColor = 'bg-rose-500';
        if (percentage >= 100) barColor = 'bg-emerald-500';
        else if (percentage >= 50) barColor = 'bg-amber-500';

        teamProgressHTML += `
            <div class="bg-slate-50/80 p-3.5 rounded-xl border border-slate-100 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center text-xs font-black text-slate-800 mb-1">
                        <span class="uppercase text-amber-600">${data.name}</span>
                        <span class="px-2 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-600">${percentage}% Done</span>
                    </div>
                    <div class="text-[11px] text-slate-500 font-medium mb-2">
                        Pending: <strong class="${data.pending > 0 ? 'text-rose-600' : 'text-slate-700'}">${data.pending}</strong> | Selesai: ${data.completed} dari ${data.total}
                    </div>
                </div>
                <div class="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div class="${barColor} h-full transition-all duration-500 rounded-full" style="width: ${percentage}%"></div>
                </div>
            </div>`;
    });
    teamProgressHTML += `</div></div>`;

    // 3. Render Tabel Terstruktur Berdasarkan Personil
    const renderRow = (task, isUrgent = false) => {
        const isDone = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        const progressWidth = isDone ? '100%' : '10%';
        const progressColor = isDone ? 'bg-emerald-500' : (isUrgent ? 'bg-rose-500' : 'bg-amber-400');
        
        const statusBadge = isDone 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 font-extrabold rounded-lg border border-emerald-200/60 text-[11px]"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> DONE</span>`
            : (isUrgent 
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 font-extrabold rounded-lg border border-rose-200/60 text-[11px]"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> OVERDUE</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 font-extrabold rounded-lg border border-amber-200/60 text-[11px]"><i data-lucide="clock" class="w-3.5 h-3.5"></i> PENDING</span>`);

        return `
            <tr class="${isUrgent ? 'bg-rose-50/20' : 'bg-white'} hover:bg-amber-50/20 transition-colors border-b border-slate-100">
                <td class="py-3.5 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3.5 px-4 font-extrabold text-amber-600 uppercase">${task.Target_User || '-'}</td>
                <td class="py-3.5 px-4">
                    <p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">${task.Deskripsi || '-'}</p>
                </td>
                <td class="py-3.5 px-4">
                    <div class="flex items-center gap-2">
                        <div class="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="${progressColor} h-full rounded-full" style="width: ${progressWidth}"></div>
                        </div>
                        <span class="text-[10px] font-bold text-slate-500">${isDone ? '100%' : '0%'}</span>
                    </div>
                </td>
                <td class="py-3.5 px-4 text-xs font-semibold ${isUrgent ? 'text-rose-600 font-bold' : 'text-slate-500'}">
                    ${isUrgent ? '⚠️ Tgl ' + task.Detail_Jadwal : 'Tgl ' + task.Detail_Jadwal}
                </td>
                <td class="py-3.5 px-4">
                    <p class="text-xs font-semibold text-slate-700 italic bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        "${task.Catatan_User || 'Belum ada catatan'}"
                    </p>
                </td>
                <td class="py-3.5 px-4 text-center">${statusBadge}</td>
            </tr>
        `;
    };

    let rowsHTML = '';

    if (attentionList.length > 0) {
        rowsHTML += `
            <tr class="bg-rose-100/90 font-black text-rose-800 border-y border-rose-200">
                <td colspan="7" class="py-2.5 px-4 text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <i data-lucide="alert-octagon" class="w-4 h-4 text-rose-600"></i> Perhatian Khusus: Tugas Terlambat / Belum Selesai (${attentionList.length})
                </td>
            </tr>
        `;
        attentionList.forEach(task => { rowsHTML += renderRow(task, true); });
    }

    rowsHTML += `
        <tr class="bg-slate-100/80 font-black text-slate-700 border-y border-slate-200">
            <td colspan="7" class="py-2.5 px-4 text-xs uppercase tracking-wider">
                📅 Daftar Tugas Berjalan & Aktif
            </td>
        </tr>
    `;
    
    let activeTasks = todayList.concat(doneList);
    if (activeTasks.length === 0) {
        rowsHTML += `<tr><td colspan="7" class="py-6 text-center text-slate-400 text-xs">Tidak ada tugas dalam kategori ini.</td></tr>`;
    } else {
        activeTasks.forEach(task => { rowsHTML += renderRow(task, false); });
    }

    const tableContainer = tbody.closest('table').parentElement;
    const existingSummary = document.getElementById('superiorSummaryContainer');
    if (existingSummary) existingSummary.remove();

    const summaryDiv = document.createElement('div');
    summaryDiv.id = 'superiorSummaryContainer';
    summaryDiv.innerHTML = kpiHTML + teamProgressHTML;
    tableContainer.parentNode.insertBefore(summaryDiv, tableContainer);

    tbody.innerHTML = rowsHTML;
    lucide.createIcons();
}

/* ==========================================================================
   TAMPILAN KHUSUS USER (BM & ABM): TABEL TUGAS PRIBADI & REMARK
   ========================================================================== */
function renderUserTaskTable(tbody, loggedInUser, userRole) {
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

    if (userRole === 'admin' || loggedInUser === 'admin') {
        if (badge) {
            badge.innerText = '0';
            badge.classList.add('hidden');
        }
        return;
    }

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
