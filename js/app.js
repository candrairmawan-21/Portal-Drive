/* ==========================================================================
   1. KONFIGURASI API & DATA GLOBAL PORTAL
   ========================================================================== */
const API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=119812050&single=true&output=csv';
const MONITORING_API_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSLSxNv5RprtBuF1wZEylbpaO0hVA3M67_9-zdIrv5pX7lyKV1duYNfQKgcRIOD6_aATKTWjC3dSYyQ/pub?gid=1912450864&single=true&output=csv';

let allFiles = []; 
let accessibleFiles = []; 
let currentPath = []; 
let currentViewLayout = 'grid'; 
let isSidebarCollapsed = false;
let pendingUrl = ''; 
let pendingPassword = '';
let allMonitoringTasks = [];

const userDatabase = {
    'admin': 'admin', 'guest': 'guest',
    'bm agus': 'BM', 'bm didik': 'BM', 'bm galih': 'BM',
    'abm anas': 'ABM', 'abm bayu': 'ABM', 'abm ika': 'ABM', 'abm adinda': 'ABM',
    'abm ridho': 'ABM', 'abm fachri': 'ABM', 'abm gading': 'ABM', 'abm wildan': 'ABM', 'abm satria': 'ABM',
    'jc2017': 'staff', 'jc8001': 'staff', 'jc2021': 'staff', 'jc1029': 'staff', 'jc1020': 'staff',
    'jc3001': 'staff', 'jc2001': 'staff', 'jc2008': 'staff', 'jc5005': 'staff', 'jc6003': 'staff',
    'jc2012': 'staff', 'jc1014': 'staff', 'jc2018': 'staff', 'jc4006': 'staff', 'jc8005': 'staff',
    'jc3003': 'staff', 'jc1005': 'staff', 'jc5002': 'staff', 'jc1012': 'staff', 'jc2002': 'staff',
    'jc5003': 'staff', 'jc8006': 'staff', 'jc2016': 'staff', 'jc1027': 'staff', 'jc8004': 'staff'
};

/* ==========================================================================
   2. SISTEM NAVIGASI & SIDEBAR CONTROLLER
   ========================================================================== */
function toggleSidebarCollapse() {
    const sidebar = document.getElementById('sidebarMenu');
    const textElements = document.querySelectorAll('.sidebar-text-element');
    const icon = document.getElementById('collapseBtnIcon');

    isSidebarCollapsed = !isSidebarCollapsed;

    if (isSidebarCollapsed) {
        sidebar.classList.remove('w-64');
        sidebar.classList.add('w-20');
        textElements.forEach(el => el.classList.add('hidden'));
        icon.setAttribute('data-lucide', 'chevron-right');
    } else {
        sidebar.classList.remove('w-20');
        sidebar.classList.add('w-64');
        textElements.forEach(el => el.classList.remove('hidden'));
        icon.setAttribute('data-lucide', 'chevron-left');
    }
    lucide.createIcons();
}

function toggleSidebarMobile() {
    const sidebar = document.getElementById('sidebarMenu');
    const backdrop = document.getElementById('sidebarBackdrop');
    sidebar.classList.toggle('-translate-x-full');
    backdrop.classList.toggle('hidden');
}

/* ==========================================================================
   3. PENGATUR MODAL AKSES EKSTERNAL BER-PASSWORD
   ========================================================================== */
function showPasswordModal(password, url) {
    pendingPassword = password;
    pendingUrl = url;
    document.getElementById('modalPasswordText').innerText = password;
    document.getElementById('copyBtnText').innerText = 'Copy';
    document.getElementById('passwordModal').classList.remove('hidden');
    lucide.createIcons();
}

function copyModalPassword() {
    navigator.clipboard.writeText(pendingPassword).then(() => {
        const btnText = document.getElementById('copyBtnText');
        btnText.innerText = 'Tersalin!';
        setTimeout(() => { btnText.innerText = 'Copy'; }, 2000);
    });
}

function confirmAndOpenLink() {
    document.getElementById('passwordModal').classList.add('hidden');
    if (pendingUrl) window.open(pendingUrl, '_blank');
}

function closePasswordModal() {
    document.getElementById('passwordModal').classList.add('hidden');
}

function openCekPengiriman(event) {
    event.preventDefault();
    showPasswordModal('jabarjatengjuara', 'https://www.jawara26.biz.id/2026/04/cek-pengiriman-barang-dm-candra.html');
}

function openCekBarcode(event) {
    event.preventDefault();
    showPasswordModal('cekskujawara', 'https://sku.jawara26.biz.id');
}

function openCekDataSKU(event) {
    event.preventDefault();
    showPasswordModal('cekdatasku', 'https://cari.jawara26.biz.id/');
}

/* ==========================================================================
   4. HANDBOOK ATTITUDE POP-UP & 4 PILIHAN BAHASA (EN, ID, SU, JV)
   ========================================================================== */
const attitudeTranslations = {
    en: "Remember that our handbook said : Attitude is more important than the past, than education, than money, than circumstances, than what people do or say. It is more important than appearance, giftedness or skill",
    id: "Ingatlah bahwa buku panduan kita mengatakan: Sikap jauh lebih penting daripada masa lalu, daripada pendidikan, daripada uang, daripada keadaan, daripada apa yang orang lakukan atau katakan. Sikap lebih penting daripada penampilan, bakat, atau keterampilan.",
    su: "Inget yén buku panduan urang nyarios: Sikap langkung penting tibatan emutan jaman baheula, tibatan pendidikan, tibatan artos, tibatan kaayaan, tibatan naon anu dilakukeun atanapi diucapkeun ku jalma. Éta langkung penting tibatan penampilan, bakat, atanapi katerampilan.",
    jv: "Elinga, jarene buku pandhuan kita: Sikap kuwi luwih penting tinimbang biyen, tinimbang sekolah, tinimbang dhuwit, tinimbang kahanan, utawa apa sing dilakoni lan diomongake wong liyo. Sikap kuwi luwih penting tinimbang penampilan, bakat, utawa keahlian."
};

function changeAttitudeLanguage(lang) {
    const textElement = document.getElementById('attitudeQuoteText');
    if (textElement && attitudeTranslations[lang]) {
        textElement.innerText = `"${attitudeTranslations[lang]}"`;
    }
}

function showAttitudeModal() {
    const modal = document.getElementById('attitudeModal');
    if (modal) {
        const select = document.getElementById('attitudeLangSelect');
        if (select) select.value = 'en';
        changeAttitudeLanguage('en');

        modal.classList.remove('hidden');
        lucide.createIcons();
    }
}

function closeAttitudeModal() {
    const modal = document.getElementById('attitudeModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

/* ==========================================================================
   5. SISTEM PERPINDAHAN HALAMAN & OTORISASI GUEST / ROLE RESTRICTIONS
   ========================================================================== */
function applyGuestRestrictions() {
    const role = sessionStorage.getItem('portalRole');
    const hiddenForGuest = [
        'menu-files', 'menu-dashboard', 'menu-sales',
        'menu-cek-pengiriman', 'menu-cek-barcode', 'menu-cek-sku'
    ];
    
    hiddenForGuest.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (role === 'guest') el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });

    // Batasi akses menu Monitoring Progress (Hanya Admin, BM, ABM)
    const menuMonitoring = document.getElementById('menu-monitoring');
    if (menuMonitoring) {
        if (role === 'staff' || role === 'guest') {
            menuMonitoring.classList.add('hidden');
        } else {
            menuMonitoring.classList.remove('hidden');
        }
    }
}

function switchView(view) {
    sessionStorage.setItem('lastActiveView', view); 

    const allSections = ['files', 'dashboard', 'sales', 'damage', 'monitoring', 'itemize', 'fast-moving'];
    allSections.forEach(id => {
        const el = document.getElementById('section-' + id);
        if(el) el.classList.add('hidden');
    });
              
    // Reset warna tombol navigasi standar
    const standardButtons = ['files', 'dashboard', 'sales', 'damage', 'monitoring'];
    standardButtons.forEach(id => {
        let btnId;
        if (id === 'damage') btnId = 'nav-damage';
        else if (id === 'monitoring') btnId = 'menu-monitoring';
        else btnId = 'menu-' + id;

        const btn = document.getElementById(btnId);
        
        if(btn) {
            btn.classList.remove('bg-amber-500', 'text-white', 'bg-slate-800/50');
            btn.classList.add('text-slate-400');
            
            const icon = btn.querySelector('i');
            if (icon && (id === 'damage' || id === 'monitoring')) icon.classList.remove('text-amber-500');
        }
    });

    // Reset warna sub-menu Analyze
    const analyzeSubBtns = ['nav-itemize', 'nav-fast-moving'];
    analyzeSubBtns.forEach(btnId => {
        const btn = document.getElementById(btnId);
        if(btn) {
            btn.classList.remove('bg-amber-500', 'text-white');
            btn.classList.add('text-slate-400');
            const icon = btn.querySelector('i');
            if(icon) icon.classList.remove('text-amber-500');
        }
    });

    const title = document.getElementById('pageTitle');
    const fileTools = document.getElementById('fileTools');

    if (view === 'dashboard') {
        document.getElementById('section-dashboard').classList.remove('hidden');
        document.getElementById('menu-dashboard').classList.remove('text-slate-400');
        document.getElementById('menu-dashboard').classList.add('bg-amber-500', 'text-white');
        title.innerText = "Performa UPT Dashboard";
        if(fileTools) fileTools.classList.add('invisible');
        if (typeof fetchDashboardData === "function") fetchDashboardData();
        
        setTimeout(() => {
            if (window.bmChartInstance && typeof window.bmChartInstance.update === 'function') {
                window.bmChartInstance.update();
            }
        }, 200);
        
    } else if (view === 'sales') {
        document.getElementById('section-sales').classList.remove('hidden');
        document.getElementById('menu-sales').classList.remove('text-slate-400');
        document.getElementById('menu-sales').classList.add('bg-amber-500', 'text-white');
        title.innerText = "Sales Target Dashboard";
        if(fileTools) fileTools.classList.add('invisible');
        if (typeof fetchSalesData === "function") fetchSalesData();
        
        setTimeout(() => {
            if (window.salesTargetChartInstance && typeof window.salesTargetChartInstance.update === 'function') {
                window.salesTargetChartInstance.update();
            }
        }, 200);
        
    } else if (view === 'damage') {
        document.getElementById('section-damage').classList.remove('hidden');
        document.getElementById('nav-damage').classList.remove('text-slate-400');
        document.getElementById('nav-damage').classList.add('bg-slate-800/50', 'text-white');
        
        const icon = document.getElementById('nav-damage').querySelector('i');
        if (icon) icon.classList.add('text-amber-500');
        
        title.innerText = "F003 Builder";
        if(fileTools) fileTools.classList.add('invisible');
        
    } else if (view === 'monitoring') {
        document.getElementById('section-monitoring').classList.remove('hidden');
        const monBtn = document.getElementById('menu-monitoring');
        if(monBtn) {
            monBtn.classList.remove('text-slate-400');
            monBtn.classList.add('bg-amber-500', 'text-white');
            const icon = monBtn.querySelector('i');
            if(icon) icon.classList.add('text-amber-500');
        }
        title.innerText = "Monitoring Progress Tugasan Rutin";
        if(fileTools) fileTools.classList.add('invisible');
        fetchMonitoringData();

    } else if (view === 'itemize') {
        document.getElementById('section-itemize').classList.remove('hidden');
        const itemizeBtn = document.getElementById('nav-itemize');
        if(itemizeBtn) {
            itemizeBtn.classList.remove('text-slate-400');
            itemizeBtn.classList.add('bg-amber-500', 'text-white');
            const icon = itemizeBtn.querySelector('i');
            if(icon) icon.classList.add('text-amber-500');
        }
        title.innerText = "Itemize - Analisa Anomali Scan";
        if(fileTools) fileTools.classList.add('invisible');

    } else if (view === 'fast-moving') {
        document.getElementById('section-fast-moving').classList.remove('hidden');
        const fmBtn = document.getElementById('nav-fast-moving');
        if(fmBtn) {
            fmBtn.classList.remove('text-slate-400');
            fmBtn.classList.add('bg-amber-500', 'text-white');
            const icon = fmBtn.querySelector('i');
            if(icon) icon.classList.add('text-amber-500');
        }
        title.innerText = "Fast moving sku for TF";
        if(fileTools) fileTools.classList.add('invisible');

    } else {
        document.getElementById('section-files').classList.remove('hidden');
        document.getElementById('menu-files').classList.remove('text-slate-400');
        document.getElementById('menu-files').classList.add('bg-amber-500', 'text-white');
        title.innerText = "File Manager";
        if(fileTools) fileTools.classList.remove('invisible');
    }

    if(window.innerWidth < 768) toggleSidebarMobile();
}

/* ==========================================================================
   6. LOGIKA FILE MANAGER & DATA PARSING DARI GOOGLE SHEET
   ========================================================================== */
function parseCSV(text) {
    let lines = text.split('\n');
    let headers = lines[0].split(',').map(h => h.replace(/["\r]/g, "").trim());
    let result = [];
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        let row = []; let inQuotes = false; let currentStr = "";
        for (let char of lines[i]) {
            if (char === '"') { inQuotes = !inQuotes; } 
            else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; } 
            else { currentStr += char; }
        }
        row.push(currentStr.trim()); let obj = {};
        headers.forEach((header, index) => { obj[header] = row[index] ? row[index].replace(/[\r"]/g, "") : ""; });
        result.push(obj);
    }
    return result;
}

async function fetchData() {
    try {
        const response = await fetch(API_URL);
        const csvText = await response.text();
        allFiles = parseCSV(csvText);
        filterAndRender(); 
    } catch (error) {
        console.error('Error:', error);
    }
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

    const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase();
    const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase();

    const filteredTasks = allMonitoringTasks.filter(task => {
        if (!task.Jenis_Tugas) return false;
        if (userRole === 'admin') return true;
        
        const target = (task.Target_User || '').toLowerCase();
        return target === loggedInUser || target === userRole;
    });

    if (filteredTasks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="py-6 text-center text-slate-400 font-medium">Tidak ada tugasan aktif saat ini.</td></tr>`;
        return;
    }

    filteredTasks.forEach((task, index) => {
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

function toggleInboxModal() {
    const modal = document.getElementById('inboxModal');
    const container = document.getElementById('inboxListContainer');
    if (!modal || !container) return;

    if (modal.classList.contains('hidden')) {
        const loggedInUser = (sessionStorage.getItem('portalUser') || '').toLowerCase();
        const userRole = (sessionStorage.getItem('portalRole') || '').toLowerCase();
        
        const activeTasks = allMonitoringTasks.filter(task => {
            if (!task.Jenis_Tugas || (task.Status || '').toLowerCase() === 'selesai') return false;
            if (userRole === 'admin') return true;
            const target = (task.Target_User || '').toLowerCase();
            return target === loggedInUser || target === userRole;
        });

        container.innerHTML = '';
        if (activeTasks.length === 0) {
            container.innerHTML = `<div class="text-center py-6 text-slate-400 text-xs font-medium">Kotak masuk bersih! Tidak ada tugas pending.</div>`;
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
    } else {
        modal.classList.add('hidden');
    }
    lucide.createIcons();
}

function filterAndRender() {
    const loggedInUser = sessionStorage.getItem('portalUser') || localStorage.getItem('username') || '';
    accessibleFiles = allFiles.filter(file => {
        if (loggedInUser === 'admin') return true;
        const fileTargetUser = file.Username ? file.Username.trim().toLowerCase() : '';
        if (fileTargetUser === '') return true;
        if (fileTargetUser === 'abm') return loggedInUser.startsWith('abm') || loggedInUser.startsWith('bm');
        return (fileTargetUser === loggedInUser);
    });
    history.pushState({ pathDepth: 0 }, ""); 
    renderPortal();
}

function getIconByKategori(kategori, itemName = '') {
    const text = ((kategori || '') + ' ' + (itemName || '')).toLowerCase();
    if (text.includes('manpower') || text.includes('hr') || text.includes('karyawan') || text.includes('staff') || text.includes('team')) {
        return { name: 'users', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
    }
    if (text.includes('sales') || text.includes('monitoring') || text.includes('target') || text.includes('revenue') || text.includes('finance')) {
        return { name: 'trending-up', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    }
    if (text.includes('damage') || text.includes('f003') || text.includes('rusak') || text.includes('retur')) {
        return { name: 'file-warning', bg: 'bg-rose-50 text-rose-600 border-rose-100' };
    }
    if (text.includes('excel') || text.includes('sheet') || text.includes('xls') || text.includes('rekap') || text.includes('template')) {
        return { name: 'file-spreadsheet', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
    }
    if (text.includes('pdf') || text.includes('sop') || text.includes('panduan') || text.includes('doc')) {
        return { name: 'file-text', bg: 'bg-rose-50 text-rose-600 border-rose-100' };
    }
    if (text.includes('folder') || text.includes('drive')) {
        return { name: 'folder-open', bg: 'bg-amber-50 text-amber-600 border-amber-100' };
    }
    return { name: 'folder', bg: 'bg-slate-50 text-slate-600 border-slate-200' };
}

function renderPortal() {
    const grid = document.getElementById('portalGrid');
    const noResults = document.getElementById('noResults');
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    renderBreadcrumbs(); 
    grid.innerHTML = '';

    if (currentViewLayout === 'list') { 
        grid.className = "flex flex-col gap-3 w-full animate-[fadeIn_0.2s_ease-out]"; 
    } else { 
        grid.className = "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 animate-[fadeIn_0.3s_ease-out]"; 
    }

    if (searchTerm) {
        const filtered = accessibleFiles.filter(f => (f.Nama && f.Nama.toLowerCase().includes(searchTerm)));
        if(filtered.length === 0) { noResults.classList.remove('hidden'); return; }
        noResults.classList.add('hidden'); renderFilesOnly(filtered, grid); lucide.createIcons(); return;
    }

    const currentFolderStr = currentPath.join(' / ');
    let SubFolders = new Set(); let filesInThisFolder = [];

    accessibleFiles.forEach(file => {
        const itemFolderStr = file.Folder ? file.Folder.trim() : '';
        if (currentPath.length === 0) {
            if (!itemFolderStr) { filesInThisFolder.push(file); } else { SubFolders.add(itemFolderStr.split(' / ')[0]); }
        } else {
            if (itemFolderStr === currentFolderStr) { filesInThisFolder.push(file); } 
            else if (itemFolderStr.startsWith(currentFolderStr + ' / ')) {
                let remainder = itemFolderStr.substring((currentFolderStr + ' / ').length);
                SubFolders.add(remainder.split(' / ')[0]);
            }
        }
    });

    if (SubFolders.size === 0 && filesInThisFolder.length === 0) { noResults.classList.remove('hidden'); return; }
    noResults.classList.add('hidden');

    SubFolders.forEach(folderName => {
        if(!folderName) return;
        const folderIcon = getIconByKategori('', folderName);
        
        if (currentViewLayout === 'list') {
            grid.innerHTML += `<div onclick="navigateToFolder('${folderName}')" class="bg-white rounded-2xl border border-slate-200/60 p-4 flex items-center justify-between cursor-pointer hover:bg-amber-50/10 transition-all group"><div class="flex items-center gap-4"><div class="bg-amber-500/10 text-amber-600 p-2.5 rounded-xl flex items-center justify-center"><i data-lucide="folder" class="w-5 h-5 fill-current"></i></div><div><h3 class="font-extrabold text-slate-700 text-sm group-hover:text-amber-600 transition-colors">${folderName}</h3></div></div><i data-lucide="chevron-right" class="w-4 h-4 text-slate-300"></i></div>`;
        } else {
            grid.innerHTML += `<div onclick="navigateToFolder('${folderName}')" class="group bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-400/60 transition-all flex items-center gap-3 cursor-pointer">
                <div class="w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 group-hover:scale-105 ${folderIcon.bg}">
                    <i data-lucide="${folderIcon.name}" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <h3 class="text-xs font-black text-slate-800 truncate group-hover:text-amber-600 transition-colors">${folderName}</h3>
                    <p class="text-[10px] text-slate-400 font-medium truncate mt-0.5">Folder Direktori</p>
                </div>
                <div class="text-slate-300 group-hover:text-amber-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </div>
            </div>`;
        }
    });

    renderFilesOnly(filesInThisFolder, grid); lucide.createIcons();
}

function renderFilesOnly(files, container) {
    files.forEach(file => {
        if(!file.Nama) return; 
        const iconConf = getIconByKategori(file.Kategori, file.Nama);
        if (currentViewLayout === 'list') {
            container.innerHTML += `<div onclick="window.open('${file.Link || '#'}', '_blank')" class="bg-white rounded-2xl border border-slate-200/50 p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-all group"><div class="flex items-center gap-4 text-left min-w-0 flex-1"><div class="${iconConf.bg} p-2.5 rounded-xl border flex items-center justify-center flex-shrink-0"><i data-lucide="${iconConf.name}" class="w-5 h-5"></i></div><div class="min-w-0 flex-1"><h3 class="text-sm font-extrabold text-slate-800 truncate group-hover:text-amber-600" title="${file.Nama}">${file.Nama}</h3></div></div><i data-lucide="external-link" class="w-4 h-4 text-slate-300"></i></div>`;
        } else {
            container.innerHTML += `<div onclick="window.open('${file.Link || '#'}', '_blank')" class="group bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-amber-400/60 transition-all flex items-center gap-3 cursor-pointer relative">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center border shrink-0 group-hover:scale-105 ${iconConf.bg}">
                    <i data-lucide="${iconConf.name}" class="w-5 h-5"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <h3 class="text-xs font-black text-slate-800 truncate group-hover:text-amber-600 transition-colors" title="${file.Nama}">${file.Nama}</h3>
                    <p class="text-[10px] text-slate-400 font-medium truncate mt-0.5">${file.Kategori || 'Dokumen'}</p>
                </div>
                <div class="text-slate-300 group-hover:text-amber-500 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
                </div>
            </div>`;
        }
    });
}

function renderBreadcrumbs() {
    const container = document.getElementById('breadcrumbs');
    let html = `<span class="cursor-pointer font-bold text-amber-600 hover:text-amber-700 flex items-center gap-1" onclick="jumpToBreadcrumb(-1)"><i data-lucide="home" class="w-3.5 h-3.5"></i> Home</span>`;
    currentPath.forEach((folder, index) => { html += ` <span class="text-slate-300"><i data-lucide="chevron-right" class="w-3.5 h-3.5"></i></span> <span class="cursor-pointer text-slate-500 font-semibold" onclick="jumpToBreadcrumb(${index})">${folder}</span>`; });
    container.innerHTML = html;
}

function navigateToFolder(name) { 
    currentPath.push(name); 
    history.pushState({ pathDepth: currentPath.length }, ""); 
    renderPortal(); 
}

function jumpToBreadcrumb(index) { 
    currentPath = currentPath.slice(0, index + 1); 
    history.pushState({ pathDepth: currentPath.length }, ""); 
    renderPortal(); 
}

function toggleViewLayout() {
    const icon = document.getElementById('viewToggleIcon');
    currentViewLayout = (currentViewLayout === 'grid') ? 'list' : 'grid';
    icon.setAttribute('data-lucide', currentViewLayout === 'grid' ? 'layout-list' : 'layout-grid');
    lucide.createIcons(); 
    renderPortal();
}

/* ==========================================================================
   7. SISTEM AUTENTIKASI & PENDENGAR AKSI EVENT LISTENERS
   ========================================================================== */
function logoutPortal() {
    sessionStorage.clear();
    localStorage.clear();
    window.location.href = 'index.html';
}

document.getElementById('loginForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const inputUser = document.getElementById('usernameInput').value.trim().toLowerCase();
    const errorText = document.getElementById('loginError');
    
    if (userDatabase.hasOwnProperty(inputUser)) {
        errorText.classList.add('hidden');
        const userRole = userDatabase[inputUser];
        
        sessionStorage.setItem('portalLoggedIn', 'true');
        sessionStorage.setItem('portalUser', inputUser);
        sessionStorage.setItem('portalRole', userRole);
        
        document.getElementById('loginOverlay').remove();
        document.getElementById('mainBody').classList.remove('overflow-hidden');
        
        if (typeof renderLoggedInUser === "function") renderLoggedInUser();
        applyGuestRestrictions();
        fetchData();
        fetchMonitoringData();

        showAttitudeModal();

        if (userRole === 'guest') switchView('damage');
        else switchView('files');
    } else { 
        errorText.classList.remove('hidden'); 
    }
});

document.getElementById('searchInput')?.addEventListener('input', renderPortal);

window.addEventListener('popstate', function(event) {
    if (sessionStorage.getItem('portalLoggedIn') === 'true' && currentPath.length > 0) {
        currentPath.pop(); 
        renderPortal();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const overlay = document.getElementById('loginOverlay');
    const mainBody = document.getElementById('mainBody');
    const isLoggedIn = sessionStorage.getItem('portalLoggedIn');
    const role = sessionStorage.getItem('portalRole');

    const analyzeDropdownBtn = document.getElementById('nav-analyze-dropdown');
    const analyzeSubMenu = document.getElementById('analyzeSubMenu');
    const analyzeChevron = document.getElementById('analyzeChevron');

    if (analyzeDropdownBtn && analyzeSubMenu) {
        analyzeDropdownBtn.addEventListener('click', () => {
            analyzeSubMenu.classList.toggle('hidden');
            analyzeChevron.classList.toggle('rotate-180');
        });
    }

    if (isLoggedIn) {
        if (overlay) overlay.remove(); 
        if (mainBody) mainBody.classList.remove('overflow-hidden');
        
        if (typeof renderLoggedInUser === "function") renderLoggedInUser();
        applyGuestRestrictions();
        fetchData();
        fetchMonitoringData();

        const urlParams = new URLSearchParams(window.location.search);
        const requestedView = urlParams.get('view') || sessionStorage.getItem('lastActiveView') || (role === 'guest' ? 'damage' : 'files');
        
        switchView(role === 'guest' ? 'damage' : requestedView);
    } else {
        if (overlay) overlay.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
    }
});
