/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (FIXED RENDERING & CLEAN BADGE COUNT)
   ========================================================================== */
const MONITORING_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=1912450864&single=true&output=csv';
let allMonitoringTasks = [];
let currentTaskFilter = 'today'; 
let currentInboxFilter = 'today';

// Database Master Seluruh Tim (11 ABM & 3 BM + Fleksibel Bertambah)
const SYSTEM_TEAM = [
    { username: 'bm agus', role: 'BM', name: 'BM Agus' },
    { username: 'bm didik', role: 'BM', name: 'BM Didik' },
    { username: 'bm galih', role: 'BM', name: 'BM Galih' },
    { username: 'abm anas', role: 'ABM', name: 'ABM Anas' },
    { username: 'abm bayu', role: 'ABM', name: 'ABM Bayu' },
    { username: 'abm ika', role: 'ABM', name: 'ABM Ika' },
    { username: 'abm adinda', role: 'ABM', name: 'ABM Adinda' },
    { username: 'abm ridho', role: 'ABM', name: 'ABM Ridho' },
    { username: 'abm fachri', role: 'ABM', name: 'ABM Fachri' },
    { username: 'abm gading', role: 'ABM', name: 'ABM Gading' },
    { username: 'abm wildan', role: 'ABM', name: 'ABM Wildan' },
    { username: 'abm satria', role: 'ABM', name: 'ABM Satria' }
];

function getWIBDateInfo() {
    const now = new Date();
    const weekdayName = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long' }).format(now).toLowerCase();
    const dayNumber = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(now);
    const dayOfWeek = now.getDay();
    return { weekdayName, dayNumber, dayOfWeek };
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
    const tbody = document.getElementById('monitoringTableBody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Memuat data tugasan pintar...</td></tr>`;
    }

    try {
        const response = await fetch(`${MONITORING_API_URL}&t=${Date.now()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const csvText = await response.text();
        allMonitoringTasks = parseCSV(csvText);
        
        checkWeeklyResetAndKPI();
        renderMonitoringTable();
        updateInboxBadge();
    } catch (error) {
        console.error('Gagal mengambil data monitoring tugas:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-rose-500 font-bold">Gagal memuat data: ${error.message}</td></tr>`;
        }
    }
}

/* ==========================================================================
   SMART ASSIGNMENT HELPER
   ========================================================================== */
function getAssignedUsersForTask(task) {
    const target = (task.Target_User || '').toLowerCase().trim();
    
    if (target === 'abm') {
        return SYSTEM_TEAM.filter(u => u.role === 'ABM');
    } else if (target === 'bm') {
        return SYSTEM_TEAM.filter(u => u.role === 'BM');
    } else if (target === '' || target === 'umum') {
        return SYSTEM_TEAM;
    } else {
        const found = SYSTEM_TEAM.find(u => u.username === target || u.name.toLowerCase() === target);
        return found ? [found] : [{ username: target, role: 'CUSTOM', name: task.Target_User }];
    }
}

function checkWeeklyResetAndKPI() {
    const { dayOfWeek } = getWIBDateInfo();
    const lastResetWeek = localStorage.getItem('lastResetWeek');
    const currentWeekNum = Math.ceil(new Date().getDate() / 7);

    if (dayOfWeek === 0 && lastResetWeek !== String(currentWeekNum)) {
        localStorage.setItem('lastResetWeek', String(currentWeekNum));
    }
}

/* ==========================================================================
   ROUTING TAMPILAN
   ========================================================================== */
function renderMonitoringTable() {
    const tbody = document.getElementById('monitoringTableBody');
    if (!tbody) return;

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    if (userRole === 'admin' || loggedInUser === 'admin') {
        renderSuperiorDashboard(tbody);
        return;
    }

    renderUserTaskTable(tbody, loggedInUser, userRole);
}

/* ==========================================================================
   DASHBOARD SUPERIOR
   ========================================================================== */
function renderSuperiorDashboard(tbody) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    tbody.innerHTML = ''; // Bersihkan teks loading statis

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Tidak ada data tugasan untuk periode waktu ini.</td></tr>`;
        const existingSummary = document.getElementById('superiorSummaryContainer');
        if (existingSummary) existingSummary.remove();
        return;
    }

    const attentionList = tasks.filter(t => isOverdue(t));
    const todayList = tasks.filter(t => !isOverdue(t) && isTaskForToday(t));
    const doneList = tasks.filter(t => (t.Status || '').toLowerCase().trim() === 'selesai' || (t.Status || '').toLowerCase().trim() === 'done');
    const totalTasks = tasks.length;
    const overallPercentage = totalTasks > 0 ? Math.round((doneList.length / totalTasks) * 100) : 0;

    const personalStats = {};
    SYSTEM_TEAM.forEach(user => {
        personalStats[user.username] = { name: user.name, role: user.role, total: 0, done: 0 };
    });

    tasks.forEach(task => {
        const assignedUsers = getAssignedUsersForTask(task);
        const isDone = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        
        assignedUsers.forEach(u => {
            if (!personalStats[u.username]) {
                personalStats[u.username] = { name: u.name, role: u.role || 'ABM', total: 0, done: 0 };
            }
            personalStats[u.username].total += 1;
            if (isDone) personalStats[u.username].done += 1;
        });
    });

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
            <p class="text-[10px] uppercase font-black text-slate-400 mb-1">Completion Rate KPI</p>
            <h3 class="text-2xl font-black text-slate-800">${overallPercentage}%</h3>
        </div>
    </div>`;

    let teamProgressHTML = `
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm mb-6 w-full">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-2">
            <i data-lucide="award" class="w-4 h-4 text-amber-500"></i> KPI Completion Rate Per Personil
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">`;

    Object.keys(personalStats).sort().forEach(key => {
        const p = personalStats[key];
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
        let barColor = 'bg-rose-500';
        if (pct >= 100) barColor = 'bg-emerald-500';
        else if (pct >= 50) barColor = 'bg-amber-500';

        teamProgressHTML += `
            <div class="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center text-xs font-extrabold text-slate-800 mb-1">
                        <span class="truncate">${p.name}</span>
                        <span class="px-1.5 py-0.5 bg-white border rounded text-[10px] text-amber-600 font-black">${pct}%</span>
                    </div>
                    <p class="text-[10px] text-slate-400 font-bold mb-2">Selesai: ${p.done} dari ${p.total} beban tugas</p>
                </div>
                <div class="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div class="${barColor} h-full rounded-full transition-all" style="width: ${pct}%"></div>
                </div>
            </div>`;
    });
    teamProgressHTML += `</div></div>`;

    let rowsHTML = '';

    const renderRowWithCollapse = (task, index, isUrgent = false) => {
        const isDone = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        const assignedUsers = getAssignedUsersForTask(task);

        const statusBadge = isDone 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 font-extrabold rounded-lg border border-emerald-200/60 text-[11px]"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> DONE</span>`
            : (isUrgent 
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 font-extrabold rounded-lg border border-rose-200/60 text-[11px]"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> OVERDUE</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 font-extrabold rounded-lg border border-amber-200/60 text-[11px]"><i data-lucide="clock" class="w-3.5 h-3.5"></i> PENDING</span>`);

        let collapseHtml = assignedUsers.map(user => {
            const userDone = isDone; 
            return `
                <div class="flex items-center justify-between py-1.5 px-3 bg-white rounded-lg border border-slate-200/60 text-xs shadow-xs">
                    <span class="font-bold text-slate-700">${user.name}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-black ${userDone ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                        ${userDone ? 'Selesai' : 'Pending'}
                    </span>
                </div>
            `;
        }).join('');

        return `
            <tr class="${isUrgent ? 'bg-rose-50/20' : 'bg-white'} hover:bg-amber-50/20 transition-colors border-b border-slate-100 cursor-pointer" onclick="toggleTaskCollapse('${index}')">
                <td class="py-3.5 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3.5 px-4 font-extrabold text-amber-600 uppercase">${task.Target_User || 'Umum'}</td>
                <td class="py-3.5 px-4">
                    <p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p>
                    <p class="text-[11px] text-amber-600 font-semibold mt-0.5">Klik untuk lihat rincian ${assignedUsers.length} personil ter-assign &or;</p>
                </td>
                <td class="py-3.5 px-4">
                    <div class="flex items-center gap-2">
                        <div class="w-20 bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="${isDone ? 'bg-emerald-500' : (isUrgent ? 'bg-rose-500' : 'bg-amber-400')} h-full rounded-full" style="width: ${isDone ? '100%' : '10%'}"></div>
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
            <tr id="collapse-row-${index}" class="hidden bg-slate-100/60 border-b border-slate-200">
                <td colspan="7" class="p-4">
                    <div class="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-inner">
                        <p class="text-xs font-black text-slate-800 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                            <i data-lucide="users" class="w-4 h-4 text-amber-500"></i> Rincian Status Personil Ter-Assign (${assignedUsers.length} Orang):
                        </p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                            ${collapseHtml}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    };

    if (attentionList.length > 0) {
        rowsHTML += `<tr class="bg-rose-100/90 font-black text-rose-800 border-y border-rose-200"><td colspan="7" class="py-2.5 px-4 text-xs uppercase tracking-wider">⚠️ Perhatian Khusus: Tugas Terlambat / Overdue (${attentionList.length})</td></tr>`;
        attentionList.forEach((task, idx) => { rowsHTML += renderRowWithCollapse(task, 'att-' + idx, true); });
    }

    rowsHTML += `<tr class="bg-slate-100/80 font-black text-slate-700 border-y border-slate-200"><td colspan="7" class="py-2.5 px-4 text-xs uppercase tracking-wider">📅 Daftar Tugas Berjalan & Aktif</td></tr>`;
    
    let activeTasks = todayList.concat(doneList);
    if (activeTasks.length === 0) {
        rowsHTML += `<tr><td colspan="7" class="py-6 text-center text-slate-400 text-xs">Tidak ada tugas dalam kategori ini.</td></tr>`;
    } else {
        activeTasks.forEach((task, idx) => { rowsHTML += renderRowWithCollapse(task, 'act-' + idx, false); });
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

window.toggleTaskCollapse = function(index) {
    const collapseRow = document.getElementById(`collapse-row-${index}`);
    if (collapseRow) {
        collapseRow.classList.toggle('hidden');
    }
}

/* ==========================================================================
   TAMPILAN USER BIASA & INBOX
   ========================================================================== */
function renderUserTaskTable(tbody, loggedInUser, userRole) {
    const existingSummary = document.getElementById('superiorSummaryContainer');
    if (existingSummary) existingSummary.remove();

    let tasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const assigned = getAssignedUsersForTask(task);
        return assigned.some(u => u.username === loggedInUser || u.role.toLowerCase() === userRole);
    });

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    tbody.innerHTML = ''; // Bersihkan teks loading statis

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Tidak ada tugasan aktif untuk Anda.</td></tr>`;
        return;
    }

    tasks.forEach((task, index) => {
        const isCompleted = (task.Status || '').toLowerCase().trim() === 'selesai' || (task.Status || '').toLowerCase().trim() === 'done';
        
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 font-bold rounded-lg border border-emerald-100">Selesai</span>`
            : `<span class="px-2.5 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg border border-amber-100">Pending</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50 bg-white">
                <td class="py-3.5 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3.5 px-4 text-slate-500 font-medium">${task.Detail_Jadwal || '-'}</td>
                <td class="py-3.5 px-4 font-semibold text-slate-600 uppercase">${task.Target_User || '-'}</td>
                <td class="py-3.5 px-4"><p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p></td>
                <td class="py-3.5 px-4"><p class="text-xs italic text-slate-600">"${task.Catatan_User || '-'}"</p></td>
                <td class="py-3.5 px-4 text-center">${statusBadge}</td>
                <td class="py-3.5 px-4 text-center">
                    <button onclick="openResponseModal('${task.ID_Tugas || index}', '${task.Judul_Tugas}')" class="px-3.5 py-1.5 bg-slate-900 hover:bg-amber-500 text-white text-[11px] font-bold rounded-xl transition-all">Selesaikan</button>
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
}

function openResponseModal(taskId, taskTitle) {
    const catatan = prompt(`Berikan remark / catatan pengerjaan untuk tugas:\n"${taskTitle}"`, "Selesai dikerjakan");
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

function updateInboxBadge() {
    const badge = document.getElementById('inboxBadge');
    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    if (userRole === 'admin' || loggedInUser === 'admin') {
        if (badge) badge.classList.add('hidden');
        return;
    }

    // Hitung hanya tugas pending yang benar-benar ditujukan untuk user yang sedang login
    const pendingCount = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const status = (task.Status || '').toLowerCase().trim();
        if (status === 'selesai' || status === 'done') return false;

        const assigned = getAssignedUsersForTask(task);
        return assigned.some(u => u.username === loggedInUser);
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

function toggleInboxModal() {}
