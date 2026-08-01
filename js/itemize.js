document.addEventListener("DOMContentLoaded", () => {
  // 1. Navigasi Side Panel (Sesuaikan dengan logika tab proyekmu jika sudah ada)
  const navBtn = document.getElementById("nav-analisa-btn");
  const sectionAnalisa = document.getElementById("section-analisa-anomali");

  if (navBtn && sectionAnalisa) {
    navBtn.addEventListener("click", (e) => {
      e.preventDefault();
      // Sembunyikan semua section lain (opsional, sesuaikan dengan class proyekmu)
      document.querySelectorAll(".content-section").forEach((sec) => {
        sec.style.display = "none";
      });
      // Tampilkan section analisa
      sectionAnalisa.style.display = "block";
    });
  }

  // 2. Event Listener Tombol Proses
  const btnProses = document.getElementById("btn-proses-analisa");
  const statusText = document.getElementById("status-analisa");

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

  // Fungsi Helper membaca file Text
  function bacaFileTeks(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  // Logika Analisa & Export Excel
  function prosesDanDownloadExcel(textDb, textScan) {
    // A. Parse File DB: SKU, Alamat, Qty System, Barcode, Deskripsi
    const barisDb = textDb.trim().split("\n");
    const dbMap = {}; // SKU -> data

    barisDb.forEach((line) => {
      if (!line.trim()) return;
      const [sku, alamat, qtyStr, barcode, ...deskripsiArr] = line.split(",").map((i) => i.trim());
      const deskripsi = deskripsiArr.join(",") || "-";
      dbMap[sku] = {
        sku,
        alamat,
        qty: parseFloat(qtyStr) || 0,
        deskripsi
      };
    });

    // B. Parse File Scan: Kode Menu, Alamat, SKU
    const barisScan = textScan.trim().split("\n");
    const scanList = [];
    const scanSkuToAlamatMap = {}; // SKU -> Set(Alamat)

    barisScan.forEach((line) => {
      if (!line.trim()) return;
      const [kodeMenu, alamat, sku] = line.split(",").map((i) => i.trim());
      if (sku) {
        scanList.push({ SKU: sku });
        if (!scanSkuToAlamatMap[sku]) scanSkuToAlamatMap[sku] = new Set();
        scanSkuToAlamatMap[sku].add(alamat);
      }
    });

    // --- SHEET 1: HASIL SCAN ---
    const sheet1Data = scanList;

    // --- SHEET 2: ANOMALI ---
    const sheet2Data = [];
    const scannedSkus = new Set(Object.keys(scanSkuToAlamatMap));

    // Kriteria 1 & 2: Dari perspektif DB (Short & Extra Qty 0)
    Object.values(dbMap).forEach((item) => {
      if (item.qty > 0 && !scannedSkus.has(item.sku)) {
        sheet2Data.push({
          SKU: item.sku,
          Alamat: item.alamat,
          Deskripsi: item.deskripsi,
          "Keterangan Anomali": "SKU Belum di Scan (Short)"
        });
      } else if (item.qty === 0) {
        sheet2Data.push({
          SKU: item.sku,
          Alamat: item.alamat,
          Deskripsi: item.deskripsi,
          "Keterangan Anomali": "SKU Extra (Qty System 0)"
        });
      }
    });

    // Kriteria 3 & 4: Dari perspektif File Scan (Extra diluar DB & Double Alamat)
    Object.entries(scanSkuToAlamatMap).forEach(([sku, alamatSet]) => {
      const inDb = !!dbMap[sku];
      const deskripsi = inDb ? dbMap[sku].deskripsi : "TIDAK ADA DI DATABASE";

      // Extra (Tidak ada di DB)
      if (!inDb) {
        alamatSet.forEach((alm) => {
          sheet2Data.push({
            SKU: sku,
            Alamat: alm,
            Deskripsi: deskripsi,
            "Keterangan Anomali": "SKU Extra (Tidak Ada di DB)"
          });
        });
      }

      // Double Alamat
      if (alamatSet.size > 1) {
        alamatSet.forEach((alm) => {
          sheet2Data.push({
            SKU: sku,
            Alamat: alm,
            Deskripsi: deskripsi,
            "Keterangan Anomali": "Double Alamat (Scan di Alamat Berbeda)"
          });
        });
      }
    });

    // --- GENERATE EXCEL VIA SHEETJS ---
    const workbook = XLSX.utils.book_new();

    // Sheet 1
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(workbook, ws1, "Hasil Scan");

    // Sheet 2
    const ws2 = XLSX.utils.json_to_sheet(
      sheet2Data.length ? sheet2Data : [{ SKU: "-", Alamat: "-", Deskripsi: "-", "Keterangan Anomali": "Tidak Ada Anomali" }]
    );
    XLSX.utils.book_append_sheet(workbook, ws2, "Anomali");

    // Download file
    XLSX.writeFile(workbook, "Hasil_Analisa_Anomali.xlsx");
  }
});
