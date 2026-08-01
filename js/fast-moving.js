document.addEventListener("DOMContentLoaded", () => {
  const navBtnFM = document.getElementById("nav-fast-moving");
  const sectionFM = document.getElementById("section-fast-moving");
  const pageTitle = document.getElementById("pageTitle");

  function openFastMovingView() {
    document.querySelectorAll("main[id^='section-']").forEach((sec) => {
      sec.classList.add("hidden");
    });
    
    if (sectionFM) {
      sectionFM.classList.remove("hidden");
    }

    if (pageTitle) {
      pageTitle.innerText = "Fast moving sku for TF";
    }

    localStorage.setItem("activePortalMenu", "fast-moving");
  }

  if (localStorage.getItem("activePortalMenu") === "fast-moving") {
    openFastMovingView();
  }

  if (navBtnFM && sectionFM) {
    navBtnFM.addEventListener("click", (e) => {
      e.preventDefault();
      openFastMovingView();

      const sidebarMenu = document.getElementById("sidebarMenu");
      const sidebarBackdrop = document.getElementById("sidebarBackdrop");
      if (sidebarMenu && !sidebarMenu.classList.contains("-translate-x-full") && window.innerWidth < 768) {
        sidebarMenu.classList.add("-translate-x-full");
        if (sidebarBackdrop) sidebarBackdrop.classList.add("hidden");
      }
    });
  }

  const btnProsesFM = document.getElementById("btn-proses-fm");
  const statusFM = document.getElementById("status-fm");

  if (btnProsesFM) {
    btnProsesFM.addEventListener("click", async () => {
      const namaToko = document.getElementById("nama-toko-fm").value.trim();
      const fileDb = document.getElementById("file-db-fm").files[0];
      const fileSales = document.getElementById("file-sales-fm").files[0];

      if (!namaToko) {
        alert("Harap masukkan Nama Toko terlebih dahulu!");
        return;
      }

      if (!fileDb || !fileSales) {
        alert("Harap upload file Database .txt dan File Penjualan Excel terlebih dahulu!");
        return;
      }

      statusFM.innerText = "Sedang membaca dan merapikan data...";
      statusFM.style.color = "blue";

      try {
        const textDb = await bacaFileTeks(fileDb);
        const salesBuffer = await fileSales.arrayBuffer();

        prosesFastMoving(namaToko, textDb, salesBuffer);

        statusFM.innerText = "Berhasil! File Excel Fast Moving berhasil di-download.";
        statusFM.style.color = "green";
      } catch (err) {
        console.error(err);
        statusFM.innerText = "Terjadi kesalahan saat memproses data.";
        statusFM.style.color = "red";
      }
    });
  }

  function bacaFileTeks(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  function prosesFastMoving(namaToko, textDb, salesBuffer) {
    // 1. Parse Database .txt (Kolom 1 = SKU di index 0, Kolom 4 = Qty System di index 3)
    const dbMap = {}; // SKU -> Qty System
    const linesDb = textDb.trim().split("\n");
    linesDb.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",").map((i) => i.trim());
      const sku = cols[0] || "";
      const qtySys = parseFloat(cols[3]) || 0;
      if (sku) {
        dbMap[sku] = qtySys;
      }
    });

    // 2. Baca file Excel Penjualan via SheetJS
    const workbook = XLSX.read(salesBuffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    let data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // ====================================
    // REPLIKASI LOGIKA MACRO VBA RAPPIKAN SKU REPORT
    // ====================================

    // A. Hapus Header & Footer Report berdasarkan Kolom A (index 0)
    const keywords = [
      "PT. NIAGA", "SKU REPORT", "FROM DATE", "FROM DEPARTMENT", 
      "FROM SKU", "FROM BARCODE", "FROM STORE", "FROM WORKSTATION", 
      "SORT BY", "PLU CODE", "SUBTOTAL"
    ];
    for (let i = data.length - 1; i >= 0; i--) {
      let cellText = String(data[i][0] || "").toUpperCase();
      let shouldDelete = keywords.some(kw => cellText.includes(kw));
      if (shouldDelete) {
        data.splice(i, 1);
      }
    }

    // B. Hapus Kolom: L(11), K(10), I(8), G(6), F(5), E(4), D(3), B(1)
    // Dihapus dari index terbesar ke terkecil agar tidak menggeser index kolom sebelumnya
    const colsToRemove = [11, 10, 8, 6, 5, 4, 3, 1];
    data = data.map(row => {
      let newRow = [...row];
      colsToRemove.forEach(colIdx => {
        newRow.splice(colIdx, 1);
      });
      return newRow;
    });

    // C. Tambah Header Department di Kolom 5 & 6 (index 4 dan 5)
    if (data.length > 0) {
      data[0][4] = "DEPT_CODE";
      data[0][5] = "DEPT_NAME";
    }

    // D. Isi Dept Code & Dept Name untuk setiap baris produk di bawahnya
    let deptCode = "";
    let deptName = "";
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let col0 = row[0] !== undefined ? String(row[0]).trim() : "";
      let col1 = row[1] !== undefined ? String(row[1]).trim() : "";
      let col2 = row[2] !== undefined ? String(row[2]).trim() : "";
      let col3 = row[3] !== undefined ? String(row[3]).trim() : "";

      if (col0 !== "" && col1 !== "" && col2 === "" && col3 === "") {
        deptCode = row[0];
        deptName = row[1];
      }
      row[4] = deptCode;
      row[5] = deptName;
    }

    // E. Hapus Baris Department Header
    for (let i = data.length - 1; i >= 1; i--) {
      let row = data[i];
      let col0 = row[0] !== undefined ? String(row[0]).trim() : "";
      let col1 = row[1] !== undefined ? String(row[1]).trim() : "";
      let col2 = row[2] !== undefined ? String(row[2]).trim() : "";
      let col3 = row[3] !== undefined ? String(row[3]).trim() : "";

      if (col0 !== "" && col1 !== "" && col2 === "" && col3 === "") {
        data.splice(i, 1);
      }
    }

    // F. Hapus Baris Kosong jika Kolom B dan C Kosong (Kolom B = index 1, Kolom C = index 2)
    for (let i = data.length - 1; i >= 1; i--) {
      let row = data[i];
      let colB = row[1] !== undefined ? String(row[1]).trim() : "";
      let colC = row[2] !== undefined ? String(row[2]).trim() : "";
      if (colB === "" && colC === "") {
        data.splice(i, 1);
      }
    }

    // G. Header Akhir
    if (data.length > 0) {
      data[0][0] = "SKU";
      data[0][1] = "DESCRIPTION";
      data[0][2] = "QTY";
      data[0][3] = "NET_SALES";
      // Kolom 4 = DEPT_CODE, Kolom 5 = DEPT_NAME
    }

    // ====================================
    // PEMBUATAN FILE RESULT (2 SHEETS)
    // ====================================

    // Sheet 1: Data penjualan yang sudah dirapikan + tambahan kolom G (QTY_DATABASE)
    let sheet1Rows = [];
    for (let i = 0; i < data.length; i++) {
      let row = [...data[i]];
      if (i === 0) {
        row[6] = "QTY_DATABASE";
      } else {
        let sku = row[0] !== undefined ? String(row[0]).trim() : "";
        row[6] = sku in dbMap ? dbMap[sku] : 0;
      }
      sheet1Rows.push(row);
    }

    // Sheet 2: Analisa Top 150 SKU dengan Qty Terjual Terbanyak & Qty System Database 0 s.d. 5 pcs
    let analysisList = [];
    for (let i = 1; i < data.length; i++) {
      let row = data[i];
      let sku = row[0] !== undefined ? String(row[0]).trim() : "";
      let desc = row[1] !== undefined ? row[1] : "";
      let qtyTerjual = parseFloat(row[2]) || 0;
      let netSales = parseFloat(row[3]) || 0;
      let deptCodeVal = row[4] !== undefined ? row[4] : "";
      let deptNameVal = row[5] !== undefined ? row[5] : "";

      if (sku) {
        let qtySys = sku in dbMap ? dbMap[sku] : 0;
        analysisList.push({
          sku: sku,
          description: desc,
          qtyTerjual: qtyTerjual,
          netSales: netSales,
          deptCode: deptCodeVal,
          deptName: deptNameVal,
          qtySystem: qtySys
        });
      }
    }

    // Urutkan berdasarkan Qty Terjual terbanyak (Descending)
    analysisList.sort((a, b) => b.qtyTerjual - a.qtyTerjual);

    // Ambil 150 teratas
    let top150 = analysisList.slice(0, 150);

    // Filter SKU yang Qty System database-nya antara 0 sampai 5 pcs (0 <= qtySys <= 5)
    let filteredFastMoving = top150.filter(item => item.qtySystem >= 0 && item.qtySystem <= 5);

    let sheet2Formatted = filteredFastMoving.map((item, idx) => ({
      "No": idx + 1,
      "SKU": item.sku,
      "DESCRIPTION": item.description,
      "QTY TERJUAL": item.qtyTerjual,
      "NET SALES": item.netSales,
      "DEPT CODE": item.deptCode,
      "DEPT NAME": item.deptName,
      "QTY SYSTEM (DB)": item.qtySystem
    }));

    // Buat Workbook Excel baru
    const newWorkbook = XLSX.utils.book_new();

    // Sheet 1: Data Penjualan Rapi
    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
    XLSX.utils.book_append_sheet(newWorkbook, ws1, "Data Penjualan Rapi");

    // Sheet 2: Analisa Fast Moving SKU for TF
    const ws2 = XLSX.utils.json_to_sheet(sheet2Formatted.length > 0 ? sheet2Formatted : [{
      "Info": "Tidak ada SKU yang memenuhi kriteria (Top 150 & Qty System 0-5)"
    }]);
    XLSX.utils.book_append_sheet(newWorkbook, ws2, "Fast Moving TF");

    // Format nama file: nama toko_fast moving tf_tanggal dianalisa.xlsx
    const tanggalHariIni = new Date().toISOString().split("T")[0];
    const safeNamaToko = namaToko.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    const filename = `${safeNamaToko}_fast moving tf_${tanggalHariIni}.xlsx`;

    XLSX.writeFile(newWorkbook, filename);
  }
});
