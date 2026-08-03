/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (CLEAN UI, FUNCTIONAL REFRESH & ENHANCED KPI)
   ========================================================================== */
const MONITORING_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=1912450864&single=true&output=csv';
const LOG_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRbZXekvj6nyo6N6zuniiKEpmWXiXN-i3oWLN3oJth83nN28ENCibYOFy_cFgx1_GvULPrBHUJVDrcO/pub?gid=2043519577&single=true&output=csv';
const UPDATE_API_URL = 'https://script.google.com/macros/s/AKfycbylA9zPOniiBscbANH-8jzjpEuEPM1yCF8hQFGUOCqnZYyr0xGwq7AqqPweeK6OSFHarw/exec';

let allMonitoringTasks = [];
let allTaskLogs = [];
let currentTaskFilter = 'today'; 
let monitoringInterval = null;

// Database Master Seluruh Tim (11 ABM & 3 BM)[cite: 1]
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

function getIndonesianDayIndex(dayName) {
    const map = { 'senin': 1, 'selasa': 2, 'rabu': 3, 'kamis': 4, 'jumat': 5, 'sabtu': 6, 'minggu': 7 };
    return map[(dayName || '').toLowerCase().trim()] || 0;
}

function getCurrentIndonesianDayIndex() {
    const d = new Date().getDay();
    return d === 0 ? 7 : d;
}

function getIndonesianDayName() {
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return days[new Date().getDay()];
}

function getFormattedTimestamp() {
    const now = new Date();
    return `${now.toLocaleDateString('id-ID')} ${now.toLocaleTimeString('id-ID')}`;
}

function getCurrentWeekKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getFullYear()}-W${weekNo}`;
}

function checkAndResetWeeklyStatus() {
    const currentWeek = getCurrentWeekKey();
    const storedWeek = localStorage.getItem('portal_task_week');
    
    if (storedWeek !== currentWeek) {
        localStorage.setItem('portal_task_week', currentWeek);
        localStorage.removeItem('portal_completed_tasks');
    }
}

function isTaskCompletedByUser(task, userObj) {
    if (!userObj) return false;
    
    checkAndResetWeeklyStatus();
    const taskTitle = (task.Judul_Tugas || '').toLowerCase().trim();
    const targetName = (userObj.name || '').toLowerCase().trim();
    const targetUsername = (userObj.username || '').toLowerCase().trim();
    const todayDateStr = new Date().toLocaleDateString('id-ID');

    const completedTasksMap = JSON.parse(localStorage.getItem('portal_completed_tasks') || '{}');
    const taskIdKey = task.ID_Tugas || `${task.Judul_Tugas}_${task.Detail_Jadwal}`;
    
    if (completedTasksMap[taskIdKey]) {
        if (completedTasksMap[taskIdKey].date === todayDateStr) {
            return true;
        }
    }

    const foundInLogs = allTaskLogs.some(log => {
        const logUser = (log['Nama User'] || log.Nama_User || '').toLowerCase().trim();
        const logTugas = (log['Tugas yang Selesai'] || log.Tugas_yang_Selesai || log.TugasYangSelesai || '').toLowerCase().trim();
        const logTimestamp = (log['Tanggal & Jam Respons'] || log.Tanggal_Jam_Respons || log.Timestamp || '').trim();
        
        const matchUser = (logUser === targetName || logUser === targetUsername);
        const matchTugas = (logTugas === taskTitle);
        const logDatePart = logTimestamp.split(' ')[0];
        const matchDate = (logDatePart === todayDateStr);

        return matchUser && matchTugas && matchDate;
    });

    return foundInLogs;
}

function getTaskTemporalStatusForUser(task, userObj) {
    const isDone = isTaskCompletedByUser(task, userObj);
    if (isDone) {
        return { code: 'DONE', label: 'Selesai', colorClass: 'bg-emerald-500 text-white', isActionable: false };
    }

    const jenis = (task.Jenis_Tugas || '').toLowerCase().trim();
    const jadwalStr = (task.Detail_Jadwal || '').trim().toLowerCase();
    const now = new Date();
    const currentDayIdx = getCurrentIndonesianDayIndex();
    const currentDateNum = now.getDate();

    if (jenis.includes('mingguan')) {
        const targetDayIdx = getIndonesianDayIndex(jadwalStr);
        if (targetDayIdx === 0 || targetDayIdx === currentDayIdx) {
            return { code: 'TODAY', label: 'Hari Ini (On Going)', colorClass: 'bg-emerald-500 text-white', isActionable: true };
        } else if (targetDayIdx < currentDayIdx) {
            return { code: 'OVERDUE', label: 'Overdue (Terlambat)', colorClass: 'bg-rose-500 text-white', isActionable: true };
        } else {
            return { code: 'UPCOMING', label: 'Jadwal Mendatang', colorClass: 'bg-slate-500 text-white', isActionable: false };
        }
    }

    if (jenis.includes('bulanan')) {
        const targetDateNum = parseInt(jadwalStr);
        if (!isNaN(targetDateNum)) {
            if (targetDateNum === currentDateNum) {
                return { code: 'TODAY', label: 'Hari Ini (On Going)', colorClass: 'bg-emerald-500 text-white', isActionable: true };
            } else if (targetDateNum < currentDateNum) {
                return { code: 'OVERDUE', label: 'Overdue (Terlambat)', colorClass: 'bg-rose-500 text-white', isActionable: true };
            } else {
                return { code: 'UPCOMING', label: 'Jadwal Mendatang', colorClass: 'bg-slate-500 text-white', isActionable: false };
            }
        }
    }

    return { code: 'TODAY', label: 'Hari Ini (On Going)', colorClass: 'bg-emerald-500 text-white', isActionable: true };
}

function getTaskTemporalStatus(task) {
    return getTaskTemporalStatusForUser(task, SYSTEM_TEAM[0]);
}

function isTaskForToday(task) {
    const status = getTaskTemporalStatus(task);
    return status.code === 'TODAY' || status.code === 'OVERDUE';
}

function changeTaskFilter(val) {
    currentTaskFilter = val;
    renderMonitoringTable();
}

// Fungsi Refresh Data yang dapat dipanggil langsung dari tombol UI
window.triggerManualRefresh = async function() {
    const btn = document.getElementById('refreshDataBtn');
    if (btn) {
        btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Memperbarui...`;
    }
    await fetchMonitoringData();
    if (btn) {
        btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Refresh Data`;
        lucide.createIcons();
    }
};

async function fetchMonitoringData() {
    try {
        const [taskRes, logRes] = await Promise.all([
            fetch(`${MONITORING_API_URL}&t=${Date.now()}`),
            fetch(`${LOG_API_URL}&t=${Date.now()}`).catch(() => null)
        ]);

        if (!taskRes.ok) throw new Error(`HTTP error monitoring: ${taskRes.status}`);
        
        const taskCsv = await taskRes.text();
        const newTasks = parseCSV(taskCsv);

        let newLogs = [];
        if (logRes && logRes.ok) {
            const logCsv = await logRes.text();
            newLogs = parseCSV(logCsv);
        }

        allMonitoringTasks = newTasks;
        allTaskLogs = newLogs;
        renderMonitoringTable();
        updateInboxBadge();
    } catch (error) {
        console.error('Gagal mengambil data monitoring:', error);
    }
}

function initRealtimeMonitoring() {
    if (monitoringInterval) clearInterval(monitoringInterval);
    monitoringInterval = setInterval(() => {
        fetchMonitoringData();
    }, 3000); 
}

document.addEventListener('DOMContentLoaded', () => {
    initRealtimeMonitoring();
    fetchMonitoringData();
});

function getAssignedUsersForTask(task) {
    const target = (task.Target_User || '').toLowerCase().trim();
    if (target === 'abm') return SYSTEM_TEAM.filter(u => u.role === 'ABM');
    if (target === 'bm') return SYSTEM_TEAM.filter(u => u.role === 'BM');
    if (target === '' || target === 'umum') return SYSTEM_TEAM;
    const found = SYSTEM_TEAM.find(u => u.username === target || u.name.toLowerCase() === target);
    return found ? [found] : [{ username: target, role: 'CUSTOM', name: task.Target_User }];
}

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

window.resetAllTasksCache = async function() {
    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();
    
    if (userRole !== 'admin' && loggedInUser !== 'admin') {
        alert('Akses ditolak. Fitur ini hanya untuk Admin.');
        return;
    }

    if (confirm('Yakin ingin mereset status hari ini? Semua tombol pengerjaan tim akan diaktifkan kembali.')) {
        localStorage.removeItem('portal_completed_tasks');
        allTaskLogs = [];

        try {
            await fetch(UPDATE_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: "reset" })
            });
        } catch (err) {
            console.error('Gagal mereset server:', err);
        }

        setTimeout(() => {
            fetchMonitoringData();
            alert('Berhasil! Tombol user sudah aktif kembali.');
        }, 1200);
    }
};

function renderSuperiorDashboard(tbody) {
    let tasks = [...allMonitoringTasks].filter(task => task.Jenis_Tugas && task.Jenis_Tugas.trim() !== '');

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Belum ada data tugas yang tersedia untuk saat ini.</td></tr>`;
        const existingSummary = document.getElementById('superiorSummaryContainer');
        if (existingSummary) existingSummary.remove();
        return;
    }

    const attentionList = tasks.filter(t => getTaskTemporalStatus(t).code === 'OVERDUE');
    const todayList = tasks.filter(t => getTaskTemporalStatus(t).code === 'TODAY');
    
    let totalAssignments = 0;
    let totalDoneAssignments = 0;

    const personalStats = {};
    SYSTEM_TEAM.forEach(user => {
        personalStats[user.username] = { name: user.name, role: user.role, total: 0, done: 0 };
    });

    tasks.forEach(task => {
        const assignedUsers = getAssignedUsersForTask(task);
        assignedUsers.forEach(u => {
            if (!personalStats[u.username]) {
                personalStats[u.username] = { name: u.name, role: u.role || 'ABM', total: 0, done: 0 };
            }
            personalStats[u.username].total += 1;
            totalAssignments += 1;

            if (isTaskCompletedByUser(task, u)) {
                personalStats[u.username].done += 1;
                totalDoneAssignments += 1;
            }
        });
    });

    const overallPercentage = totalAssignments > 0 ? Math.round((totalDoneAssignments / totalAssignments) * 100) : 0;
    const doneListCount = tasks.filter(t => {
        const assigned = getAssignedUsersForTask(t);
        return assigned.length > 0 && assigned.every(u => isTaskCompletedByUser(t, u));
    }).length;

    // Keterangan card dashboard lebih natural & humanis
    let kpiHTML = `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 w-full bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-md">
        <div>
            <h4 class="text-sm font-black tracking-wide text-amber-400 flex items-center gap-2">
                <i data-lucide="shield-alert" class="w-4 h-4"></i> Pusat Kontrol Pengawas Lapangan
            </h4>
            <p class="text-xs text-slate-300 mt-1">Pantau pergerakan tugas operasional tim ABM & BM secara langsung tanpa jeda.</p>
        </div>
        <button onclick="resetAllTasksCache()" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-2">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Buka Kunci Tombol Tim
        </button>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 w-full">
        <div class="bg-gradient-to-br from-rose-50 to-white border border-rose-200/60 rounded-2xl p-4 shadow-xs">
            <p class="text-[11px] font-extrabold text-rose-600 mb-1 flex items-center gap-1.5"><i data-lucide="alert-circle" class="w-3.5 h-3.5"></i> Perlu Perhatian</p>
            <h3 class="text-2xl font-black text-rose-700">${attentionList.length} <span class="text-xs font-semibold text-rose-500">Tugas Terlambat</span></h3>
            <p class="text-[10px] text-slate-400 mt-1">Tugas melewati jadwal tenggat waktu.</p>
        </div>
        <div class="bg-gradient-to-br from-white to-slate-50 border border-slate-200/80 rounded-2xl p-4 shadow-xs">
            <p class="text-[11px] font-extrabold text-slate-500 mb-1 flex items-center gap-1.5"><i data-lucide="calendar-days" class="w-3.5 h-3.5"></i> Agenda Hari Ini</p>
            <h3 class="text-2xl font-black text-slate-800">${todayList.length} <span class="text-xs font-semibold text-slate-400">Tugas Aktif</span></h3>
            <p class="text-[10px] text-slate-400 mt-1">Fokus pengerjaan untuk hari ini.</p>
        </div>
        <div class="bg-gradient-to-br from-white to-emerald-50/40 border border-emerald-200/60 rounded-2xl p-4 shadow-xs">
            <p class="text-[11px] font-extrabold text-emerald-600 mb-1 flex items-center gap-1.5"><i data-lucide="check-check" class="w-3.5 h-3.5"></i> Tuntas Sempurna</p>
            <h3 class="text-2xl font-black text-emerald-700">${doneListCount} <span class="text-xs font-semibold text-emerald-500">Tugas Selesai</span></h3>
            <p class="text-[10px] text-slate-400 mt-1">Diselesaikan penuh oleh seluruh tim.</p>
        </div>
        <div class="bg-gradient-to-br from-white to-amber-50/40 border border-amber-200/60 rounded-2xl p-4 shadow-xs">
            <p class="text-[11px] font-extrabold text-amber-600 mb-1 flex items-center gap-1.5"><i data-lucide="activity" class="w-3.5 h-3.5"></i> Efektivitas Kinerja</p>
            <h3 class="text-2xl font-black text-slate-800">${overallPercentage}%</h3>
            <p class="text-[10px] text-slate-400 mt-1">Rasio penyelesaian tugas keseluruhan.</p>
        </div>
    </div>`;

    // KPI Completion Rate per Personil dibuat tidak flat (dilengkapi gradasi, shadow, & border interaktif)
    let teamProgressHTML = `
    <div class="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm mb-6 w-full">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-700 mb-4 flex items-center gap-2">
            <i data-lucide="award" class="w-4 h-4 text-amber-500"></i> Progress & Pencapaian Kinerja Personil
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">`;

    Object.keys(personalStats).sort().forEach(key => {
        const p = personalStats[key];
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
        
        let barGradient = 'from-rose-500 to-rose-600';
        let badgeBg = 'bg-rose-50 text-rose-700 border-rose-200';
        if (pct >= 100) {
            barGradient = 'from-emerald-500 to-teal-600';
            badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (pct >= 50) {
            barGradient = 'from-amber-400 to-amber-500';
            badgeBg = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        teamProgressHTML += `
            <div class="bg-gradient-to-b from-white to-slate-50/60 p-3.5 rounded-2xl border border-slate-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    <div class="flex justify-between items-center text-xs font-bold text-slate-800 mb-1.5">
                        <span class="truncate">${p.name}</span>
                        <span class="px-2 py-0.5 ${badgeBg} border rounded-lg text-[10px] font-black shadow-2xs">${pct}%</span>
                    </div>
                    <p class="text-[10px] text-slate-400 font-medium mb-3">Tuntas: <strong class="text-slate-700">${p.done}</strong> dari ${p.total} tugas</p>
                </div>
                <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5 border border-slate-200/40">
                    <div class="bg-gradient-to-r ${barGradient} h-full rounded-full transition-all duration-500 shadow-xs" style="width: ${pct}%"></div>
                </div>
            </div>`;
    });
    teamProgressHTML += `</div></div>`;

    let rowsHTML = '';

    const renderRowWithCollapse = (task, index) => {
        const assignedUsers = getAssignedUsersForTask(task);
        const doneCount = assignedUsers.filter(u => isTaskCompletedByUser(task, u)).length;
        const taskPct = assignedUsers.length > 0 ? Math.round((doneCount / assignedUsers.length) * 100) : 0;
        const isAllDone = taskPct === 100;
        
        const statusObj = getTaskTemporalStatus(task);
        const isUrgent = statusObj.code === 'OVERDUE' && !isAllDone;

        const statusBadge = isAllDone 
            ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 font-extrabold rounded-lg border border-emerald-200/60 text-[11px]"><i data-lucide="check-circle" class="w-3.5 h-3.5"></i> SELESAI (${doneCount}/${assignedUsers.length})</span>`
            : (isUrgent 
                ? `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 text-rose-600 font-extrabold rounded-lg border border-rose-200/60 text-[11px]"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> TERLAMBAT</span>`
                : `<span class="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-600 font-extrabold rounded-lg border border-amber-200/60 text-[11px]"><i data-lucide="clock" class="w-3.5 h-3.5"></i> BERJALAN (${doneCount}/${assignedUsers.length})</span>`);

        let collapseHtml = assignedUsers.map(user => {
            const userDone = isTaskCompletedByUser(task, user);
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
                            <div class="${isAllDone ? 'bg-emerald-500' : (isUrgent ? 'bg-rose-500' : 'bg-amber-400')} h-full rounded-full" style="width: ${taskPct}%"></div>
                        </div>
                        <span class="text-[10px] font-bold text-slate-500">${taskPct}%</span>
                    </div>
                </td>
                <td class="py-3.5 px-4 text-xs font-semibold ${isUrgent ? 'text-rose-600 font-bold' : 'text-slate-500'}">
                    ${isUrgent ? '⚠️ Tgl ' + task.Detail_Jadwal : 'Tgl ' + task.Detail_Jadwal}
                </td>
                <td class="py-3.5 px-4">
                    <p class="text-xs font-semibold text-slate-700 italic bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        "Progres Tim: ${doneCount} dari ${assignedUsers.length} selesai"
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
        attentionList.forEach((task, idx) => { rowsHTML += renderRowWithCollapse(task, 'att-' + idx); });
    }

    rowsHTML += `<tr class="bg-slate-100/80 font-black text-slate-700 border-y border-slate-200"><td colspan="7" class="py-2.5 px-4 text-xs uppercase tracking-wider">📅 Daftar Tugas Berjalan & Aktif</td></tr>`;
    
    let activeTasks = todayList;
    if (activeTasks.length === 0) {
        rowsHTML += `<tr><td colspan="7" class="py-6 text-center text-slate-400 text-xs">Tidak ada tugas aktif dalam kategori ini.</td></tr>`;
    } else {
        activeTasks.forEach((task, idx) => { rowsHTML += renderRowWithCollapse(task, 'act-' + idx); });
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

function renderUserTaskTable(tbody, loggedInUser, userRole) {
    const existingSummary = document.getElementById('superiorSummaryContainer');
    if (existingSummary) existingSummary.remove();

    const currentUserObj = SYSTEM_TEAM.find(u => u.username === loggedInUser) || { username: loggedInUser, name: loggedInUser, role: userRole };

    let tasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const assigned = getAssignedUsersForTask(task);
        return assigned.some(u => u.username === loggedInUser || u.role.toLowerCase() === userRole);
    });

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Tidak ada tugasan aktif untuk Anda saat ini.</td></tr>`;
        return;
    }

    tasks.forEach((task, index) => {
        const isCompleted = isTaskCompletedByUser(task, currentUserObj);
        const statusObj = getTaskTemporalStatusForUser(task, currentUserObj);
        
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 font-bold rounded-lg border border-emerald-100">Selesai</span>`
            : `<span class="px-2.5 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg border border-emerald-100">Pending (${statusObj.label})</span>`;

        const actionButton = isCompleted
            ? `<button disabled class="px-3.5 py-1.5 bg-slate-200 text-slate-400 text-[11px] font-bold rounded-xl cursor-not-allowed">Sudah Selesai</button>`
            : `<button onclick="openResponseModal(this, '${task.ID_Tugas || index}', '${task.Judul_Tugas}')" class="px-3.5 py-1.5 bg-slate-900 hover:bg-amber-500 text-white text-[11px] font-bold rounded-xl transition-all">Selesaikan</button>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition-colors border-b border-slate-50 bg-white">
                <td class="py-3.5 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3.5 px-4 text-slate-500 font-medium">${task.Detail_Jadwal || '-'}</td>
                <td class="py-3.5 px-4 font-semibold text-slate-600 uppercase">${task.Target_User || '-'}</td>
                <td class="py-3.5 px-4"><p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p></td>
                <td class="py-3.5 px-4"><p class="text-xs italic text-slate-600">"${task.Catatan_User || '-'}"</p></td>
                <td class="py-3.5 px-4 text-center">${statusBadge}</td>
                <td class="py-3.5 px-4 text-center">${actionButton}</td>
            </tr>
        `;
    });
    lucide.createIcons();
}

async function openResponseModal(buttonElement, taskId, taskTitle) {
    const catatan = prompt(`Berikan catatan / remark pengerjaan untuk tugas:\n"${taskTitle}"`, "Selesai dikerjakan");
    if (catatan !== null) {
        if (buttonElement) {
            buttonElement.disabled = true;
            buttonElement.innerText = 'Menyimpan...';
            buttonElement.className = 'px-3.5 py-1.5 bg-slate-300 text-slate-500 text-[11px] font-bold rounded-xl cursor-not-allowed';
        }

        const loggedInUser = (sessionStorage.getItem('portalUser') || 'Unknown').toLowerCase().trim();
        const matchedUser = SYSTEM_TEAM.find(u => u.username === loggedInUser);
        const namaUserLengkap = matchedUser ? matchedUser.name : loggedInUser;
        const todayDateStr = new Date().toLocaleDateString('id-ID');

        const taskIdKey = taskId || taskTitle;
        let completedTasksMap = JSON.parse(localStorage.getItem('portal_completed_tasks') || '{}');
        completedTasksMap[taskIdKey] = { 
            catatan: catatan, 
            date: todayDateStr, 
            timestamp: new Date().toISOString() 
        };
        localStorage.setItem('portal_completed_tasks', JSON.stringify(completedTasksMap));

        allTaskLogs.push({
            'Hari': getIndonesianDayName(),
            'Nama User': namaUserLengkap,
            'Tugas yang Selesai': taskTitle,
            'Remark': catatan,
            'Tanggal & Jam Respons': getFormattedTimestamp()
        });

        renderMonitoringTable();
        updateInboxBadge();

        const payload = {
            hari: getIndonesianDayName(),
            nama_user: namaUserLengkap,
            tugas_selesai: taskTitle,
            remark: catatan,
            timestamp: getFormattedTimestamp()
        };

        try {
            await fetch(UPDATE_API_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            setTimeout(fetchMonitoringData, 1000);
        } catch (err) {
            console.error('Gagal mengirim update ke server:', err);
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

    const currentUserObj = SYSTEM_TEAM.find(u => u.username === loggedInUser) || { username: loggedInUser, name: loggedInUser, role: userRole };

    const pendingCount = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const assigned = getAssignedUsersForTask(task);
        const isAssignedToUser = assigned.some(u => u.username === loggedInUser);
        if (!isAssignedToUser) return false;

        const temporal = getTaskTemporalStatusForUser(task, currentUserObj);
        if (!temporal.isActionable) return false;

        return !isTaskCompletedByUser(task, currentUserObj);
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
    
    const currentUserObj = SYSTEM_TEAM.find(u => u.username === loggedInUser) || { username: loggedInUser, name: loggedInUser, role: userRole };

    let activeTasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        const assigned = getAssignedUsersForTask(task);
        if (!assigned.some(u => u.username === loggedInUser)) return false;

        const temporal = getTaskTemporalStatusForUser(task, currentUserObj);
        if (!temporal.isActionable) return false;

        return !isTaskCompletedByUser(task, currentUserObj);
    });

    container.innerHTML = '';
    if (activeTasks.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs font-medium">Tidak ada tugas pending untuk kriteria ini.</div>`;
    } else {
        activeTasks.forEach(task => {
            const temporal = getTaskTemporalStatusForUser(task, currentUserObj);
            const badgeWaktu = `<span class="text-[9px] ${temporal.colorClass} font-bold px-2 py-0.5 rounded-md">${temporal.label}</span>`;

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
