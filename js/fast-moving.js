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
      pageTitle.innerText = "Fast Moving SKU for TF";
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
    // 1. Parse Database .txt (Kolom 1 = SKU, Kolom 4 = Qty System)
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

    // Konversi sheet ke JSON (array of arrays) untuk proses pembersihan baris kosong (menggantikan macro VBA)
    let rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    // Hapus baris kosong jika kolom B (index 1) dan Kolom C (index 2) kosong (Mulai dari bawah ke atas)
    for (let i = rawData.length - 1; i >= 1; i--) {
      let row = rawData[i];
      let colB = row && row[1] !== undefined ? String(row[1]).trim() : "";
      let colC = row && row[2] !== undefined ? String(row[2]).trim() : "";
      if (colB === "" && colC === "") {
        rawData.splice(i, 1);
      }
    }

    // Pastikan header akhir sesuai permintaan macro VBA:
    // Kolom A = SKU, Kolom B = DESCRIPTION, Kolom C = QTY, Kolom D = NET_SALES
    if (rawData.length > 0) {
      rawData[0][0] = "SKU";
      rawData[0][1] = "DESCRIPTION";
      rawData[0][2] = "QTY";
      rawData[0][3] = "NET_SALES";
    }

    // Ubah kembali data yang sudah bersih ke objek terstruktur untuk analisis
    // Sheet 1 memerlukan tambahan kolom baru di Kolom G (index 6) berupa Qty dari database
    // Kita buat mapping baris data penjualan untuk Sheet 1
    let cleanedSalesRows = [];
    // Mulai dari baris index 1 (setelah header)
    for (let i = 0; i < rawData.length; i++) {
      let row = rawData[i];
      if (i === 0) {
        // Tambahkan header untuk kolom G
        row[6] = "QTY_DATABASE";
        cleanedSalesRows.push(row);
        continue;
      }

      let sku = row[0] !== undefined ? String(row[0]).trim() : "";
      let qtyDatabase = sku in dbMap ? dbMap[sku] : 0;
      row[6] = qtyDatabase; // Masukkan ke kolom G
      cleanedSalesRows.push(row);
    }

    // 3. Analisa: Ambil data dari baris data penjualan, filter SKU yang qty terjualnya (Kolom C / index 2) paling banyak
    // Ambil 150 paling banyak terjual, kemudian compare ke database yang qty system-nya 0 sampai 5 pcs (0 <= qtySys <= 5)
    let salesAnalysisList = [];
    for (let i = 1; i < rawData.length; i++) {
      let row = rawData[i];
      let sku = row[0] !== undefined ? String(row[0]).trim() : "";
      let desc = row[1] !== undefined ? row[1] : "";
      let qtyTerjual = parseFloat(row[2]) || 0;
      let netSales = row[3] !== undefined ? row[3] : 0;

      if (sku) {
        let qtySys = sku in dbMap ? dbMap[sku] : 0;
        salesAnalysisList.push({
          sku: sku,
          description: desc,
          qtyTerjual: qtyTerjual,
          netSales: netSales,
          qtySystem: qtySys
        });
      }
    }

    // Sort descending berdasarkan Qty Terjual (paling banyak)
    salesAnalysisList.sort((a, b) => b.qtyTerjual - a.qtyTerjual);

    // Ambil 150 teratas
    let top150 = salesAnalysisList.slice(0, 150);

    // Filter lagi: Database qty system 0 sampai 5 pcs
    let finalAnalysisRows = top150.filter(item => item.qtySystem >= 0 && item.qtySystem <= 5);

    // Format untuk Sheet 2 Hasil Analisa
    let sheet2DataFormatted = finalAnalysisRows.map((item, idx) => ({
      "No": idx + 1,
      "SKU": item.sku,
      "DESCRIPTION": item.description,
      "QTY TERJUAL": item.qtyTerjual,
      "NET SALES": item.netSales,
      "QTY SYSTEM (DB)": item.qtySystem
    }));

    // 4. Generate Output Excel (2 Sheets)
    const newWorkbook = XLSX.utils.book_new();

    // Sheet 1: Penjualan yang sudah dirapikan dengan tambahan kolom G (QTY_DATABASE)
    const ws1 = XLSX.utils.aoa_to_sheet(cleanedSalesRows);
    XLSX.utils.book_append_sheet(newWorkbook, ws1, "Data Penjualan Rapi");

    // Sheet 2: Hasil Analisa Fast Moving SKU for TF
    const ws2 = XLSX.utils.json_to_sheet(sheet2DataFormatted.length > 0 ? sheet2DataFormatted : [{
      "Info": "Tidak ada SKU yang memenuhi kriteria (Top 150 & Qty System 0-5)"
    }]);
    XLSX.utils.book_append_sheet(newWorkbook, ws2, "Analisa Fast Moving TF");

    // Format nama file: nama toko_fast moving tf_tanggal dianalisa.xlsx
    const tanggalHariIni = new Date().toISOString().split("T")[0];
    const safeNamaToko = namaToko.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    const filename = `${safeNamaToko}_fast moving tf_${tanggalHariIni}.xlsx`;

    XLSX.writeFile(newWorkbook, filename);
  }
});  
