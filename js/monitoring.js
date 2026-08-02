/* ==========================================================================
   MODUL MONITORING TUGAS & INBOX (WIB FILTER)
   ========================================================================== */
const MONITORING_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=1912450864&single=true&output=csv';
let allMonitoringTasks = [];
let currentTaskFilter = 'today'; // Default menampilkan hari ini
let currentInboxFilter = 'today';

// Mendapatkan Hari & Tanggal sesuai zona waktu WIB (Asia/Jakarta)
function getWIBDateInfo() {
    const now = new Date();
    const weekdayName = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long' }).format(now).toLowerCase(); // e.g. "senin"
    const dayNumber = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric' }).format(now); // e.g. "6"
    return { weekdayName, dayNumber };
}

// Cek apakah tugas aktif pada hari ini (WIB)
function isTaskForToday(task) {
    const jenis = (task.Jenis_Tugas || '').toLowerCase();
    const jadwal = (task.Detail_Jadwal || '').trim().toLowerCase();
    const { weekdayName, dayNumber } = getWIBDateInfo();

    if (jenis.includes('mingguan')) {
        return jadwal === weekdayName;
    } else if (jenis.includes('bulanan')) {
        return jadwal === dayNumber;
    } else {
        return true; // Tugasan biasa / add-on selalu dimunculkan
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

// Ambil Data dari Google Sheets Monitoring Tugas
async function fetchMonitoringData() {
    try {
        const response = await fetch(MONITORING_API_URL);
        const csvText = await response.text();
        allMonitoringTasks = parseCSV(csvText); // Menggunakan fungsi parseCSV global dari app.js
        renderMonitoringTable();
        updateInboxBadge();
    } catch (error) {
        console.error('Gagal mengambil data monitoring tugas:', error);
    }
}

// Render Tabel Monitoring Progress dengan Filter
function renderMonitoringTable() {
    const tbody = document.getElementById('monitoringTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase();

    let tasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        if (userRole === 'admin') return true;
        const target = (task.Target_User || '').toLowerCase();
        return target === loggedInUser || target === userRole;
    });

    if (currentTaskFilter === 'today') {
        tasks = tasks.filter(task => isTaskForToday(task));
    }

    if (tasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400 font-medium">Tidak ada tugasan aktif untuk kriteria ini.</td></tr>`;
        return;
    }

    tasks.forEach((task) => {
        const isCompleted = (task.Status || '').toLowerCase() === 'selesai';
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 font-bold rounded-lg border border-emerald-100">Selesai</span>`
            : `<span class="px-2.5 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg border border-amber-100">Pending</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-4 font-bold text-slate-700">${task.Jenis_Tugas || '-'}</td>
                <td class="py-3 px-4 text-slate-500 font-medium">${task.Detail_Jadwal || '-'}</td>
                <td class="py-3 px-4 font-semibold text-slate-600 uppercase">${task.Target_User || '-'}</td>
                <td class="py-3 px-4">
                    <p class="font-extrabold text-slate-800">${task.Judul_Tugas || '-'}</p>
                    <p class="text-[11px] text-slate-400 mt-0.5">${task.Deskripsi || '-'}</p>
                </td>
                <td class="py-3 px-4">${statusBadge}</td>
                <td class="py-3 px-4 text-center">
                    <span class="text-xs font-semibold text-slate-500">${task.Catatan_User || 'Belum ada respon'}</span>
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
}

// Badge Notifikasi Inbox
function updateInboxBadge() {
    const badge = document.getElementById('inboxBadge');
    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase();

    const pendingCount = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas || (task.Status || '').toLowerCase() === 'selesai') return false;
        if (userRole === 'admin') return true;
        const target = (task.Target_User || '').toLowerCase();
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

// Modal Inbox Pop-up dengan Filter WIB
function toggleInboxModal(isRefresh = false) {
    const modal = document.getElementById('inboxModal');
    const container = document.getElementById('inboxListContainer');
    if (!modal || !container) return;

    if (!modal.classList.contains('hidden') && !isRefresh) {
        modal.classList.add('hidden');
        return;
    }

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase();
    
    let activeTasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas || (task.Status || '').toLowerCase() === 'selesai') return false;
        if (userRole === 'admin') return true;
        const target = (task.Target_User || '').toLowerCase();
        return target === loggedInUser || target === userRole;
    });

    if (currentInboxFilter === 'today') {
        activeTasks = activeTasks.filter(task => isTaskForToday(task));
    }

    container.innerHTML = '';
    if (activeTasks.length === 0) {
        container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs font-medium">Tidak ada tugas pending untuk kategori ini.</div>`;
    } else {
        activeTasks.forEach(task => {
            container.innerHTML += `
                <div class="bg-amber-50/50 border border-amber-100 p-3.5 rounded-2xl flex flex-col gap-2">
                    <div class="flex justify-between items-start">
                        <span class="text-[10px] font-extrabold uppercase bg-amber-500 text-white px-2 py-0.5 rounded-md">${task.Jenis_Tugas}</span>
                        <span class="text-[10px] text-slate-400 font-bold">Jadwal: ${task.Detail_Jadwal}</span>
                    </div>
                    <div>
                        <h4 class="text-xs font-black text-slate-800">${task.Judul_Tugas}</h4>
                        <p class="text-[11px] text-slate-600 mt-0.5">${task.Deskripsi}</p>
                    </div>
                    <button onclick="switchView('monitoring'); toggleInboxModal();" class="self-end mt-1 px-3 py-1 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-amber-500 transition-all">
                        Buka Menu Monitoring &rarr;
                    </button>
                </div>
            `;
        });
    }
    modal.classList.remove('hidden');
    lucide.createIcons();
}
