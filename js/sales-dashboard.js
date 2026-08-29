/* ==========================================================================
   1. KONFIGURASI GLOBAL & MAPPING GID SHEETS
   ========================================================================== */
const SALES_BASE_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSKeatOjhIzr5g8A0umcfsB-ve_YwoyiF3mG9rk_DZKlg6li4v01JKrFg2FnFTk9ot7WIOfjDNXvOvN/pub?output=csv';
const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz0OP_PZzwnj5LJFfus99KyLSqwiD5PFDQK6QX9Br2FTHrEFOM8pMgEXZpsLhd26ZWz/exec";

// Disinkronkan dengan SPREADSHEET_ID pada Code.gs (Single Source of Truth)
const SPREADSHEET_ID_OFFICIAL = "1P70howhagUA_H4H0cSXUWB5MjDhCKuOirVLSmh39Z_E";

let salesData = [];
let salesChartInstance = null;
let currentSalesChartMode = 'mtd';
let currentSalesSource = 'SUBMISSION'; // 'SUBMISSION' atau 'OFFICIAL_IT_REPORT'

// State khusus Official IT Report. Tidak dipakai oleh Submission.
let officialRawData = [];
let officialDataHealth = { total: 0, valid: 0, invalidDate: 0, invalidStore: 0 };


// GID Sheet Lengkap (Termasuk Alias untuk Official IT Report)
const SHEET_GIDS = {
    'OFFICIAL_IT_REPORT': '1129267198',
    'OFFICIAL_IT': '1129267198', // Alias agar aman dari bug pemanggilan key
    'Oct26': '1682478488', 
    'Sep26': '432381843', 
    'Aug26': '1766415704', 
    'Jul26': '1248782513', 
    'Jun26': '511605214', 
    'May26': '2012772985',
    'Apr26': '544207481', 
    'Mar26': '90936589', 
    'Feb26': '472876079',
    'Jan26': '171319040', 
    'Dec25': '236016326', 
    'Nov25': '564328385'
};

/* ==========================================================================
   2. INITIALIZATION & SOURCE SWITCHER
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    displayUpdateDate();
    initSalesSlicers();
    fetchSalesData();
});

function displayUpdateDate() {
    const dateEl = document.getElementById('update-date');
    if (dateEl) {
        const today = new Date().toLocaleDateString('id-ID', { day:'numeric', month:'long', year:'numeric' });
        dateEl.innerText = "Update Terakhir: " + today;
    }
}

/**
 * Fungsi Ganti Sumber Data (Store Submission vs Official IT Report)
 */
window.switchSalesSource = function(sourceType) {
    currentSalesSource = sourceType;
    const btnSub = document.getElementById('btn-src-submission');
    const btnOff = document.getElementById('btn-src-official');
    const slicerBulan = document.getElementById('slicerBulanSales');

    if (isOfficialSource_()) {
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
    } else {
        if (btnSub) btnSub.className = "px-4 py-2 rounded-xl text-xs font-black bg-white text-slate-800 shadow-sm transition-all";
        if (btnOff) btnOff.className = "px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-all";
    }
    if (slicerBulan) slicerBulan.disabled = false;
    syncOfficialSlicerState_();
    fetchSalesData();
};;

function initSalesSlicers() {
    const slicerBulan=document.getElementById('slicerBulanSales');
    const slicerKategori=document.getElementById('slicerKategoriSales');
    const slicerSpesifik=document.getElementById('slicerSpesifikSales');
    if(!slicerKategori||!slicerSpesifik)return;
    slicerKategori.addEventListener('change',()=>{
        if(isOfficialSource_()) populateOfficialSlicer_();
        else {
            slicerSpesifik.innerHTML='<option value="all">-- Semua --</option>';
            slicerSpesifik.disabled=slicerKategori.value==='all';
            if(slicerKategori.value!=='all'){
                const vals=new Set(); salesData.forEach(i=>{const v=slicerKategori.value==='store'?i.store:slicerKategori.value==='bm'?i.bm:i.abm;if(v&&v!=='-')vals.add(v.trim());});
                [...vals].sort().forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;slicerSpesifik.appendChild(o);});
            }
        }
        applySalesFilters();
    });
    slicerSpesifik.addEventListener('change',applySalesFilters);
    if(slicerBulan)slicerBulan.addEventListener('change',()=>{fetchSalesData();if(!isOfficialSource_()&&typeof fetchAndRenderUptSalesTable==='function')fetchAndRenderUptSalesTable();});
}

function isOfficialSource_() {
    return currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT';
}

function syncOfficialSlicerState_() {
    const kategori = document.getElementById('slicerKategoriSales');
    const spesifik = document.getElementById('slicerSpesifikSales');
    if (!kategori) return;
    Array.from(kategori.options).forEach(option => {
        const org = option.value === 'bm' || option.value === 'abm';
        option.disabled = isOfficialSource_() && org;
        option.hidden = isOfficialSource_() && org;
    });
    if (isOfficialSource_() && (kategori.value === 'bm' || kategori.value === 'abm')) kategori.value = 'all';
    if (spesifik && kategori.value === 'all') {
        spesifik.innerHTML = '<option value="all">-- Semua --</option>';
        spesifik.disabled = true;
        spesifik.classList.add('bg-slate-100','cursor-not-allowed');
    }
}

function populateOfficialSlicer_() {
    const kategori=document.getElementById('slicerKategoriSales');
    const spesifik=document.getElementById('slicerSpesifikSales');
    if(!kategori||!spesifik)return;
    if(isOfficialSource_() && kategori.value !== 'store') {
        spesifik.innerHTML='<option value="all">-- Semua --</option>';
        spesifik.disabled=true;
        spesifik.classList.add('bg-slate-100','cursor-not-allowed');
        return;
    }
    if(kategori.value!=='store') return;
    spesifik.innerHTML='<option value="all">-- Semua --</option>';
    const set=new Set(salesData.map(i=>i.store).filter(Boolean));
    [...set].sort((a,b)=>a.localeCompare(b,'id')).forEach(name=>{
        const o=document.createElement('option'); o.value=name; o.textContent=name; spesifik.appendChild(o);
    });
    spesifik.disabled=set.size===0;
    spesifik.classList.toggle('bg-slate-100',set.size===0);
    spesifik.classList.toggle('cursor-not-allowed',set.size===0);
}

function parseOfficialNumber_(value) {
    if(value===null||value===undefined||String(value).trim()==='')return 0;
    let raw=String(value).trim().replace(/[^0-9,.-]/g,'');
    if(raw.includes(',')&&raw.includes('.')) raw=raw.lastIndexOf(',')>raw.lastIndexOf('.')?raw.replace(/\./g,'').replace(',','.'):raw.replace(/,/g,'');
    else if(raw.includes(',')) raw=/,\d{3}$/.test(raw)?raw.replace(/,/g,''):raw.replace(',','.');
    else if(raw.includes('.')&&/\.\d{3}$/.test(raw)) raw=raw.replace(/\./g,'');
    const n=Number(raw); return Number.isFinite(n)?n:0;
}

function parseOfficialDate_(value) {
    if(!value)return null; const raw=String(value).trim(); let m;
    m=raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if(m){const d=new Date(+m[1],+m[2]-1,+m[3]);return d.getFullYear()==+m[1]&&d.getMonth()==+m[2]-1&&d.getDate()==+m[3]?d:null;}
    m=raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
    if(m){const d=new Date(+m[3],+m[2]-1,+m[1]);return d.getFullYear()==+m[3]&&d.getMonth()==+m[2]-1&&d.getDate()==+m[1]?d:null;}
    const d=new Date(raw); return isNaN(d.getTime())?null:new Date(d.getFullYear(),d.getMonth(),d.getDate());
}

function selectedOfficialMonth_(){
    const key=document.getElementById('slicerBulanSales')?.value||'Aug26';
    const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    return {month:months[key.slice(0,3)],year:+('20'+key.slice(3)),key};
}

function formatCompactOfficial_(value){const n=Number(value||0),a=Math.abs(n);if(a>=1e9)return(n/1e9).toFixed(1).replace('.0','')+'B';if(a>=1e6)return(n/1e6).toFixed(1).replace('.0','')+'M';if(a>=1e3)return(n/1e3).toFixed(1).replace('.0','')+'K';return Math.round(n).toLocaleString('id-ID');}

function escapeOfficial_(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');}

/* ==========================================================================
   3. DATA FETCHING & SMART PARSER CSV
   ========================================================================== */
async function fetchSalesData() {
    const loader=document.getElementById('sales-loading'); if(loader)loader.classList.remove('hidden');
    try{
        const selectedKey=document.getElementById('slicerBulanSales')?.value||'Aug26';
        const gid=isOfficialSource_()?SHEET_GIDS.OFFICIAL_IT_REPORT:(SHEET_GIDS[selectedKey]||'1766415704');
        const response=await fetch(`${SALES_BASE_URL}&gid=${gid}&t=${Date.now()}`);
        if(!response.ok)throw new Error(`HTTP ${response.status}`);
        const csvText=await response.text(); if(!csvText.trim())throw new Error('Data CSV kosong.');
        salesData=parseSalesCSV(csvText,currentSalesSource);
        syncOfficialSlicerState_(); if(isOfficialSource_())populateOfficialSlicer_(); applySalesFilters();
    }catch(error){console.error('Error fetching data:',error);salesData=[];if(isOfficialSource_())renderOfficialDataMessage_('Gagal mengambil Official IT Report. Silakan refresh dan coba lagi.');applySalesFilters();}
    finally{if(loader)loader.classList.add('hidden');}
}

function parseSalesCSV(text, sourceMode) {
    const lines=String(text||'').replace(/\r/g,'').split('\n'); if(lines.length<2)return [];
    const official=isOfficialSource_(); const headerRowIdx=official?0:(lines.length>2?2:0);
    const headers=parseCSVLine(lines[headerRowIdx]).map(h=>String(h).replace(/^\uFEFF/,'').trim().toLowerCase().replace(/\s+/g,' '));
    if(official){
        const idx=(aliases,fallback)=>{for(const a of aliases){const x=headers.indexOf(a);if(x!==-1)return x;}return fallback;};
        const ix={storeCode:idx(['store code','store_code','kode toko'],0),storeName:idx(['store name','store_name','store','nama toko'],1),date:idx(['date','tanggal','transaction date','business date'],2),netSales:idx(['net sales','net_sales','sales'],4),qtySold:idx(['qty sold','qty_sold','qty','quantity sold','quantity'],11),trxCount:idx(['trx count','trx_count','trx','transaction count','transaction'],12)};
        const sel=selectedOfficialMonth_(),map=new Map(); officialRawData=[]; officialDataHealth={total:0,valid:0,invalidDate:0,invalidStore:0};
        for(let i=1;i<lines.length;i++){if(!lines[i].trim())continue;officialDataHealth.total++;const row=parseCSVLine(lines[i]);const date=parseOfficialDate_(row[ix.date]);if(!date){officialDataHealth.invalidDate++;continue;}const code=String(row[ix.storeCode]||'').trim().toUpperCase().replace(/\s+/g,'');const store=String(row[ix.storeName]||'').trim().replace(/\s+/g,' ');if(!code||!store||store==='-'){officialDataHealth.invalidStore++;continue;}const raw={storeCode:code,store,date,netSales:parseOfficialNumber_(row[ix.netSales]),qtySold:parseOfficialNumber_(row[ix.qtySold]),trxCount:parseOfficialNumber_(row[ix.trxCount])};officialRawData.push(raw);if(date.getMonth()!==sel.month||date.getFullYear()!==sel.year)continue;officialDataHealth.valid++;if(!map.has(code))map.set(code,{storeCode:code,store,bm:'-',abm:'-',mtdSales:0,qtySold:0,trxCount:0});const item=map.get(code);item.store=store;item.mtdSales+=raw.netSales;item.qtySold+=raw.qtySold;item.trxCount+=raw.trxCount;}
        return [...map.values()].map(i=>({...i,atv:i.trxCount?i.mtdSales/i.trxCount:0,upt:i.trxCount?i.qtySold/i.trxCount:0,mtdTarget:0,achPercent:0,bestEstimate:'-',salesLY:0,sssg:0,projSssg:0}));
    }
    const result=[]; const getNum=(row,names,fb)=>{for(const n of names){const x=headers.indexOf(n);if(x!==-1)return parseFloat(String(row[x]||'').replace(/[^0-9.-]+/g,''))||0;}return parseFloat(String(row[fb]||'').replace(/[^0-9.-]+/g,''))||0;};const getStr=(row,names,fb)=>{for(const n of names){const x=headers.indexOf(n);if(x!==-1)return String(row[x]).trim();}return String(row[fb]||'-').trim();};
    for(let i=headerRowIdx+1;i<lines.length;i++){if(!lines[i].trim())continue;const row=parseCSVLine(lines[i]);const store=getStr(row,['store name','store_name','store','nama toko'],1);if(!store||store==='-')continue;const sales=getNum(row,['net sales','net_sales','mtd sales','sales mtd'],4),target=getNum(row,['target sales','target_sales','mtd target','target'],5);let ach=getNum(row,['achievement','ach percent','% ach','ach'],17);if(!ach&&target>0)ach=sales/target*100;result.push({storeCode:getStr(row,['store code','store_code','kode toko'],0),store,bm:getStr(row,['nama bm','bm','branch manager'],2),abm:getStr(row,['nama abm','abm','asst branch manager'],3),mtdSales:sales,mtdTarget:target,bestEstimate:getStr(row,['best estimate','best_estimate','estimate'],16),achPercent:ach,salesLY:getNum(row,['sales ly','ly sales','ly'],18),sssg:getNum(row,['sssg','ach sssg'],20),projSssg:getNum(row,['projection sssg','proj sssg','projection'],21)});}return result;
}

function parseCSVLine(textLine) {
    let row = [];
    let inQuotes = false;
    let currentStr = "";
    for (let char of textLine) {
        if (char === '"') inQuotes = !inQuotes;
        else if (char === ',' && !inQuotes) { row.push(currentStr.trim()); currentStr = ""; }
        else currentStr += char;
    }
    row.push(currentStr.trim());
    return row.map(cell => cell.replace(/^"|"$/g, '').trim());
}

/* ==========================================================================
   4. SYSTEM FILTERING SALES
   ========================================================================== */
function applySalesFilters() {
    const kategori=document.getElementById('slicerKategoriSales')?.value||'all',spesifik=document.getElementById('slicerSpesifikSales')?.value||'all';let filtered=[...salesData];
    if(kategori!=='all'&&spesifik!=='all')filtered=salesData.filter(i=>String(kategori==='store'?i.store:kategori==='bm'?i.bm:i.abm||'').toLowerCase()===String(spesifik).toLowerCase());
    if(isOfficialSource_()){renderOfficialSummary_(filtered);renderOfficialTable_(filtered);if(currentSalesChartMode==='mtd')renderOfficialChart_(filtered);else renderOfficialTrendChart_(filtered);}else{renderSalesSummaryFiltered(filtered);renderSalesTableFiltered(filtered);if(currentSalesChartMode==='mtd')renderSalesChartFiltered(filtered);else fetchAndRenderTrendChart(kategori,spesifik);}
}

window.setSalesChartMode = function(mode) {
    currentSalesChartMode = mode;
    const btnMtd = document.getElementById('btnModeMtd');
    const btnTrend = document.getElementById('btnModeTrend');
    
    if (mode === 'mtd') {
        if (btnMtd) btnMtd.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        if (btnTrend) btnTrend.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    } else {
        if (btnTrend) btnTrend.className = "px-5 py-2 rounded-lg text-sm font-extrabold bg-white text-slate-800 shadow-sm transition-all";
        if (btnMtd) btnMtd.className = "px-5 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-all";
    }
    applySalesFilters();
};

function renderOfficialSummary_(data){const sales=data.reduce((s,i)=>s+(i.mtdSales||0),0),qty=data.reduce((s,i)=>s+(i.qtySold||0),0),trx=data.reduce((s,i)=>s+(i.trxCount||0),0),atv=trx?sales/trx:0,upt=trx?qty/trx:0;const set=(id,val,label)=>{const e=document.getElementById(id);if(e)e.innerText=val;const card=e?.closest('.rounded-2xl,.rounded-xl,.bg-white')||e?.parentElement;if(card){for(const n of card.querySelectorAll('p,span,div,h1,h2,h3,h4,h5,h6')){if(n!==e&&/^(Total Sales|MTD Target|Avg Achievement|Sales LY|SSSG|Proj\. SSSG|Total Target|Average Achievement)$/i.test((n.textContent||'').trim())){n.textContent=label;break;}}}};set('summary-total-sales','Rp '+Math.round(sales).toLocaleString('id-ID'),'Total Net Sales');set('summary-total-target',Math.round(qty).toLocaleString('id-ID'),'Qty Sold');set('summary-avg-ach',Math.round(trx).toLocaleString('id-ID'),'Transaction');set('summary-total-ly','Rp '+Math.round(atv).toLocaleString('id-ID'),'Average ATV');set('summary-sssg',upt.toFixed(2),'Average UPT');set('summary-proj-sssg',data.length.toLocaleString('id-ID'),'Active Store');}

function renderOfficialChart_(data){const ctx=document.getElementById('salesTargetChart');if(!ctx)return;if(salesChartInstance)salesChartInstance.destroy();const d=[...data].sort((a,b)=>(b.mtdSales||0)-(a.mtdSales||0));salesChartInstance=new Chart(ctx,{type:'bar',data:{labels:d.map(i=>i.store),datasets:[{type:'bar',label:'Net Sales',data:d.map(i=>i.mtdSales||0),backgroundColor:'rgba(249,115,22,.88)',borderColor:'#f97316',borderRadius:7,yAxisID:'y'},{type:'line',label:'ATV',data:d.map(i=>i.atv||0),borderColor:'#6366f1',backgroundColor:'#6366f1',borderWidth:2.5,pointRadius:4,tension:.35,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{grid:{display:false},ticks:{maxRotation:55,minRotation:35,autoSkip:false}},y:{beginAtZero:true,ticks:{callback:v=>'Rp '+formatCompactOfficial_(v)}},y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'Rp '+formatCompactOfficial_(v)}}},plugins:{legend:{position:'bottom'},tooltip:{callbacks:{label:c=>`${c.dataset.label}: Rp ${Math.round(c.raw||0).toLocaleString('id-ID')}`}}}}});}

function renderOfficialTrendChart_(data){const ctx=document.getElementById('salesTargetChart');if(!ctx)return;if(salesChartInstance)salesChartInstance.destroy();const sel=selectedOfficialMonth_(),allowed=new Set(data.map(i=>i.storeCode)),days=new Map();officialRawData.forEach(r=>{if(r.date.getMonth()!==sel.month||r.date.getFullYear()!==sel.year)return;if(allowed.size&&!allowed.has(r.storeCode))return;const d=r.date.getDate();if(!days.has(d))days.set(d,{sales:0,trx:0});days.get(d).sales+=r.netSales;days.get(d).trx+=r.trxCount;});const max=new Date(sel.year,sel.month+1,0).getDate(),labels=[],sales=[],atv=[];for(let d=1;d<=max;d++){const x=days.get(d)||{sales:0,trx:0};labels.push(String(d));sales.push(x.sales);atv.push(x.trx?x.sales/x.trx:0);}salesChartInstance=new Chart(ctx,{type:'line',data:{labels,datasets:[{label:'Daily Net Sales',data:sales,borderColor:'#f97316',backgroundColor:'rgba(249,115,22,.1)',borderWidth:3,pointRadius:3,fill:true,tension:.3,yAxisID:'y'},{label:'Daily ATV',data:atv,borderColor:'#6366f1',backgroundColor:'#6366f1',borderWidth:2.5,pointRadius:3,tension:.3,yAxisID:'y1'}]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},scales:{x:{grid:{display:false}},y:{beginAtZero:true,ticks:{callback:v=>'Rp '+formatCompactOfficial_(v)}},y1:{beginAtZero:true,position:'right',grid:{drawOnChartArea:false},ticks:{callback:v=>'Rp '+formatCompactOfficial_(v)}}},plugins:{legend:{position:'bottom'}}}});}

function renderOfficialTable_(data){const tbody=document.getElementById('sales-table-body'),count=document.getElementById('table-record-count');if(count)count.textContent=`Menampilkan ${data.length} Store`;if(!tbody)return;const thead=tbody.previousElementSibling;if(thead)thead.innerHTML='<tr><th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th><th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Net Sales</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Qty Sold</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Transaction</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">ATV</th><th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">UPT</th></tr>';if(!data.length){tbody.innerHTML='<tr><td colspan="7" class="text-center py-8 text-sm font-bold text-slate-400">Tidak ada data Official IT untuk bulan/filter yang dipilih.</td></tr>';renderOfficialDataHealth_();return;}const d=[...data].sort((a,b)=>(b.mtdSales||0)-(a.mtdSales||0));tbody.innerHTML=d.map((i,n)=>`<tr class="${n%2?'bg-slate-50/60':'bg-white'} border-b border-slate-100 hover:bg-orange-50/40 transition-colors"><td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${n+1}</td><td class="px-5 py-4"><p class="font-bold text-sm text-slate-800">${escapeOfficial_(i.store)}</p><p class="text-[10px] font-bold text-slate-400 uppercase">${escapeOfficial_(i.storeCode||'-')}</p></td><td class="px-5 py-4 text-right text-sm font-bold text-slate-700">Rp ${Math.round(i.mtdSales||0).toLocaleString('id-ID')}</td><td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${Math.round(i.qtySold||0).toLocaleString('id-ID')}</td><td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${Math.round(i.trxCount||0).toLocaleString('id-ID')}</td><td class="px-5 py-4 text-right"><span class="inline-flex px-3 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-600">Rp ${Math.round(i.atv||0).toLocaleString('id-ID')}</span></td><td class="px-5 py-4 text-right"><span class="inline-flex px-3 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-600">${Number(i.upt||0).toFixed(2)}</span></td></tr>`).join('');renderOfficialDataHealth_();}

function renderOfficialDataHealth_(){let n=document.getElementById('official-it-data-health'),c=document.getElementById('table-record-count');if(!n&&c&&c.parentElement){n=document.createElement('div');n.id='official-it-data-health';n.className='mt-2 text-[10px] font-semibold';c.parentElement.appendChild(n);}if(!n)return;const h=officialDataHealth;n.className='mt-2 text-[10px] font-semibold '+((h.invalidDate||h.invalidStore)?'text-amber-500':'text-slate-400');n.textContent=(h.invalidDate||h.invalidStore)?`Audit data: ${h.valid} baris bulan terpilih • ${h.invalidDate} tanggal invalid • ${h.invalidStore} store invalid`:`Data Official IT tervalidasi: ${h.valid} baris bulan terpilih dari ${h.total} baris source.`;}
function renderOfficialDataMessage_(message){const tbody=document.getElementById('sales-table-body');if(tbody)tbody.innerHTML=`<tr><td colspan="7" class="text-center py-8 text-sm font-bold text-rose-500">${escapeOfficial_(message)}</td></tr>`;}

/* ==========================================================================
   5. SUMMARY METRICS & CARDS
   ========================================================================== */
function renderSalesSummaryFiltered(data) {
    let totalSales = 0, totalTarget = 0, totalLY = 0;
    let totalSSSG = 0, totalProjSSSG = 0;
    let count = 0;

    data.forEach(item => {
        totalSales += item.mtdSales || 0;
        totalTarget += item.mtdTarget || 0;
        totalLY += item.salesLY || 0;
        totalSSSG += item.sssg || 0;
        totalProjSSSG += item.projSssg || 0;
        count++;
    });
    
    const avgAch = totalTarget > 0 ? ((totalSales / totalTarget) * 100).toFixed(1) : 0;
    const avgSSSG = count > 0 ? (totalSSSG / count) : 0;
    const avgProjSSSG = count > 0 ? (totalProjSSSG / count) : 0;
    
    const setTxt = (id, val) => { const el = document.getElementById(id); if (el) el.innerText = val; };
    
    setTxt('summary-total-sales', "Rp " + totalSales.toLocaleString('id-ID'));
    setTxt('summary-total-target', "Rp " + totalTarget.toLocaleString('id-ID'));
    setTxt('summary-avg-ach', avgAch + "%");
    setTxt('summary-total-ly', "Rp " + totalLY.toLocaleString('id-ID'));
    
    const elSSSG = document.getElementById('summary-sssg');
    const elProjSSSG = document.getElementById('summary-proj-sssg');
    
    if (elSSSG) {
        elSSSG.innerText = avgSSSG.toFixed(2) + "%";
        elSSSG.className = avgSSSG >= 0 ? "text-xl font-black text-emerald-500" : "text-xl font-black text-rose-500";
    }
    if (elProjSSSG) {
        elProjSSSG.innerText = avgProjSSSG.toFixed(2) + "%";
        elProjSSSG.className = avgProjSSSG >= 0 ? "text-xl font-black text-amber-500" : "text-xl font-black text-rose-500";
    }
}

/* ==========================================================================
   6. GRAFIK (WARNA ROSE RED & ORANGE MENYALA + LABEL PERSENTASE POLYGON)
   ========================================================================== */
function renderSalesChartFiltered(data) {
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;
    
    if (salesChartInstance) salesChartInstance.destroy();
    
    salesChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.store),
            datasets: [
                {
                    type: 'line',
                    label: 'Achievement (%)',
                    data: data.map(item => item.achPercent || 0),
                    backgroundColor: '#6366f1', 
                    borderColor: '#6366f1', 
                    borderWidth: 2.5,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#6366f1',
                    pointBorderWidth: 2,
                    fill: false, 
                    tension: 0.35, 
                    yAxisID: 'y1' 
                },
                {
                    type: 'bar',
                    label: 'MTD Target',
                    backgroundColor: 'rgba(244, 63, 94, 0.85)',
                    borderColor: '#f43f5e',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdTarget || 0),
                    yAxisID: 'y'
                },
                {
                    type: 'bar',
                    label: 'MTD Sales',
                    backgroundColor: 'rgba(249, 115, 22, 0.9)',
                    borderColor: '#f97316',
                    borderWidth: 1,
                    borderRadius: 6,
                    data: data.map(item => item.mtdSales || 0),
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 40 } },
            scales: {
                x: { grid: { display: false } },
                y: { type: 'linear', display: true, position: 'left', beginAtZero: true },
                y1: { type: 'linear', display: false, position: 'right', beginAtZero: true }
            },
            plugins: { legend: { position: 'bottom' } }
        },
        plugins: [{
            id: 'polygonPercentageLabels',
            afterDatasetsDraw: (chart) => {
                const ctx = chart.ctx;
                chart.data.datasets.forEach((dataset, i) => {
                    if (dataset.type === 'line') { 
                        const meta = chart.getDatasetMeta(i);
                        if (!meta.hidden) {
                            meta.data.forEach((element, index) => {
                                ctx.fillStyle = '#4f46e5'; 
                                ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'bottom';
                                const dataString = Number(dataset.data[index]).toFixed(1) + '%';
                                ctx.fillText(dataString, element.x, element.y - 8); 
                            });
                        }
                    }
                });
            }
        }]
    });
}

async function fetchAndRenderTrendChart(kategori, spesifik) {
    const loader = document.getElementById('sales-loading');
    if (loader) loader.classList.remove('hidden');
    const ctx = document.getElementById('salesTargetChart');
    if (!ctx) return;

    try {
        const monthKeys = ['Oct26', 'Sep26', 'Aug26', 'Jul26', 'Jun26', 'May26'].reverse(); 
        let promises = monthKeys.map(async (mKey) => {
            const gid = SHEET_GIDS[mKey];
            if (!gid) return null;
            try {
                const res = await fetch(`${SALES_BASE_URL}&gid=${gid}`);
                const parsed = parseSalesCSV(await res.text(), 'SUBMISSION');
                let totalS = 0, totalT = 0;
                parsed.forEach(i => { totalS += i.mtdSales; totalT += i.mtdTarget; });
                return { month: mKey, achPercent: totalT > 0 ? (totalS / totalT) * 100 : 0 };
            } catch (e) { return null; }
        });

        let validData = (await Promise.all(promises)).filter(item => item !== null);
        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: validData.map(item => item.month),
                datasets: [{
                    label: 'Trend Achievement (%)',
                    data: validData.map(item => item.achPercent),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249, 115, 22, 0.1)',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#ffffff',
                    pointBorderColor: '#f97316',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false,
                layout: { padding: { top: 37 } }
            },
            plugins: [{
                id: 'trendPolygonLabels',
                afterDatasetsDraw: (chart) => {
                    const ctx = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    if (!meta.hidden) {
                        meta.data.forEach((element, index) => {
                            ctx.fillStyle = '#c2410c';
                            ctx.font = 'bold 11px "Plus Jakarta Sans", sans-serif';
                            ctx.textAlign = 'center';
                            const val = Number(chart.data.datasets[0].data[index]).toFixed(1) + '%';
                            ctx.fillText(val, element.x, element.y - 10);
                        });
                    }
                }
            }]
        });
    } catch (e) { console.error(e); } 
    finally { if (loader) loader.classList.add('hidden'); }
}

/* ==========================================================================
   7. TABEL SALES STORE
   ========================================================================== */
function renderSalesTableFiltered(data) {
    const tbody = document.getElementById('sales-table-body');
    const countLabel = document.getElementById('table-record-count');
    
    if (countLabel) {
        countLabel.textContent = `Menampilkan ${data.length} Toko`;
    }

    if (!tbody) return;

    // Dinamis update Tabel Header (thead)
    const thead = tbody.previousElementSibling; 
    if (thead) {
        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            thead.innerHTML = `<tr>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th>
                <th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">Total Sales</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">QTY Sold</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Trx Count</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">ATV & UPT</th>
            </tr>`;
        } else {
            thead.innerHTML = `<tr>
                <th class="px-4 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">No</th>
                <th class="px-5 py-3 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Store</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Sales</th>
                <th class="px-5 py-3 text-right text-xs font-black text-slate-400 uppercase tracking-wider">MTD Target</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Est.</th>
                <th class="px-5 py-3 text-center text-xs font-black text-slate-400 uppercase tracking-wider">Ach %</th>
            </tr>`;
        }
    }

    if (data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-sm font-bold text-slate-400">Tidak ada data store untuk filter ini</td></tr>`;
        return;
    }

    // Jika Official IT di-sort berdasarkan Sales tertinggi, jika tidak berdasarkan Achievement
    let sortedData = [...data].sort((a, b) => {
        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            return (b.mtdSales || 0) - (a.mtdSales || 0);
        }
        return (b.achPercent || 0) - (a.achPercent || 0);
    });

    tbody.innerHTML = sortedData.map((item, index) => {
        let rowBg = index % 2 === 0 ? 'bg-white' : 'bg-slate-50/60';

        if (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT') {
            return `
            <tr class="${rowBg} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
                <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
                <td class="px-5 py-4">
                    <p class="font-bold text-sm text-slate-800">${item.store}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">${item.storeCode || '-'}</p>
                </td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdSales || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">${(item.qtySold || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${(item.trxCount || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center">
                    <p class="text-xs font-bold text-emerald-600">ATV: Rp ${(item.atv || 0).toLocaleString('id-ID', {maximumFractionDigits:0})}</p>
                    <p class="text-[11px] font-semibold text-indigo-500">UPT: ${(item.upt || 0).toFixed(2)}</p>
                </td>
            </tr>
            `;
        } else {
            let ach = item.achPercent || 0;
            let badgeBg = ach >= 100 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 
                         (ach >= 80 ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-rose-50 text-rose-600 border-rose-200');

            return `
            <tr class="${rowBg} border-b border-slate-100 hover:bg-amber-50/30 transition-colors">
                <td class="px-4 py-4 text-center font-bold text-xs text-slate-400">${index + 1}</td>
                <td class="px-5 py-4">
                    <p class="font-bold text-sm text-slate-800">${item.store}</p>
                    <p class="text-[10px] font-bold text-slate-400 uppercase">${item.storeCode || '-'}</p>
                </td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdSales || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-right text-sm font-semibold text-slate-600">Rp ${(item.mtdTarget || 0).toLocaleString('id-ID')}</td>
                <td class="px-5 py-4 text-center text-sm font-extrabold text-amber-600">${item.bestEstimate || '-'}</td>
                <td class="px-5 py-4 text-center">
                    <span class="px-3 py-1.5 rounded-xl text-[11px] font-black border ${badgeBg}">
                        ${ach.toFixed(2)}%
                    </span>
                </td>
            </tr>
            `;
        }
    }).join('');
}

/* ==========================================================================
   8. MODAL HANDLER & UPLOAD PDF OFFICIAL IT REPORT
   ========================================================================== */
window.openUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.remove('hidden');
    
    const input = document.getElementById('officialPdfInput');
    if (input) input.value = '';
    
    const display = document.getElementById('pdfFileNameDisplay');
    if (display) display.textContent = "Klik atau seret file .PDF laporan ke sini";
    
    const progContainer = document.getElementById('uploadProgressContainer');
    if (progContainer) progContainer.classList.add('hidden');
    
    const statusBox = document.getElementById('pdfUploadStatus');
    if (statusBox) statusBox.classList.add('hidden');
    
    const btnSubmit = document.getElementById('btnSubmitPdf');
    if (btnSubmit) btnSubmit.disabled = false;
    
    const btnText = document.getElementById('btnSubmitText');
    if (btnText) btnText.textContent = "Proses Upload";

    const dateInput = document.getElementById('officialReportDate');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    if (typeof lucide !== 'undefined') lucide.createIcons();
};

window.closeUploadPdfModal = function() {
    const modal = document.getElementById('uploadPdfModal');
    if (modal) modal.classList.add('hidden');
};

window.previewPdfSelection = function(input) {
    const display = document.getElementById('pdfFileNameDisplay');
    if (input.files && input.files[0] && display) {
        display.textContent = `📄 File terpilih: ${input.files[0].name}`;
    } else if (display) {
        display.textContent = "Klik atau seret file .PDF laporan ke sini";
    }
};

/**
 * Helper: Membaca file PDF dan mengonversinya ke format Data URL (Base64)
 * agar backend Google Apps Script dapat melakukan parsing, konversi,
 * lookup ke sheet DATA_STORE berdasarkan Store Code (Kolom A), 
 * dan menyimpan hasilnya ke Google Sheet Master.
 */
function readFileAsDataURL_(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Gagal membaca file dari perangkat."));
        reader.readAsDataURL(file);
    });
}

/* ==========================================================================
   8b. PEMECAH PDF OTOMATIS UNTUK LAPORAN BESAR (mis. rekap bulanan)
   --------------------------------------------------------------------------
   Backend membaca teks PDF lewat konversi ke Google Docs, yang punya batas
   keras ~1 juta karakter per dokumen. PDF laporan harian (±50 halaman)
   jauh di bawah itu, tapi PDF bulanan bisa 1000+ halaman dan berjuta-juta
   karakter -> konversi gagal/kepotong diam-diam kalau dikirim utuh.
   Solusinya: PDF dipecah di sini (browser) jadi beberapa bagian berukuran
   aman pakai pdf-lib (pustaka PDF yang sudah teruji luas), lalu setiap
   bagian diunggah berurutan ke endpoint yang sama seperti biasa. Backend
   punya pengecekan anti-duplikat (Store Code + Tanggal), jadi proses ini
   aman diulang kalau salah satu bagian gagal di tengah jalan.
   ========================================================================== */
const PDF_CHUNK_MAX_PAGES = 150; // ≈770rb karakter/chunk, aman di bawah batas ~1 juta Google Docs

function loadPdfLibScript_() {
    return new Promise((resolve, reject) => {
        if (window.PDFLib) return resolve(window.PDFLib);
        const existing = document.querySelector('script[data-pdf-lib]');
        if (existing) {
            existing.addEventListener('load', () => resolve(window.PDFLib));
            existing.addEventListener('error', () => reject(new Error("Gagal memuat pustaka pemecah PDF (pdf-lib).")));
            return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
        script.dataset.pdfLib = "true";
        script.onload = () => resolve(window.PDFLib);
        script.onerror = () => reject(new Error("Gagal memuat pustaka pemecah PDF (pdf-lib). Periksa koneksi internet."));
        document.head.appendChild(script);
    });
}

/**
 * Cek jumlah halaman PDF; kalau melebihi PDF_CHUNK_MAX_PAGES, pecah jadi
 * beberapa PDF terpisah (masing-masing maks PDF_CHUNK_MAX_PAGES halaman).
 * Kalau file cukup kecil, `chunks` dikembalikan null (tidak perlu dipecah,
 * upload berjalan seperti biasa 1x request).
 */
async function splitPdfIntoChunks_(file) {
    const { PDFDocument } = await loadPdfLibScript_();
    const arrayBuffer = await file.arrayBuffer();
    const srcDoc = await PDFDocument.load(arrayBuffer, { updateMetadata: false });
    const totalPages = srcDoc.getPageCount();

    if (totalPages <= PDF_CHUNK_MAX_PAGES) {
        return { totalPages, chunks: null };
    }

    const chunks = [];
    const numChunks = Math.ceil(totalPages / PDF_CHUNK_MAX_PAGES);
    for (let i = 0; i < numChunks; i++) {
        const startPage = i * PDF_CHUNK_MAX_PAGES;
        const endPage = Math.min(startPage + PDF_CHUNK_MAX_PAGES, totalPages);
        const pageIndices = [];
        for (let p = startPage; p < endPage; p++) pageIndices.push(p);

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(pg => newDoc.addPage(pg));
        const bytes = await newDoc.save();

        chunks.push({ index: i + 1, total: numChunks, startPage: startPage + 1, endPage, bytes });
    }
    return { totalPages, chunks };
}

/** Konversi Uint8Array (hasil pdf-lib) jadi Data URL base64, batch per 32KB
 *  supaya tidak overflow call stack untuk file yang cukup besar. */
function pdfBytesToDataURL_(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
    }
    return `data:application/pdf;base64,${btoa(binary)}`;
}

/** Kirim satu payload PDF (utuh atau 1 chunk) ke backend dan validasi hasilnya. */
async function uploadPdfPayload_(fileName, dataUrl, reportDate, extraMeta) {
    const payload = Object.assign({
        action: "UPLOAD_PDF_OFFICIAL",
        fileName,
        fileData: dataUrl,
        reportDate,
        gidDataStore: "1124553459",
        gidOfficialReport: "1129267198"
    }, extraMeta || {});

    const response = await fetch(WEB_APP_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`Server merespons dengan status HTTP ${response.status}. Periksa deployment Web App GAS.`);
    }

    const rawText = await response.text();
    let result;
    try {
        result = JSON.parse(rawText);
    } catch (parseErr) {
        throw new Error("Respons server bukan JSON yang valid. Cuplikan: " + rawText.slice(0, 120));
    }

    if (!result.success) {
        const stageLabel = result.stage ? ` [tahap: ${result.stage}]` : '';
        throw new Error((result.message || "Gagal memproses data di Google Sheet.") + stageLabel);
    }

    return result;
}

window.submitOfficialPdf = async function() {
    const input = document.getElementById('officialPdfInput');
    const dateInput = document.getElementById('officialReportDate');
    const statusBox = document.getElementById('pdfUploadStatus');
    const btnSubmit = document.getElementById('btnSubmitPdf');
    const btnText = document.getElementById('btnSubmitText');
    const progContainer = document.getElementById('uploadProgressContainer');
    const progressBar = document.getElementById('uploadProgressBar');
    const progressPct = document.getElementById('uploadProgressPct');
    const statusText = document.getElementById('uploadStatusText');

    const setProgress = (pct, label) => {
        if (progressBar) progressBar.style.width = `${pct}%`;
        if (progressPct) progressPct.textContent = `${pct}%`;
        if (statusText && label) statusText.textContent = label;
    };

    const showStatus = (isSuccess, message) => {
        if (!statusBox) return;
        statusBox.className = isSuccess
            ? "block text-center p-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mt-3"
            : "block text-center p-3 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 mt-3";
        statusBox.textContent = message;
        statusBox.classList.remove('hidden');
    };

    if (!input || !input.files || !input.files[0]) {
        alert("Silakan pilih file PDF terlebih dahulu!");
        return;
    }

    const file = input.files[0];
    // Tanggal per-baris tetap diambil dari isi PDF itu sendiri (setiap baris
    // punya tanggalnya sendiri, penting untuk PDF bulanan yang mencakup
    // banyak tanggal sekaligus) — input ini cuma label/metadata untuk log.
    const reportDate = (dateInput && dateInput.value) ? dateInput.value : new Date().toISOString().split('T')[0];

    if (statusBox) statusBox.classList.add('hidden');
    if (progContainer) progContainer.classList.remove('hidden');
    if (btnSubmit) btnSubmit.disabled = true;
    if (btnText) btnText.textContent = "Mengunggah...";
    setProgress(5, "Memeriksa ukuran PDF...");

    try {
        // 1. Cek jumlah halaman & pecah otomatis kalau terlalu besar untuk
        //    1x konversi (Google Docs yang dipakai backend untuk baca teks
        //    PDF punya batas ~1 juta karakter — PDF bulanan bisa jauh
        //    melebihi itu). Kalau pdf-lib gagal dimuat (mis. offline),
        //    lanjut sebagai upload tunggal seperti biasa — backend tetap
        //    punya penjaga & akan menolak dengan pesan jelas kalau kebesaran.
        let splitInfo;
        try {
            splitInfo = await splitPdfIntoChunks_(file);
        } catch (splitErr) {
            console.warn("Gagal memeriksa/memecah PDF, lanjut sebagai upload tunggal:", splitErr);
            splitInfo = { totalPages: null, chunks: null };
        }

        const batchId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const aggregate = { count: 0, skippedCount: 0, duplicateCount: 0 };
        // Toko yang "hilang" di 1 chunk sangat mungkin justru ketemu di chunk
        // lain (laporan bulanan biasa mencakup ribuan toko lintas cabang,
        // tersebar di rentang halaman berbeda) — union foundStoreCodes dari
        // SEMUA chunk dulu, baru status hilang dihitung di akhir, supaya
        // tidak menyesatkan seperti kalau dilihat per-chunk saja.
        const foundCodesUnion = new Set();
        let registeredStoreCodes = null;

        const trackResult = (result) => {
            aggregate.count += result.count || 0;
            aggregate.skippedCount += result.skippedCount || 0;
            aggregate.duplicateCount += result.duplicateCount || 0;
            (result.foundStoreCodes || []).forEach(c => foundCodesUnion.add(c));
            if (!registeredStoreCodes && result.registeredStoreCodes) registeredStoreCodes = result.registeredStoreCodes;
        };

        if (!splitInfo.chunks) {
            // File cukup kecil (atau pdf-lib gagal dimuat) -> upload langsung, 1 request.
            setProgress(30, "Membaca dan mengirim file PDF...");
            const base64Content = await readFileAsDataURL_(file);
            setProgress(60, "Melakukan lookup Store Code dan menyimpan ke Master...");
            const result = await uploadPdfPayload_(file.name, base64Content, reportDate, { batchId, chunkIndex: 1, totalChunks: 1 });
            trackResult(result);
        } else {
            // File besar (mis. laporan bulanan) -> otomatis dipecah jadi
            // beberapa bagian dan diunggah berurutan. Aman diulang kalau
            // gagal di tengah: anti-duplikat Store Code + Tanggal di
            // backend otomatis melewati data yang sudah berhasil masuk.
            const total = splitInfo.chunks.length;
            for (const chunk of splitInfo.chunks) {
                const pct = 10 + Math.round((chunk.index / total) * 80);
                setProgress(pct, `Mengunggah bagian ${chunk.index} dari ${total} (halaman ${chunk.startPage}-${chunk.endPage})...`);

                const dataUrl = pdfBytesToDataURL_(chunk.bytes);
                const chunkFileName = `${file.name} (hal ${chunk.startPage}-${chunk.endPage})`;
                const result = await uploadPdfPayload_(chunkFileName, dataUrl, reportDate, {
                    batchId, chunkIndex: chunk.index, totalChunks: total
                });
                trackResult(result);
            }
        }

        setProgress(100, "Selesai!");

        const parts = [`${aggregate.count} baris data berhasil disimpan ke Master`];
        if (aggregate.duplicateCount > 0) parts.push(`${aggregate.duplicateCount} duplikat dilewati`);
        if (aggregate.skippedCount > 0) parts.push(`${aggregate.skippedCount} baris dilewati (kode toko tidak valid/tidak terdaftar)`);

        // Status hilang yang SEBENARNYA: toko terdaftar yang TIDAK ketemu
        // di SATUPUN chunk dari batch ini (bukan cuma 1 chunk tertentu).
        if (registeredStoreCodes) {
            const trulyMissing = registeredStoreCodes.filter(c => !foundCodesUnion.has(c));
            if (trulyMissing.length > 0) {
                parts.push(`⚠️ ${trulyMissing.length} toko TIDAK ketemu di seluruh file: ${trulyMissing.join(', ')}`);
            }
        }

        const prefix = splitInfo.chunks ? `PDF (${splitInfo.totalPages} halaman) otomatis dipecah jadi ${splitInfo.chunks.length} bagian. ` : '';

        showStatus(true, prefix + parts.join(', ') + '.');
        if (btnText) btnText.textContent = "Berhasil Disimpan";

        setTimeout(() => {
            closeUploadPdfModal();
            if (typeof currentSalesSource !== 'undefined' && (currentSalesSource === 'OFFICIAL_IT' || currentSalesSource === 'OFFICIAL_IT_REPORT')) {
                fetchSalesData();
            }
        }, 2200);

    } catch (error) {
        console.error("Upload Error:", error);
        if (progContainer) progContainer.classList.add('hidden');
        showStatus(false, "Gagal: " + (error.message || "Terjadi kesalahan koneksi.") +
            " Aman untuk klik \"Coba Lagi\" — data yang sudah berhasil tersimpan tidak akan dobel " +
            "(sistem otomatis melewati Store Code + Tanggal yang sama).");
        if (btnSubmit) btnSubmit.disabled = false;
        if (btnText) btnText.textContent = "Coba Lagi";
    }
};
