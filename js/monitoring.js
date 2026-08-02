/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (WIB FILTER & INTERACTIVE ACTION)
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
        const response = await fetch(MONITORING_API_URL);
        const csvText = await response.text();
        allMonitoringTasks = parseCSV(csvText);
        renderMonitoringTable();
        updateInboxBadge();
    } catch (error) {
        console.error('Gagal mengambil data monitoring tugas:', error);
    }
}

function renderMonitoringTable() {
    const tbody = document.getElementById('monitoringTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase().trim();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase().trim();

    // Admin tetap bisa melihat SEMUA tugas tim di menu utama Monitoring Tugas
    let tasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        if (userRole === 'admin' || loggedInUser === 'admin') return true;
        const target = (task.Target_User || '').toLowerCase().trim();
        return target === loggedInUser || target === userRole;
    });

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="py-6 text-center text-slate-400 font-medium">Tidak ada tugasan aktif untuk kriteria ini.</td></tr>`;
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
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-50">
                <td class="py-3 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3 px-4 text-slate-500 font-medium">${task.Detail_Jadwal || '-'}</td>
                <td class="py-3 px-4 font-semibold text-slate-600 uppercase">${task.Target_User || '-'}</td>
                <td class="py-3 px-4">
                    <p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">${task.Deskripsi || '-'}</p>
                </td>
                <td class="py-3 px-4">
                    <p class="text-xs font-semibold text-slate-700 italic bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
                        "${task.Catatan_User || 'Belum ada catatan'}"
                    </p>
                </td>
                <td class="py-3 px-4 text-center">${statusBadge}</td>
                <td class="py-3 px-4 text-center w-36">
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
