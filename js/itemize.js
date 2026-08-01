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
      const namaTokoInput = document.getElementById("nama-toko-input").value.trim();
      const fileDbInput = document.getElementById("file-db-txt").files[0];
      const fileScanInput = document.getElementById("file-scan-txt").files[0];

      if (!namaTokoInput) {
        alert("Harap masukkan Nama Toko terlebih dahulu!");
        return;
      }

      if (!fileDbInput || !fileScanInput) {
        alert("Harap upload kedua file .txt terlebih dahulu!");
        return;
      }

      statusText.innerText = "Sedang memproses analisa...";
      statusText.style.color = "blue";

      try {
        const textDb = await bacaFileTeks(fileDbInput);
        const textScan = await bacaFileTeks(fileScanInput);

        prosesDanDownloadExcel(namaTokoInput, textDb, textScan);
        
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

  // Logika Analisa, Summary, & Export Excel
  function prosesDanDownloadExcel(namaToko, textDb, textScan) {
    // A. Parse File Database (9 Kolom)
    const barisDb = textDb.trim().split("\n");
    const dbMap = {}; // SKU -> { sku, alamat, harga, qty, deskripsi }
    let totalSkuDbValid = 0; // Total SKU sistem dengan Qty > 0 (untuk basis akurasi)

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
        if (qty > 0) {
          totalSkuDbValid++;
        }
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

    let countShort = 0;
    let countExtra = 0;
    let countDoubleAlamat = 0;

    // 1. SKU Belum di Scan (Short)
    Object.values(dbMap).forEach((item) => {
      if (item.qty > 0 && !scannedSkus.has(item.sku)) {
        countShort++;
        sheet2Data.push({
          SKU: item.sku,
          Alamat: item.alamat,
          Harga: item.harga,
          "Qty System": item.qty,
          Deskripsi: item.deskripsi,
          "Keterangan Anomali": "SKU Short"
        });
      }
    });

    // 2. SKU Extra & Double Alamat
    Object.entries(scanSkuToAlamatMap).forEach(([sku, alamatSet]) => {
      const inDb = !!dbMap[sku];
      
      // SKU Extra Kondisi A (Tidak ada di DB) atau Kondisi B (Qty System = 0)
      if (!inDb) {
        alamatSet.forEach((alm) => {
          countExtra++;
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
        if (dbMap[sku].qty === 0) {
          alamatSet.forEach((alm) => {
            countExtra++;
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

      // Double Alamat
      if (alamatSet.size > 1) {
        alamatSet.forEach((alm) => {
          countDoubleAlamat++;
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

    // --- PERHITUNGAN AKURASI ---
    // Akurasi dihitung berdasarkan seberapa bersih dari temuan short & extra dibanding total SKU sistem
    let totalAnomaliItem = countShort + countExtra;
    let akurasiVal = 100;
    if (totalSkuDbValid > 0) {
      let selisih = totalSkuDbValid - totalAnomaliItem;
      akurasiVal = selisih > 0 ? (selisih / totalSkuDbValid) * 100 : 0;
    }
    const akurasiFormatted = akurasiVal.toFixed(2) + "%";

    // --- SHEET 3: SUMMARY ---
    const sheet3Data = [
      { Metric: "Total SKU Short (Belum di Scan)", Jumlah: countShort },
      { Metric: "Total SKU Extra", Jumlah: countExtra },
      { Metric: "Total SKU Double Alamat", Jumlah: countDoubleAlamat },
      { Metric: "Akurasi Stock Opname / Scan", Jumlah: akurasiFormatted }
    ];

    // --- GENERATE EXCEL VIA SHEETJS ---
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Hasil Scan
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(workbook, ws1, "Hasil Scan");

    // Sheet 2: Anomali
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

    // Sheet 3: Summary
    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(workbook, ws3, "Summary");

    // Format Nama File: nama toko_itemize_tanggal.xlsx
    const tanggalHariIni = new Date().toISOString().split("T")[0]; // Format: YYYY-MM-DD
    // Bersihkan karakter aneh pada nama toko agar aman jadi nama file
    const safeNamaToko = namaToko.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    const filename = `${safeNamaToko}_itemize_${tanggalHariIni}.xlsx`;

    // Download file Excel
    XLSX.writeFile(workbook, filename);
  }
});
