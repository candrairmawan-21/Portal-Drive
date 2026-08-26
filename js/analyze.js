document.addEventListener("DOMContentLoaded", () => {
  const navBtnAnalyze = document.getElementById("menu-analyze");
  const sectionAnalyze = document.getElementById("section-analyze");
  const pageTitle = document.getElementById("pageTitle");

  // DOM Elements Form
  const selectTipe = document.getElementById("tipe-analisa");
  const formContainer = document.getElementById("form-analisa-container");
  const labelFileKedua = document.getElementById("label-file-kedua");
  const hintFileKedua = document.getElementById("hint-file-kedua");
  const inputToko = document.getElementById("nama-toko-analyze");
  const inputDb = document.getElementById("file-db-analyze");
  const inputKedua = document.getElementById("file-kedua-analyze");
  const btnProses = document.getElementById("btn-proses-analyze");
  const btnText = document.getElementById("btn-text-analyze");
  const statusText = document.getElementById("status-analyze");

  // Fungsi Toggle View Portal
  function openAnalyzeView() {
    document.querySelectorAll("main[id^='section-']").forEach((sec) => {
      sec.classList.add("hidden");
    });
    
    if (sectionAnalyze) {
      sectionAnalyze.classList.remove("hidden");
    }

    if (pageTitle) {
      pageTitle.innerText = "Analyze Center";
    }

    localStorage.setItem("activePortalMenu", "analyze");
  }

  // Cek Status Halaman saat Load
  if (localStorage.getItem("activePortalMenu") === "analyze") {
    openAnalyzeView();
  }

  // Sidebar Menu Click Event
  if (navBtnAnalyze && sectionAnalyze) {
    navBtnAnalyze.addEventListener("click", (e) => {
      e.preventDefault();
      openAnalyzeView();

      const sidebarMenu = document.getElementById("sidebarMenu");
      const sidebarBackdrop = document.getElementById("sidebarBackdrop");
      if (sidebarMenu && !sidebarMenu.classList.contains("-translate-x-full") && window.innerWidth < 768) {
        sidebarMenu.classList.add("-translate-x-full");
        if (sidebarBackdrop) sidebarBackdrop.classList.add("hidden");
      }
    });
  }

  // ==========================================
  // EVENT LISTENER DROPDOWN (MEMUNCULKAN FORM)
  // ==========================================
  if(selectTipe) {
    selectTipe.addEventListener("change", (e) => {
      const mode = e.target.value;
      
      // Tampilkan form container dengan menghapus class hidden
      if (formContainer.classList.contains("hidden")) {
        formContainer.classList.remove("hidden");
        formContainer.classList.add("animate-[fadeIn_0.4s_ease-out]");
      }

      // RESET Form untuk keamanan (mencegah file salah menu terbawa)
      inputDb.value = "";
      inputKedua.value = "";
      statusText.innerText = "";

      // GANTI TULISAN SECARA DINAMIS
      if (mode === "itemize") {
        labelFileKedua.innerText = "4. File Hasil Scan (.txt atau .xlsx / .xls)";
        hintFileKedua.innerText = "Jika Excel (.xlsx/.xls): Kolom A = SKU, Kolom B = Alamat. Jika .txt: Format bawaan sebelumnya.";
        inputKedua.accept = ".txt, .xlsx, .xls";
        btnText.innerText = "Proses & Download Excel Itemize";
      } else if (mode === "fast-moving") {
        labelFileKedua.innerText = "4. File Penjualan (.xlsx / .xls)";
        hintFileKedua.innerText = "Upload file Excel hasil tarikan report Sales dari sistem IT Anda.";
        inputKedua.accept = ".xlsx, .xls";
        btnText.innerText = "Proses & Download Fast Moving Excel";
      }
    });
  }

  // ==========================================
  // EVENT TOMBOL PROSES DATA
  // ==========================================
  if (btnProses) {
    btnProses.addEventListener("click", async () => {
      const mode = selectTipe.value;
      const namaToko = inputToko.value.trim();
      const fileDb = inputDb.files[0];
      const fileKedua = inputKedua.files[0];

      if (!mode) {
        alert("Pilih jenis analisa terlebih dahulu!");
        return;
      }
      if (!namaToko) {
        alert("Harap masukkan Nama Toko terlebih dahulu!");
        return;
      }
      if (!fileDb || !fileKedua) {
        alert("Harap lengkapi upload File Database dan File ke-2!");
        return;
      }

      statusText.innerText = `Sedang memproses ${mode === 'itemize' ? 'Itemize' : 'Fast Moving'}...`;
      statusText.style.color = "blue";

      try {
        if (mode === "itemize") {
          await jalankanProsesItemize(namaToko, fileDb, fileKedua);
        } else if (mode === "fast-moving") {
          await jalankanProsesFastMoving(namaToko, fileDb, fileKedua);
        }

        statusText.innerText = "Berhasil! File Excel berhasil di-download.";
        statusText.style.color = "green";
      } catch (err) {
        console.error("Kesalahan Sistem: ", err);
        statusText.innerText = "Terjadi kesalahan saat memproses data. Cek kembali format file Anda.";
        statusText.style.color = "red";
      }
    });
  }

  // ==========================================
  // UTILITY HELPER
  // ==========================================
  function bacaFileTeks(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  function isValidNumericSku(skuStr) {
    if (!skuStr) return false;
    const cleaned = String(skuStr).trim();
    return /^\d+$/.test(cleaned);
  }

  // ==========================================
  // LOGIKA 1: ITEMIZE (ANOMALI SCAN)
  // ==========================================
  async function jalankanProsesItemize(namaToko, fileDb, fileScan) {
    const textDb = await bacaFileTeks(fileDb);
    let scanParsedData = [];
    const fileName = fileScan.name.toLowerCase();

    if (fileName.endsWith(".txt")) {
      const textScan = await bacaFileTeks(fileScan);
      scanParsedData = parseScanTxtItemize(textScan);
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const scanBuffer = await fileScan.arrayBuffer();
      scanParsedData = parseScanExcelItemize(scanBuffer);
    } else {
      throw new Error("Format file scan tidak didukung untuk Itemize.");
    }

    prosesDanDownloadExcelItemize(namaToko, textDb, scanParsedData);
  }

  function parseScanTxtItemize(textScan) {
    const barisScan = textScan.trim().split("\n");
    const result = [];
    barisScan.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",").map((i) => i.trim());
      const alamatScan = cols[1] || "-";
      const sku = cols[2] || "";
      if (isValidNumericSku(sku)) {
        result.push({ sku: sku, alamat: alamatScan });
      }
    });
    return result;
  }

  function parseScanExcelItemize(arrayBuffer) {
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    const result = [];

    rawData.forEach((row, idx) => {
      if (idx === 0) {
        const val0 = String(row[0] || "").trim().toLowerCase();
        if (val0 === "sku" || val0 === "code" || isNaN(val0)) return; 
      }
      const sku = row[0] !== undefined ? String(row[0]).trim() : "";
      const alamatScan = row[1] !== undefined ? String(row[1]).trim() : "-";
      if (isValidNumericSku(sku)) {
        result.push({ sku: sku, alamat: alamatScan });
      }
    });
    return result;
  }

  function prosesDanDownloadExcelItemize(namaToko, textDb, scanParsedData) {
    const barisDb = textDb.trim().split("\n");
    const dbMap = {}; 
    let totalSkuDbValid = 0; 

    barisDb.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",").map((i) => i.trim());
      const sku = cols[0] || "";
      const alamat = cols[1] || "-";
      const harga = cols[2] || "-";
      const qty = parseFloat(cols[3]) || 0;
      const deskripsi = cols[8] || "-";

      if (sku) {
        dbMap[sku] = { sku, alamat, harga, qty, deskripsi };
        if (qty !== 0) totalSkuDbValid++;
      }
    });

    const sheet1Data = [];
    const scanSkuToAlamatMap = {}; 

    scanParsedData.forEach((item) => {
      sheet1Data.push({ SKU: item.sku });
      if (!scanSkuToAlamatMap[item.sku]) scanSkuToAlamatMap[item.sku] = new Set();
      scanSkuToAlamatMap[item.sku].add(item.alamat);
    });

    const sheet2Data = [];
    const scannedSkus = new Set(Object.keys(scanSkuToAlamatMap));
    let countShort = 0, countExtra = 0, countDoubleAlamat = 0;

    Object.values(dbMap).forEach((item) => {
      if (item.qty !== 0 && !scannedSkus.has(item.sku)) {
        countShort++;
        sheet2Data.push({
          SKU: item.sku, Alamat: item.alamat, Harga: item.harga,
          "Qty System": item.qty, Deskripsi: item.deskripsi, "Keterangan Anomali": "SKU Short"
        });
      }
    });

    Object.entries(scanSkuToAlamatMap).forEach(([sku, alamatSet]) => {
      const inDb = !!dbMap[sku];
      if (!inDb) {
        alamatSet.forEach((alm) => {
          countExtra++;
          sheet2Data.push({
            SKU: sku, Alamat: alm, Harga: "-", "Qty System": 0,
            Deskripsi: "TIDAK ADA DI DATABASE", "Keterangan Anomali": "SKU Extra"
          });
        });
      } else {
        if (dbMap[sku].qty === 0) {
          alamatSet.forEach((alm) => {
            countExtra++;
            sheet2Data.push({
              SKU: sku, Alamat: alm, Harga: dbMap[sku].harga, "Qty System": 0,
              Deskripsi: dbMap[sku].deskripsi, "Keterangan Anomali": "SKU Extra"
            });
          });
        }
      }

      if (alamatSet.size > 1) {
        alamatSet.forEach((alm) => {
          countDoubleAlamat++;
          sheet2Data.push({
            SKU: sku, Alamat: alm, Harga: inDb ? dbMap[sku].harga : "-", "Qty System": inDb ? dbMap[sku].qty : 0,
            Deskripsi: inDb ? dbMap[sku].deskripsi : "TIDAK ADA DI DATABASE", "Keterangan Anomali": "Double Alamat"
          });
        });
      }
    });

    let totalAnomaliItem = countShort + countExtra;
    let akurasiVal = 100;
    if (totalSkuDbValid > 0) {
      let selisih = totalSkuDbValid - totalAnomaliItem;
      akurasiVal = selisih > 0 ? (selisih / totalSkuDbValid) * 100 : 0;
    }

    const sheet3Data = [
      { Metric: "Total SKU Short (Belum di Scan)", Jumlah: countShort },
      { Metric: "Total SKU Extra", Jumlah: countExtra },
      { Metric: "Total SKU Double Alamat", Jumlah: countDoubleAlamat },
      { Metric: "Akurasi Stock Opname / Scan", Jumlah: akurasiVal.toFixed(2) + "%" }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet1Data), "Hasil Scan");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(
      sheet2Data.length ? sheet2Data : [{ SKU: "-", Alamat: "-", Harga: "-", "Qty System": "-", Deskripsi: "-", "Keterangan Anomali": "Tidak Ada Anomali" }]
    ), "Anomali");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sheet3Data), "Summary");

    const dateStr = new Date().toISOString().split("T")[0];
    const safeNama = namaToko.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    XLSX.writeFile(workbook, `${safeNama}_itemize_${dateStr}.xlsx`);
  }

  // ==========================================
  // LOGIKA 2: FAST MOVING SKU FOR TF
  // ==========================================
  async function jalankanProsesFastMoving(namaToko, fileDb, fileSales) {
    const fileName = fileSales.name.toLowerCase();
    if (fileName.endsWith(".txt")) {
        throw new Error("File Penjualan tidak boleh format .txt");
    }
    
    const textDb = await bacaFileTeks(fileDb);
    const salesBuffer = await fileSales.arrayBuffer();
    
    prosesDanDownloadExcelFastMoving(namaToko, textDb, salesBuffer);
  }

  function prosesDanDownloadExcelFastMoving(namaToko, textDb, salesBuffer) {
    const dbMap = {};
    const linesDb = textDb.trim().split("\n");
    linesDb.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",").map((i) => i.trim());
      const sku = cols[0] || "";
      const qtySys = parseFloat(cols[3]) || 0;
      if (sku) dbMap[sku] = qtySys;
    });

    const workbook = XLSX.read(salesBuffer, { type: "array" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const keywords = ["PT. NIAGA", "SKU REPORT", "FROM DATE", "FROM DEPARTMENT", "FROM SKU", "FROM BARCODE", "FROM STORE", "FROM WORKSTATION", "SORT BY", "PLU CODE", "SUBTOTAL"];
    for (let i = data.length - 1; i >= 0; i--) {
      let cellText = String(data[i][0] || "").toUpperCase();
      if (keywords.some(kw => cellText.includes(kw))) data.splice(i, 1);
    }

    const colsToRemove = [11, 10, 8, 6, 5, 4, 3, 1];
    data = data.map(row => {
      let newRow = [...row];
      colsToRemove.forEach(colIdx => newRow.splice(colIdx, 1));
      return newRow;
    });

    if (data.length > 0) {
      data[0][4] = "DEPT_CODE"; data[0][5] = "DEPT_NAME";
    }

    let deptCode = "", deptName = "";
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let col0 = String(row[0] || "").trim(), col1 = String(row[1] || "").trim();
      let col2 = String(row[2] || "").trim(), col3 = String(row[3] || "").trim();

      if (col0 !== "" && col1 !== "" && col2 === "" && col3 === "") {
        deptCode = row[0]; deptName = row[1];
      }
      row[4] = deptCode; row[5] = deptName;
    }

    for (let i = data.length - 1; i >= 1; i--) {
      let row = data[i];
      let col0 = String(row[0] || "").trim(), col1 = String(row[1] || "").trim();
      let col2 = String(row[2] || "").trim(), col3 = String(row[3] || "").trim();
      if ((col0 !== "" && col1 !== "" && col2 === "" && col3 === "") || 
          (String(row[1] || "").trim() === "" && String(row[2] || "").trim() === "")) {
        data.splice(i, 1);
      }
    }

    if (data.length > 0) {
      data[0][0] = "SKU"; data[0][1] = "DESCRIPTION"; data[0][2] = "QTY"; data[0][3] = "NET_SALES";
    }

    let sheet1Rows = [];
    for (let i = 0; i < data.length; i++) {
      let row = [...data[i]];
      if (i === 0) {
        row[6] = "QTY_DATABASE";
      } else {
        let sku = String(row[0] || "").trim();
        row[6] = sku in dbMap ? dbMap[sku] : 0;
      }
      sheet1Rows.push(row);
    }

    let analysisList = [];
    const DAYS_PERIOD = 90;
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let sku = String(row[0] || "").trim();
      if (!sku) continue;

      let desc = row[1] || "", qtyTerjual = parseFloat(row[2]) || 0;
      let netSales = parseFloat(row[3]) || 0, deptCodeVal = row[4] || "", deptNameVal = row[5] || "";
      let qtySys = sku in dbMap ? dbMap[sku] : 0;
      
      let avgDaily = qtyTerjual / DAYS_PERIOD;
      let needed7Days = avgDaily * 7;

      if (qtySys < needed7Days) {
        analysisList.push({
          sku, description: desc, qtyTerjual, netSales, deptCode: deptCodeVal, deptName: deptNameVal,
          qtySystem: qtySys, avgDaily, needed7Days, kekurangan: needed7Days - qtySys
        });
      }
    }

    analysisList.sort((a, b) => b.kekurangan - a.kekurangan);
    let sheet2Formatted = analysisList.map((item, idx) => ({
      "No": idx + 1, "SKU": item.sku, "DESCRIPTION": item.description,
      "QTY TERJUAL (3 BLN)": item.qtyTerjual, "AVG / HARI": parseFloat(item.avgDaily.toFixed(2)),
      "QTY SYSTEM (DB)": item.qtySystem, "KEBUTUHAN 7 HARI": Math.ceil(item.needed7Days),
      "DEFISIT / KEKURANGAN": Math.ceil(item.kekurangan), "DEPT CODE": item.deptCode, "DEPT NAME": item.deptName
    }));

    const newWorkbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(newWorkbook, XLSX.utils.aoa_to_sheet(sheet1Rows), "Data Penjualan Rapi");
    XLSX.utils.book_append_sheet(newWorkbook, XLSX.utils.json_to_sheet(sheet2Formatted.length > 0 ? sheet2Formatted : [{"Info": "Semua SKU cukup"}]), "Fast Moving TF");

    const dateStr = new Date().toISOString().split("T")[0];
    const safeNama = namaToko.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    XLSX.writeFile(newWorkbook, `${safeNama}_fast_moving_${dateStr}.xlsx`);
  }
});
