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
    const jenis = (task.Jenis_Tugas || '').toLowerCase();
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

// Render Tabel Monitoring Progress dengan Tombol Aksi Interaktif
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

    tasks.forEach((task, index) => {
        const isCompleted = (task.Status || '').toLowerCase() === 'selesai';
        const statusBadge = isCompleted 
            ? `<span class="px-2.5 py-1 bg-emerald-50 text-emerald-600 font-bold rounded-lg border border-emerald-100">Selesai</span>`
            : `<span class="px-2.5 py-1 bg-amber-50 text-amber-600 font-bold rounded-lg border border-amber-100">Pending</span>`;

        // Tombol interaktif untuk ABM/BM merespon tugas
        const actionButton = `
            <button onclick="openResponseModal('${task.ID_Tugas || index}', '${task.Judul_Tugas}')" class="px-3 py-1.5 bg-slate-900 hover:bg-amber-500 text-white font-bold rounded-xl transition-all shadow-xs text-[11px]">
                ${isCompleted ? 'Ubah Respon' : 'Beri Respon / Selesai'}
            </button>
        `;

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
                    <div class="flex flex-col items-center gap-1.5">
                        <span class="text-xs font-semibold text-slate-600 italic">"${task.Catatan_User || 'Belum ada respon'}"</span>
                        ${actionButton}
                    </div>
                </td>
            </tr>
        `;
    });
    lucide.createIcons();
}

// Fungsi Pop-up Sederhana untuk Input Respon/Feedback oleh ABM/BM
function openResponseModal(taskId, taskTitle) {
    const catatan = prompt(`Berikan catatan / feedback untuk tugas:\n"${taskTitle}"\n\n(Ketik catatan pengerjaan atau kendala):`, "Selesai dikerjakan dengan baik");
    
    if (catatan !== null) {
        // Cari tugas di array dan ubah status serta catatannya secara lokal
        const targetTask = allMonitoringTasks.find(t => (t.ID_Tugas || '') === taskId || t.Judul_Tugas === taskTitle);
        if (targetTask) {
            targetTask.Status = 'Selesai';
            targetTask.Catatan_User = catatan;
            
            // Re-render tabel dan update badge inbox
            renderMonitoringTable();
            updateInboxBadge();
            
            alert("Respon berhasil disimpan! Status tugas berubah menjadi Selesai.");
            // Catatan: Karena data dibaca dari Google Sheet publik via CSV, 
            // perubahan ini bersifat real-time di sesi browser. 
            // Untuk penyimpanan permanen lintas perangkat, baris di Google Sheet perlu diupdate via Web App / Apps Script.
        }
    }
}

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
