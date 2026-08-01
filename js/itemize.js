document.addEventListener("DOMContentLoaded", () => {
  const navBtn = document.getElementById("nav-itemize");
  const sectionAnalisa = document.getElementById("section-itemize");
  const pageTitle = document.getElementById("pageTitle");

  // Fungsi untuk menampilkan seksi Itemize dan menyimpan state ke localStorage
  function openItemizeView() {
    document.querySelectorAll("main[id^='section-']").forEach((sec) => {
      sec.classList.add("hidden");
    });
    
    if (sectionAnalisa) {
      sectionAnalisa.classList.remove("hidden");
    }

    if (pageTitle) {
      pageTitle.innerText = "Itemize - Analisa Anomali Scan";
    }

    // Simpan status aktif ke memori browser agar tidak hilang saat refresh
    localStorage.setItem("activePortalMenu", "itemize");
  }

  // Cek saat halaman dimuat: apakah sebelumnya user berada di menu Itemize?
  if (localStorage.getItem("activePortalMenu") === "itemize") {
    openItemizeView();
  }

  // 1. Navigasi Side Panel
  if (navBtn && sectionAnalisa) {
    navBtn.addEventListener("click", (e) => {
      e.preventDefault();
      openItemizeView();

      const sidebarMenu = document.getElementById("sidebarMenu");
      const sidebarBackdrop = document.getElementById("sidebarBackdrop");
      if (sidebarMenu && !sidebarMenu.classList.contains("-translate-x-full") && window.innerWidth < 768) {
        sidebarMenu.classList.add("-translate-x-full");
        if (sidebarBackdrop) sidebarBackdrop.classList.add("hidden");
      }
    });
  }

  // Jika user mengklik menu lain di sidebar, hapus memori activePortalMenu
  document.querySelectorAll("aside nav button, aside nav a").forEach((menuItem) => {
    if (menuItem.id !== "nav-itemize") {
      menuItem.addEventListener("click", () => {
        localStorage.removeItem("activePortalMenu");
      });
    }
  });

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
        if (qty > 0) {
          totalSkuDbValid++;
        }
      }
    });

    const barisScan = textScan.trim().split("\n");
    const scanList = [];
    const scanSkuToAlamatMap = {}; 

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

    const sheet1Data = scanList;
    const sheet2Data = [];
    const scannedSkus = new Set(Object.keys(scanSkuToAlamatMap));

    let countShort = 0;
    let countExtra = 0;
    let countDoubleAlamat = 0;

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

    Object.entries(scanSkuToAlamatMap).forEach(([sku, alamatSet]) => {
      const inDb = !!dbMap[sku];
      
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

    let totalAnomaliItem = countShort + countExtra;
    let akurasiVal = 100;
    if (totalSkuDbValid > 0) {
      let selisih = totalSkuDbValid - totalAnomaliItem;
      akurasiVal = selisih > 0 ? (selisih / totalSkuDbValid) * 100 : 0;
    }
    const akurasiFormatted = akurasiVal.toFixed(2) + "%";

    const sheet3Data = [
      { Metric: "Total SKU Short (Belum di Scan)", Jumlah: countShort },
      { Metric: "Total SKU Extra", Jumlah: countExtra },
      { Metric: "Total SKU Double Alamat", Jumlah: countDoubleAlamat },
      { Metric: "Akurasi Stock Opname / Scan", Jumlah: akurasiFormatted }
    ];

    const workbook = XLSX.utils.book_new();

    const ws1 = XLSX.utils.json_to_sheet(sheet1Data);
    XLSX.utils.book_append_sheet(workbook, ws1, "Hasil Scan");

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

    const ws3 = XLSX.utils.json_to_sheet(sheet3Data);
    XLSX.utils.book_append_sheet(workbook, ws3, "Summary");

    const tanggalHariIni = new Date().toISOString().split("T")[0];
    const safeNamaToko = namaToko.replace(/[^a-zA-Z0-9-_ ]/g, "").trim();
    const filename = `${safeNamaToko}_itemize_${tanggalHariIni}.xlsx`;

    XLSX.writeFile(workbook, filename);
  }
});
