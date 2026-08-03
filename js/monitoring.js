/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (PREMIUM EXECUTIVE UI & FIXED ACCORDION STATE)
   ========================================================================== */
const MONITORING_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=1912450864&single=true&output=csv';
const LOG_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRbZXekvj6nyo6N6zuniiKEpmWXiXN-i3oWLN3oJth83nN28ENCibYOFy_cFgx1_GvULPrBHUJVDrcO/pub?gid=2043519577&single=true&output=csv';
const UPDATE_API_URL = 'https://script.google.com/macros/s/AKfycbylA9zPOniiBscbANH-8jzjpEuEPM1yCF8hQFGUOCqnZYyr0xGwq7AqqPweeK6OSFHarw/exec';

let allMonitoringTasks = [];
let allTaskLogs = [];
let currentTaskFilter = 'today'; 
let monitoringInterval = null;

// Memori state untuk mencatat ID baris collapse yang sedang dibuka user agar tidak tertutup sendiri saat refresh
let openTaskAccordions = new Set();

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

// Parser CSV Aman (Mengatasi teks yang mengandung koma di dalam tanda kutip)
function parseCSV(text) {
    const lines = text.split('\n');
    if (lines.length === 0) return [];
    
    const headers = parseCSVLine(lines[0]);
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const currentLine = parseCSVLine(lines[i]);
        const obj = {};
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j].trim()] = currentLine[j] ? currentLine[j].trim() : '';
        }
        result.push(obj);
    }
    return result;
}

function parseCSVLine(text) {
    const result = [];
    let insideQuotes = false;
    let entry = '';
    
    for (let i = 0; i < text.length; i++) {
        let c = text[i];
        if (c === '"') {
            insideQuotes = !insideQuotes;
        } else if (c === ',' && !insideQuotes) {
            result.push(entry);
            entry = '';
        } else {
            entry += c;
        }
    }
    result.push(entry);
    return result.map(item => item.replace(/^"|"$/g, '').trim());
}

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
    
    if (completedTasksMap[taskIdKey] && completedTasksMap[taskIdKey].date === todayDateStr) {
        return true;
    }

    return allTaskLogs.some(log => {
        const logUser = (log['Nama User'] || log.Nama_User || '').toLowerCase().trim();
        const logTugas = (log['Tugas yang Selesai'] || log.Tugas_yang_Selesai || log.TugasYangSelesai || '').toLowerCase().trim();
        const logTimestamp = (log['Tanggal & Jam Respons'] || log.Tanggal_Jam_Respons || log.Timestamp || '').trim();
        
        const matchUser = (logUser === targetName || logUser === targetUsername);
        const matchTugas = (logTugas === taskTitle);
        const matchDate = (logTimestamp.split(' ')[0] === todayDateStr);

        return matchUser && matchTugas && matchDate;
    });
}

function getTaskTemporalStatusForUser(task, userObj) {
    if (isTaskCompletedByUser(task, userObj)) {
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
            return { code: 'OVERDUE', label: 'Terlambat', colorClass: 'bg-rose-500 text-white', isActionable: true };
        } else {
            return { code: 'UPCOMING', label: 'Mendatang', colorClass: 'bg-slate-500 text-white', isActionable: false };
        }
    }

    if (jenis.includes('bulanan')) {
        const targetDateNum = parseInt(jadwalStr);
        if (!isNaN(targetDateNum)) {
            if (targetDateNum === currentDateNum) {
                return { code: 'TODAY', label: 'Hari Ini (On Going)', colorClass: 'bg-emerald-500 text-white', isActionable: true };
            } else if (targetDateNum < currentDateNum) {
                return { code: 'OVERDUE', label: 'Terlambat', colorClass: 'bg-rose-500 text-white', isActionable: true };
            } else {
                return { code: 'UPCOMING', label: 'Mendatang', colorClass: 'bg-slate-500 text-white', isActionable: false };
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
    }, 5000); // Disesuaikan jadi 5 detik agar lebih stabil
}

function removeTampilanTugasUI() {
    const allElements = document.querySelectorAll('*');
    allElements.forEach(el => {
        if (el.childNodes.length === 1 && el.textContent.includes('Tampilan Tugas')) {
            const parentContainer = el.closest('div.flex, div.bg-white, div');
            if (parentContainer) parentContainer.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initRealtimeMonitoring();
    fetchMonitoringData();
    setTimeout(removeTampilanTugasUI, 100);
    setInterval(removeTampilanTugasUI, 1000);
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
        alert('Akses ditolak. Fitur ini khusus untuk Admin.');
        return;
    }

    if (confirm('Yakin ingin mereset seluruh status tugas hari ini? Tombol pengerjaan tim akan diaktifkan kembali.')) {
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
            alert('Berhasil! Tombol pengerjaan tim telah aktif kembali.');
        }, 1200);
    }
};

function renderSuperiorDashboard(tbody) {
    removeTampilanTugasUI();
    let tasks = [...allMonitoringTasks].filter(task => task.Jenis_Tugas && task.Jenis_Tugas.trim() !== '');

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    tbody.innerHTML = '';

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-12 text-center text-slate-400 font-medium">Belum ada data tugas yang tersedia.</td></tr>`;
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

    let kpiHTML = `
    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-3xl text-white shadow-xl border border-slate-800">
        <div class="space-y-1">
            <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-xs font-black tracking-wider uppercase border border-amber-400/20">
                <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span> Mode Pengawas Aktif
            </div>
            <h4 class="text-base font-black tracking-wide text-white">Pusat Kendali Operasional Tim Lapangan</h4>
            <p class="text-xs text-slate-300">Memantau tingkat penyelesaian tugas seluruh ABM & BM secara langsung dan akurat.</p>
        </div>
        <button onclick="resetAllTasksCache()" class="px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-bold rounded-2xl shadow-lg shadow-rose-900/30 transition-all flex items-center gap-2 border border-rose-500/30 active:scale-95">
            <i data-lucide="rotate-ccw" class="w-4 h-4"></i> Buka Kunci Tombol Tim
        </button>
    </div>
    
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8 w-full">
        <div class="bg-gradient-to-br from-rose-50/80 via-white to-white border border-rose-200/80 rounded-3xl p-5 shadow-lg shadow-rose-900/5 relative overflow-hidden group">
            <div class="flex justify-between items-start mb-3">
                <p class="text-xs font-extrabold uppercase tracking-wider text-rose-600 flex items-center gap-2">
                    <span class="p-2 rounded-xl bg-rose-100 text-rose-600 shadow-inner"><i data-lucide="alert-circle" class="w-4 h-4"></i></span> Tugas Terlambat
                </p>
            </div>
            <h3 class="text-3xl font-black text-rose-900 tracking-tight">${attentionList.length} <span class="text-xs font-bold text-rose-500">Agenda</span></h3>
            <p class="text-[11px] text-slate-500 mt-2 font-medium">Memerlukan tindak lanjut segera.</p>
        </div>

        <div class="bg-gradient-to-br from-indigo-50/50 via-white to-white border border-indigo-100 rounded-3xl p-5 shadow-lg relative overflow-hidden group">
            <div class="flex justify-between items-start mb-3">
                <p class="text-xs font-extrabold uppercase tracking-wider text-indigo-600 flex items-center gap-2">
                    <span class="p-2 rounded-xl bg-indigo-100 text-indigo-600 shadow-inner"><i data-lucide="calendar-days" class="w-4 h-4"></i></span> Agenda Hari Ini
                </p>
            </div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">${todayList.length} <span class="text-xs font-bold text-indigo-500">Tugas Aktif</span></h3>
            <p class="text-[11px] text-slate-500 mt-2 font-medium">Target operasional hari ini.</p>
        </div>

        <div class="bg-gradient-to-br from-emerald-50/80 via-white to-white border border-emerald-200/80 rounded-3xl p-5 shadow-lg relative overflow-hidden group">
            <div class="flex justify-between items-start mb-3">
                <p class="text-xs font-extrabold uppercase tracking-wider text-emerald-600 flex items-center gap-2">
                    <span class="p-2 rounded-xl bg-emerald-100 text-emerald-600 shadow-inner"><i data-lucide="check-circle-2" class="w-4 h-4"></i></span> Tuntas Sempurna
                </p>
            </div>
            <h3 class="text-3xl font-black text-emerald-900 tracking-tight">${doneListCount} <span class="text-xs font-bold text-emerald-500">Tugas Selesai</span></h3>
            <p class="text-[11px] text-slate-500 mt-2 font-medium">Diselesaikan penuh oleh tim.</p>
        </div>

        <div class="bg-gradient-to-br from-amber-50/80 via-white to-white border border-amber-200/80 rounded-3xl p-5 shadow-lg relative overflow-hidden group">
            <div class="flex justify-between items-start mb-3">
                <p class="text-xs font-extrabold uppercase tracking-wider text-amber-600 flex items-center gap-2">
                    <span class="p-2 rounded-xl bg-amber-100 text-amber-600 shadow-inner"><i data-lucide="activity" class="w-4 h-4"></i></span> Efektivitas Kinerja
                </p>
            </div>
            <h3 class="text-3xl font-black text-slate-900 tracking-tight">${overallPercentage}%</h3>
            <p class="text-[11px] text-slate-500 mt-2 font-medium">Rasio penyelesaian keseluruhan.</p>
        </div>
    </div>`;

    let teamProgressHTML = `
    <div class="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xl mb-8 w-full">
        <h4 class="text-xs font-black uppercase tracking-wider text-slate-800 mb-5 flex items-center gap-2.5">
            <span class="p-2 rounded-xl bg-amber-500 text-white shadow-md"><i data-lucide="award" class="w-4 h-4"></i></span> Progress & Pencapaian Kinerja Personil
        </h4>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">`;

    Object.keys(personalStats).sort().forEach(key => {
        const p = personalStats[key];
        const pct = p.total > 0 ? Math.round((p.done / p.total) * 100) : 0;
        
        let barGradient = 'from-rose-500 to-red-600';
        let badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
        if (pct >= 100) {
            barGradient = 'from-emerald-500 to-teal-600';
            badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
        } else if (pct >= 50) {
            barGradient = 'from-amber-400 to-amber-500';
            badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
        }

        teamProgressHTML += `
            <div class="bg-gradient-to-b from-white via-slate-50/50 to-slate-100/60 p-4 rounded-2xl border border-slate-200/80 shadow-md flex flex-col justify-between group">
                <div>
                    <div class="flex justify-between items-center text-xs font-bold text-slate-800 mb-2">
                        <span class="truncate font-black text-slate-900">${p.name}</span>
                        <span class="px-2.5 py-1 ${badgeStyle} border rounded-xl text-[10px] font-black">${pct}%</span>
                    </div>
                    <p class="text-[11px] text-slate-500 font-medium mb-3">Tuntas: <strong class="text-slate-800">${p.done}</strong> dari ${p.total} tugas</p>
                </div>
                <div class="w-full bg-slate-200/80 h-2.5 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                    <div class="bg-gradient-to-r ${barGradient} h-full rounded-full transition-all duration-700" style="width: ${pct}%"></div>
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
            ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 font-extrabold rounded-xl border border-emerald-200 text-xs"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> SELESAI (${doneCount}/${assignedUsers.length})</span>`
            : (isUrgent 
                ? `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-50 text-rose-700 font-extrabold rounded-xl border border-rose-200 text-xs"><i data-lucide="alert-triangle" class="w-3.5 h-3.5"></i> TERLAMBAT</span>`
                : `<span class="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 font-extrabold rounded-xl border border-amber-200 text-xs"><i data-lucide="clock" class="w-3.5 h-3.5"></i> BERJALAN (${doneCount}/${assignedUsers.length})</span>`);

        let collapseHtml = assignedUsers.map(user => {
            const userDone = isTaskCompletedByUser(task, user);
            return `
                <div class="flex items-center justify-between py-2 px-3.5 bg-white rounded-xl border border-slate-200/80 text-xs shadow-xs">
                    <span class="font-bold text-slate-800">${user.name}</span>
                    <span class="px-2.5 py-0.5 rounded-lg text-[10px] font-black ${userDone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${userDone ? 'Selesai' : 'Pending'}
                    </span>
                </div>
            `;
        }).join('');

        // Cek apakah accordion ini sebelumnya sedang terbuka di memori
        const isCurrentlyOpen = openTaskAccordions.has(index);
        const collapseClass = isCurrentlyOpen ? '' : 'hidden';

        return `
            <tr class="${isUrgent ? 'bg-rose-50/20' : 'bg-white'} hover:bg-slate-50/80 transition-all border-b border-slate-100 cursor-pointer shadow-2xs" onclick="toggleTaskCollapse('${index}')">
                <td class="py-4 px-5 font-bold text-slate-800">${task.Jenis_Tugas || '-'}</td>
                <td class="py-4 px-5 font-extrabold text-amber-600 uppercase tracking-wide">${task.Target_User || 'Umum'}</td>
                <td class="py-4 px-5">
                    <p class="font-extrabold text-slate-900">${task.Judul_Tugas || '-'}</p>
                    <p class="text-[11px] text-amber-600 font-semibold mt-0.5">Klik untuk rincian ${assignedUsers.length} personil &or;</p>
                </td>
                <td class="py-4 px-5">
                    <div class="flex items-center gap-2.5">
                        <div class="w-24 bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200/60 shadow-inner">
                            <div class="${isAllDone ? 'bg-emerald-500' : (isUrgent ? 'bg-rose-500' : 'bg-amber-400')} h-full rounded-full transition-all" style="width: ${taskPct}%"></div>
                        </div>
                        <span class="text-[11px] font-black text-slate-600">${taskPct}%</span>
                    </div>
                </td>
                <td class="py-4 px-5 text-xs font-semibold ${isUrgent ? 'text-rose-600 font-bold' : 'text-slate-600'}">
                    Tgl ${task.Detail_Jadwal}
                </td>
                <td class="py-4 px-5">
                    <p class="text-xs font-semibold text-slate-700 italic bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-100">
                        "Progres: ${doneCount} dari ${assignedUsers.length} selesai"
                    </p>
                </td>
                <td class="py-4 px-5 text-center">${statusBadge}</td>
            </tr>
            <tr id="collapse-row-${index}" class="${collapseClass} bg-slate-50/80 border-b border-slate-200">
                <td colspan="7" class="p-5">
                    <div class="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-lg">
                        <p class="text-xs font-black text-slate-800 mb-3.5 uppercase tracking-wide flex items-center gap-2">
                            <i data-lucide="users" class="w-4 h-4 text-amber-500"></i> Rincian Status Personil Ter-Assign (${assignedUsers.length} Orang):
                        </p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                            ${collapseHtml}
                        </div>
                    </div>
                </td>
            </tr>
        `;
    };

    if (attentionList.length > 0) {
        rowsHTML += `<tr class="bg-rose-100/90 font-black text-rose-900 border-y border-rose-200"><td colspan="7" class="py-3 px-5 text-xs uppercase tracking-wider">⚠️ Perhatian Khusus: Tugas Terlambat / Overdue (${attentionList.length})</td></tr>`;
        attentionList.forEach((task, idx) => { rowsHTML += renderRowWithCollapse(task, 'att-' + idx); });
    }

    rowsHTML += `<tr class="bg-slate-100 font-black text-slate-800 border-y border-slate-200"><td colspan="7" class="py-3 px-5 text-xs uppercase tracking-wider">📅 Daftar Tugas Berjalan & Aktif</td></tr>`;
    
    let activeTasks = todayList;
    if (activeTasks.length === 0) {
        rowsHTML += `<tr><td colspan="7" class="py-8 text-center text-slate-400 text-xs">Tidak ada tugas aktif dalam kategori ini.</td></tr>`;
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

// Fungsi Toggle dengan memori pencatat agar tidak tertutup otomatis saat data ter-refresh
window.toggleTaskCollapse = function(index) {
    const collapseRow = document.getElementById(`collapse-row-${index}`);
    if (collapseRow) {
        collapseRow.classList.toggle('hidden');
        
        // Simpan status ke Set memori
        if (collapseRow.classList.contains('hidden')) {
            openTaskAccordions.delete(index);
        } else {
            openTaskAccordions.add(index);
        }
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
            ? `<span class="px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200">Selesai</span>`
            : `<span class="px-3 py-1 bg-amber-50 text-amber-700 font-bold rounded-xl border border-amber-200">Pending (${statusObj.label})</span>`;

        const actionButton = isCompleted
            ? `<button disabled class="px-4 py-2 bg-slate-200 text-slate-400 text-xs font-bold rounded-xl cursor-not-allowed">Sudah Selesai</button>`
            : `<button onclick="openResponseModal(this, '${task.ID_Tugas || index}', '${task.Judul_Tugas}')" class="px-4 py-2 bg-slate-900 hover:bg-amber-500 text-white text-xs font-bold rounded-xl transition-all shadow-md active:scale-95">Selesaikan</button>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 bg-white shadow-2xs">
                <td class="py-4 px-5 font-bold text-slate-800">${task.Jenis_Tugas || '-'}</td>
                <td class="py-4 px-5 text-slate-600 font-semibold">${task.Detail_Jadwal || '-'}</td>
                <td class="py-4 px-5 font-bold text-slate-700 uppercase">${task.Target_User || '-'}</td>
                <td class="py-4 px-5"><p class="font-extrabold text-slate-900">${task.Judul_Tugas || '-'}</p></td>
                <td class="py-4 px-5"><p class="text-xs italic text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">"${task.Catatan_User || '-'}"</p></td>
                <td class="py-4 px-5 text-center">${statusBadge}</td>
                <td class="py-4 px-5 text-center">${actionButton}</td>
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
            buttonElement.className = 'px-4 py-2 bg-slate-300 text-slate-600 text-xs font-bold rounded-xl cursor-not-allowed';
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
