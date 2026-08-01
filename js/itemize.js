document.addEventListener("DOMContentLoaded", () => {
  // 1. Navigasi Side Panel (Menyesuaikan id="nav-itemize" & id="section-itemize")
  const navBtn = document.getElementById("nav-itemize");
  const sectionAnalisa = document.getElementById("section-itemize");
  const pageTitle = document.getElementById("pageTitle");

  if (navBtn && sectionAnalisa) {
    navBtn.addEventListener("click", (e) => {
      e.preventDefault();
      
      // Sembunyikan semua seksi konten utama aplikasi (mengikuti pola portal)
      document.querySelectorAll("main[id^='section-']").forEach((sec) => {
        sec.classList.add("hidden");
      });
      
      // Tampilkan seksi Itemize
      sectionAnalisa.classList.remove("hidden");

      // Perbarui judul halaman di bagian header atas
      if (pageTitle) {
        pageTitle.innerText = "Itemize - Analisa Anomali Scan";
      }

      // Tutup sidebar otomatis pada tampilan perangkat mobile
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
    const barisDb = textDb.trim().split("\n");
    const dbMap = {};

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

    const barisScan = textScan.trim().split("\n");
    const scanList = [];
    const scanSkuToAlamatMap = {};

    barisScan.forEach((line) => {
      if (!line.trim()) return;
      const [kodeMenu, alamat, sku] = line.split(",").map((i) => i.trim());
      if (sku) {
        scanList.push({ SKU: sku });
        if (!scanSkuToAlamatMap[sku]) scanSkuToAlamatMap[sku] = new Set();
        scanSkuToAlamatMap[sku].add(alamat);
      }
    });

    const sheet1Data = scanList;
    const sheet2Data = [];
    const scannedSkus = new Set(Object.keys(scanSkuToAlamatMap));

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

    Object.entries(scanSkuToAlamatMap).forEach(([sku, alamatSet]) => {
      const inDb = !!dbMap[sku];
      const deskripsi = inDb ? dbMap[sku].deskripsi : "TIDAK ADA DI DATABASE";

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

    const workbook = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(workbook, ws1, "Hasil Scan");

    const ws2 = XLSX.utils.json_to_sheet(
      sheet2Data.length ? sheet2Data : [{ SKU: "-", Alamat: "-", Deskripsi: "-", "Keterangan Anomali": "Tidak Ada Anomali" }]
    );
    XLSX.utils.book_append_sheet(workbook, ws2, "Anomali");

    XLSX.writeFile(workbook, "Hasil_Analisa_Anomali.xlsx");
  }
});
