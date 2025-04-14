(function() {
  // Pastikan sidebar tidak disisipkan lebih dari sekali
  if (document.getElementById('extension-sidebar')) return;

  let airdrops = [];
  let walletAddresses = [];
  let sidebarState = "minimized"; // default state diubah menjadi minimized

  // Load data dari chrome.storage.local
  function loadData(callback) {
    chrome.storage.local.get(["airdrops", "walletAddresses", "sidebarState"], (result) => {
      airdrops = result.airdrops || [];
      walletAddresses = result.walletAddresses || [];
      sidebarState = result.sidebarState || "minimized"; // fallback ke minimized
      renderWalletSelect(document.getElementById("airdropWalletSelect"));
      renderWalletSelect(document.getElementById("walletSelect"));
      renderWalletList();
      if (callback) callback();
    });
  }

  // Simpan state dan data ke chrome.storage.local
  function saveState() {
    chrome.storage.local.set({ sidebarState });
  }
  function saveData() {
    chrome.storage.local.set({ airdrops, walletAddresses });
  }

  // Render dropdown wallet
  function renderWalletSelect(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = `<option value="">-- Pilih Wallet Address --</option>`;
    walletAddresses.forEach(wallet => {
      const option = document.createElement("option");
      option.value = wallet;
      option.textContent = wallet;
      selectElement.appendChild(option);
    });
  }

  // Render daftar wallet
  function renderWalletList() {
    const walletList = document.getElementById('walletList');
    if (!walletList) return;
    walletList.innerHTML = "";
    walletAddresses.forEach(wallet => {
      const li = document.createElement("li");
      li.textContent = wallet;
      walletList.appendChild(li);
    });
  }

  // Buka halaman list airdrop di tab baru
  function viewAirdropList() {
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>LIST AIRDROP</title>
        <style>
          body { font-family: 'Poppins', sans-serif; padding: 20px; background-color: #f4f4f4; }
          h2 { text-align: center; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 12px; border: 1px solid #ccc; text-align: center; }
          th { background-color: #2ecc71; color: #fff; }
          tr:nth-child(even) { background-color: #e9e9e9; }
        </style>
      </head>
      <body>
        <h2>LIST AIRDROP</h2>
    `;
    if (airdrops.length === 0) {
      htmlContent += `<p>Tidak ada data airdrop.</p>`;
    } else {
      htmlContent += `<table>
          <tr>
            <th>LINK</th>
            <th>TAG</th>
            <th>WALLET ADDRESS</th>
            <th>CREATE ADD</th>
          </tr>`;
      airdrops.forEach(item => {
        const dateStr = new Date(item.timestamp).toLocaleString();
        htmlContent += `
          <tr>
            <td>${item.link}</td>
            <td>${item.tag}</td>
            <td>${item.wallet}</td>
            <td>${dateStr}</td>
          </tr>`;
      });
      htmlContent += `</table>`;
    }
    htmlContent += `</body></html>`;
    const newTab = window.open();
    newTab.document.write(htmlContent);
    newTab.document.close();
  }

  // Fungsi untuk menghasilkan file Excel dari data airdrop
  function generateExcel() {
    const wb = XLSX.utils.book_new();
    const airdropHeaders = ["𝗟𝗜𝗡𝗞", "𝗧𝗔𝗚 ", "𝗪𝗔𝗟𝗟𝗘𝗧 𝗔𝗗𝗗𝗥𝗘𝗦𝗦", "𝗖𝗥𝗘𝗔𝗧𝗘 𝗔𝗗𝗗"];
    const airdropData = airdrops.map(item => {
      const dateStr = new Date(item.timestamp).toLocaleString();
      return [item.link, item.tag, item.wallet, dateStr];
    });
    const sheetData = [airdropHeaders, ...airdropData];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);

    const colWidths = [];
    for (let col = 0; col < sheetData[0].length; col++) {
      let maxLength = 10;
      sheetData.forEach(row => {
        const cellValue = row[col] ? row[col].toString() : "";
        if (cellValue.length > maxLength) maxLength = cellValue.length;
      });
      colWidths.push({ wch: maxLength + 2 });
    }
    ws["!cols"] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, "Airdrop Data");
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], { type: "application/octet-stream" });
  }

  // Terapkan state sidebar full atau minimized tanpa memodifikasi layout website
  function applySidebarState() {
    const minimizeBtn = document.getElementById("minimizeBtn");
    const sidebarContent = sidebar.querySelector(".sidebar-content");
  
    if (!minimizeBtn || !sidebarContent) return;
  
    if (sidebarState === "full") {
      sidebar.classList.remove("minimized");
      sidebar.classList.add("full");
  
      // Ukuran normal sidebar
      sidebar.style.width = "320px";
      sidebar.style.height = "100%";
      sidebar.style.top = "0";
      sidebar.style.right = "0";
      sidebar.style.borderRadius = "0";
      sidebar.style.background = "linear-gradient(135deg, #243B55, #141E30)";
  
      // Tampilkan konten utama
      sidebarContent.style.display = "block";
  
      // Tampilkan tombol MINIMIZE (dengan teks atau icon)
      minimizeBtn.innerHTML = `<span style="font-weight: bold; color: white;">SHARE IT HUB</span>`;
      minimizeBtn.style.display = "block";
      minimizeBtn.style.background = "#00b894";
      minimizeBtn.style.width = "100%";
      minimizeBtn.style.height = "40px";
      minimizeBtn.style.border = "none";
      minimizeBtn.style.cursor = "pointer";
      minimizeBtn.style.padding = "5px 10px";
    } else {
      sidebar.classList.remove("full");
      sidebar.classList.add("minimized");
  
      // Ukuran minimized
      sidebar.style.width             = "90px";
      sidebar.style.height            = "90px";
      sidebar.style.top               = "90px";
      sidebar.style.right             = "90px";
      sidebar.style.backgroundImage   = "none";
      sidebar.style.backgroundColor   = "transparent";
      sidebar.style.border            = "none";
      sidebar.style.borderRadius      = "50%";
  
      // Sembunyikan konten utama
      sidebarContent.style.display = "none";
  
      // Ganti tombol jadi ikon besar
      const iconUrl = chrome.runtime.getURL("icons2.png");
      minimizeBtn.innerHTML = `
        <img src="${iconUrl}" alt="Expand"
             style="width: 72px; height: 72px; object-fit: contain;" />
      `;
      minimizeBtn.style.display = "block";
      minimizeBtn.style.background = "transparent";
      minimizeBtn.style.border = "none";
      minimizeBtn.style.padding = "0";
      minimizeBtn.style.width = "100%";
      minimizeBtn.style.height = "100%";
      minimizeBtn.style.cursor = "pointer";
    }
  }  
  
  // Buat elemen sidebar dengan struktur HTML
  const sidebar = document.createElement('div');
  sidebar.id = 'extension-sidebar';
  sidebar.classList.add("full");
  sidebar.innerHTML = `
  <div class="sidebar-container">
    <button class="minimize-btn" id="minimizeBtn">Minimize</button>
    <div class="sidebar-content">
      <!-- Konten sidebar -->
        <h2><i class="fas fa-rocket"></i> SHARE IT HUB</h2>
        <!-- Section: Add Airdrop -->
        <div class="section" id="section-airdrop">
          <div class="input-group">
            <label for="airdropWalletSelect"><i class="fas fa-wallet"></i> Wallet Address</label>
            <select id="airdropWalletSelect">
              <option value="">-- Pilih Wallet Address --</option>
            </select>
          </div>
          <div class="input-group">
            <label for="airdropTagSelect"><i class="fas fa-tag"></i> Tag</label>
            <select id="airdropTagSelect">
              <option value="TESTNET">TESTNET</option>
              <option value="NODE">NODE</option>
              <option value="AIRDROP">AIRDROP</option>
              <option value="RETROACTIVE">RETROACTIVE</option>
              <option value="OTHER">OTHER (Manual)</option>
            </select>
          </div>
          <div class="input-group" id="customTagGroup" style="display:none;">
            <input type="text" id="customTagInput" placeholder="Masukkan tag manual">
          </div>
          <div class="input-group">
            <label for="airdropLink"><i class="fas fa-link"></i> Link</label>
            <input type="text" id="airdropLink" placeholder="Masukkan link airdrop">
          </div>
          <button id="addAirdrop">Add Airdrop</button>
          <button id="viewAirdropList">Check LIST AIRDROP</button>
        </div>
        <!-- Section: Wallet -->
        <div class="section" id="section-wallet">
          <div class="input-group">
            <label for="walletInput"><i class="fas fa-address-book"></i> Wallet Address</label>
            <input type="text" id="walletInput" placeholder="Masukkan wallet address">
          </div>
          <button id="addWallet">Add Wallet</button>
          <ul id="walletList"></ul>
        </div>
        <!-- Section: Check Balance -->
        <div class="section" id="section-balance">
          <div class="input-group">
            <label for="walletSelect"><i class="fas fa-search-dollar"></i> Select Wallet</label>
            <select id="walletSelect">
              <option value="">-- Pilih WALLET ADDRESS --</option>
            </select>
          </div>
          <button id="checkWalletBalance">Check Wallet Balance</button>
          <div id="balanceResult"></div>
        </div>
        <!-- Section: Export Excel -->
        <div class="section" id="section-export">
          <button id="exportExcel"><i class="fas fa-file-excel"></i> Export to Excel</button>
        </div>
      </div>
    </div>
`;
  document.body.appendChild(sidebar);
  applySidebarState();

  // Event toggle minimize/expand sidebar
  const minimizeBtn = document.getElementById("minimizeBtn");
  minimizeBtn.addEventListener("click", () => {
    sidebarState = sidebar.classList.contains("minimized") ? "full" : "minimized";
    applySidebarState();
    saveState();
  });

  // Inisialisasi dropdown wallet
  const airdropWalletSelect = document.getElementById("airdropWalletSelect");
  const walletSelect = document.getElementById("walletSelect");
  renderWalletSelect(airdropWalletSelect);
  renderWalletSelect(walletSelect);

  // Tampilkan input custom tag jika "OTHER" dipilih
  const airdropTagSelect = document.getElementById("airdropTagSelect");
  const customTagGroup = document.getElementById("customTagGroup");
  airdropTagSelect.addEventListener("change", () => {
    customTagGroup.style.display = airdropTagSelect.value === "OTHER" ? "flex" : "none";
  });

  // Event: Tambah Airdrop
  document.getElementById("addAirdrop").addEventListener("click", () => {
    const wallet = airdropWalletSelect.value;
    let tag = airdropTagSelect.value;
    if (tag === "OTHER") tag = document.getElementById("customTagInput").value.trim();
    const link = document.getElementById("airdropLink").value.trim();
    if (!wallet || !tag || !link) {
      alert("Harap isi wallet, tag, dan link!");
      return;
    }
    airdrops.push({ wallet, tag, link, timestamp: Date.now() });
    saveData();
    alert("Airdrop berhasil ditambahkan!");
    airdropWalletSelect.selectedIndex = 0;
    airdropTagSelect.selectedIndex = 0;
    document.getElementById("customTagInput").value = "";
    customTagGroup.style.display = "none";
    document.getElementById("airdropLink").value = "";
  });

  // Event: Lihat List Airdrop
  document.getElementById("viewAirdropList").addEventListener("click", viewAirdropList);

  // Event: Tambah Wallet
  document.getElementById("addWallet").addEventListener("click", () => {
    const wallet = document.getElementById("walletInput").value.trim();
    if (wallet) {
      walletAddresses.push(wallet);
      saveData();
      renderWalletList();
      renderWalletSelect(airdropWalletSelect);
      renderWalletSelect(walletSelect);
      alert("Wallet berhasil ditambahkan! Jangan lupa Join Telegram & YouTube : SHARE IT HUB");
      window.open("https://youtu.be/bodHaUgROlo", "_blank");
      document.getElementById("walletInput").value = "";
    } else {
      alert("Harap masukkan wallet address.");
    }
  });

  // Event: Cek Wallet Balance
  document.getElementById("checkWalletBalance").addEventListener("click", () => {
    const wallet = walletSelect.value;
    if (!wallet) {
      alert("Pilih wallet terlebih dahulu.");
      return;
    }
    const debankUrl = `https://debank.com/profile/${wallet}`;
    window.open(debankUrl, "_blank");
    document.getElementById("balanceResult").innerHTML = `
      <strong>Wallet:</strong> ${wallet}<br>
      <strong>Status:</strong> Halaman saldo wallet akan terbuka di tab baru.
    `;
  });

  // Event: Export ke Excel
  document.getElementById("exportExcel").addEventListener("click", () => {
    const blob = generateExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data_airdrop_wallet.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  });

  loadData();
})();
