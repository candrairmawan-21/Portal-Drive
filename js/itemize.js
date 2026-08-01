document.addEventListener("DOMContentLoaded", () => {
  // 1. Navigasi Side Panel
  const navBtn = document.getElementById("nav-itemize");
  const sectionAnalisa = document.getElementById("section-itemize");
  const pageTitle = document.getElementById("pageTitle");

  if (navBtn && sectionAnalisa) {
    navBtn.addEventListener("click", (e) => {
      e.preventDefault();
      
      document.querySelectorAll("main[id^='section-']").forEach((sec) => {
        sec.classList.add("hidden");
      });
      
      sectionAnalisa.classList.remove("hidden");

      if (pageTitle) {
        pageTitle.innerText = "Itemize - Analisa Anomali Scan";
      }

      const sidebarMenu = document.getElementById("sidebarMenu");
      const sidebarBackdrop = document.getElementById("sidebarBackdrop");
      if (sidebarMenu && !sidebarMenu.classList.contains("-translate-x-full") && window.innerWidth < 768) {
        sidebarMenu.classList.add("-translate-x-full");
        if (sidebarBackdrop) sidebarBackdrop.classList.add("hidden");
      }
    });
  }

  // 2. Event Listener Tombol Proses Analisa
  const btnProses = document.getElementById("btn-proses-analisa");
  const statusText = document.getElementById("status-analisa");

  if (btnProses) {
    btnProses.addEventListener("click", async () => {
      const fileDbInput = document.getElementById("file-db-txt").files[0];
      const fileScanInput = document.getElementById("file-scan-txt").files[0];

      if (!fileDbInput || !fileScanInput) {
        alert("Harap upload kedua file .txt terlebih dahulu!");
        return;
      }

      statusText.innerText = "Sedang memproses analisa...";
      statusText.style.color = "blue";

      try {
        const textDb = await bacaFileTeks(fileDbInput);
        const textScan = await bacaFileTeks(fileScanInput);

        prosesDanDownloadExcel(textDb, textScan);
        
        statusText.innerText = "Berhasil! File Excel sedang didownload.";
        statusText.style.color = "green";
      } catch (error) {
        console.error("Error:", error);
        statusText.innerText = "Terjadi kesalahan saat memproses data.";
        statusText.style.color = "red";
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

  // Logika Analisa & Export Excel Sesuai Aturan Baru
  function prosesDanDownloadExcel(textDb, textScan) {
    // A. Parse File Database (9 Kolom)
    // Kolom 1 = SKU, Kolom 2 = Alamat, Kolom 3 = Harga, Kolom 4 = Qty System, Kolom 9 = Deskripsi
    const barisDb = textDb.trim().split("\n");
    const dbMap = {}; // SKU -> { sku, alamat, harga, qty, deskripsi }

    barisDb.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",").map((i) => i.trim());
      
      const sku = cols[0] || "";
      const alamat = cols[1] || "-";
      const harga = cols[2] || "-";
      const qty = parseFloat(cols[3]) || 0;
      const deskripsi = cols[8] || "-"; // Indeks ke-8 adalah kolom ke-9

      if (sku) {
        dbMap[sku] = {
          sku,
          alamat,
          harga,
          qty,
          deskripsi
        };
      }
    });

    // B. Parse File Scan: Kode Menu (0), Alamat (1), SKU (2)
    const barisScan = textScan.trim().split("\n");
    const scanList = [];
    const scanSkuToAlamatMap = {}; // SKU -> Set(Alamat)

    barisScan.forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(",").map((i) => i.trim());
      const alamatScan = cols[1] || "-";
      const sku = cols[2] || "";

      if (sku) {
        scanList.push({ SKU: sku });
        if (!scanSkuToAlamatMap[sku]) scanSkuToAlamatMap[sku] = new Set();
        scanSkuToAlamatMap[sku].add(alamatScan);
      }
    });

    // --- SHEET 1: HASIL SCAN ---
    const sheet1Data = scanList;

    // --- SHEET 2: ANOMALI ---
    const sheet2Data = [];
    const scannedSkus = new Set(Object.keys(scanSkuToAlamatMap));

    // 1. SKU Belum di Scan (Short): SKU di Database dengan Qty System > 0, tapi tidak ada di file hasil scan
    Object.values(dbMap).forEach((item) => {
      if (item.qty > 0 && !scannedSkus.has(item.sku)) {
        sheet2Data.push({
          SKU: item.sku,
          Alamat: item.alamat,
          Harga: item.harga,
          "Qty System": item.qty,
          Deskripsi: item.deskripsi,
          "Keterangan Anomali": "SKU Short"
        });
      }
      // Catatan: SKU di database yang qty system 0 dan tidak ada di list scan diabaikan (sesuai instruksi)
    });

    // 2. SKU Extra & Double Alamat berdasarkan File Scan
    Object.entries(scanSkuToAlamatMap).forEach(([sku, alamatSet]) => {
      const inDb = !!dbMap[sku];
      
      // SKU Extra Kondisi A: SKU ada di file hasil scan, tetapi tidak ada di Database
      if (!inDb) {
        alamatSet.forEach((alm) => {
          sheet2Data.push({
            SKU: sku,
            Alamat: alm,
            Harga: "-",
            "Qty System": 0,
            Deskripsi: "TIDAK ADA DI DATABASE",
            "Keterangan Anomali": "SKU Extra"
          });
        });
      } else {
        // SKU Extra Kondisi B: SKU ada di Database tetapi tercatat memiliki Qty System = 0 (dan ditemukan di scan)
        if (dbMap[sku].qty === 0) {
          alamatSet.forEach((alm) => {
            sheet2Data.push({
              SKU: sku,
              Alamat: alm,
              Harga: dbMap[sku].harga,
              "Qty System": 0,
              Deskripsi: dbMap[sku].deskripsi,
              "Keterangan Anomali": "SKU Extra"
            });
          });
        }
      }

      // Double Alamat: SKU yang sama hasil scan muncul di 2 atau lebih alamat berbeda
      if (alamatSet.size > 1) {
        alamatSet.forEach((alm) => {
          sheet2Data.push({
            SKU: sku,
            Alamat: alm,
            Harga: inDb ? dbMap[sku].harga : "-",
            "Qty System": inDb ? dbMap[sku].qty : 0,
            Deskripsi: inDb ? dbMap[sku].deskripsi : "TIDAK ADA DI DATABASE",
            "Keterangan Anomali": "Double Alamat"
          });
        });
      }
    });

    // --- GENERATE EXCEL VIA SHEETJS ---
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Hasil Scan
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(workbook, ws1, "Hasil Scan");

    // Sheet 2: Anomali (Hanya kolom SKU, Alamat, Harga, Qty System, Deskripsi, Keterangan Anomali)
    const ws2 = XLSX.utils.json_to_sheet(
      sheet2Data.length ? sheet2Data : [{ 
        SKU: "-", 
        Alamat: "-", 
        Harga: "-", 
        "Qty System": "-", 
        Deskripsi: "-", 
        "Keterangan Anomali": "Tidak Ada Anomali" 
      }]
    );
    XLSX.utils.book_append_sheet(workbook, ws2, "Anomali");

    // Download file Excel
    XLSX.writeFile(workbook, "Hasil_Analisa_Anomali.xlsx");
  }
});
