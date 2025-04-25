(function() {
  if (document.getElementById('extension-sidebar')) return;

  let airdrops = [];
  let walletAddresses = [];
  let sidebarState = "minimized"; 
  let sidebarPosition = { top: 90, left: null };   // default posisi saat minimized
  let isDragging = false, dragOffsetX = 0, dragOffsetY = 0;
  let privateKeys = {};   // { address: privateKey }
  let phrases     = {};   // { address: mnemonicPhrase }

  // — PASSWORD FEATURE — 
  let passwordHash = "";        // stored SHA-256 password
  let unlocked = false;         // apakah sudah memasukkan password di sesi ini

  async function sha256(str) {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  function loadData(callback) {
    chrome.storage.local.get(
      ["airdrops","walletAddresses","sidebarState","sidebarPosition","privateKeys","phrases","passwordHash"],
      async (result) => {    // ← jadikan callback async
        airdrops        = result.airdrops        || [];
        walletAddresses = result.walletAddresses || [];
        sidebarState    = result.sidebarState    || "minimized";
        sidebarPosition = result.sidebarPosition || sidebarPosition;
        privateKeys     = result.privateKeys     || {};
        phrases         = result.phrases         || {};

        // — PASSWORD DEFAULT —
        if (!result.passwordHash) {
          // belum ada password di storage → set default "shareithub"
          passwordHash = await sha256("shareithub");
          savePassword();
        } else {
          passwordHash = result.passwordHash;
        }
        // — end PASSWORD DEFAULT —

        renderWalletSelect(document.getElementById("airdropWalletSelect"));
        renderWalletSelect(document.getElementById("walletSelect"));
        renderWalletSelect(document.getElementById("saveKeyWalletSelect"));
        renderWalletSelect(document.getElementById("savePhraseWalletSelect"));
        renderWalletList();
        applySidebarState();
        if (callback) callback();
      }
    );
  }

  function saveState()    { chrome.storage.local.set({ sidebarState }); }
  function saveData()     { chrome.storage.local.set({ airdrops, walletAddresses }); }
  function savePosition() { chrome.storage.local.set({ sidebarPosition }); }
  function saveKeys()     { chrome.storage.local.set({ privateKeys }); }
  function savePhrases()  { chrome.storage.local.set({ phrases }); }
  // — PASSWORD FEATURE —
  function savePassword() { chrome.storage.local.set({ passwordHash }); }

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

  function generateExcel() {
    const wb = XLSX.utils.book_new();
  
    // === Sheet 1: Airdrop Data ===
    const airdropHeaders = ["𝗟𝗜𝗡𝗞", "𝗧𝗔𝗚 ", "𝗪𝗔𝗟𝗟𝗘𝗧 𝗔𝗗𝗗𝗥𝗘𝗦𝗦", "𝗖𝗥𝗘𝗔𝗧𝗘 𝗔𝗗𝗗"];
    const airdropData = airdrops.map(item => {
      const dateStr = new Date(item.timestamp).toLocaleString();
      return [item.link, item.tag, item.wallet, dateStr];
    });
    const sheetData = [airdropHeaders, ...airdropData];
    const ws1 = XLSX.utils.aoa_to_sheet(sheetData);
  
    // Autosize column widths (Sheet 1)
    const colWidths1 = [];
    for (let col = 0; col < sheetData[0].length; col++) {
      let maxLength = sheetData[0][col].length;
      sheetData.forEach(row => {
        const cellValue = row[col] ? row[col].toString() : "";
        if (cellValue.length > maxLength) maxLength = cellValue.length;
      });
      colWidths1.push({ wch: maxLength + 2 });
    }
    ws1["!cols"] = colWidths1;
    XLSX.utils.book_append_sheet(wb, ws1, "Airdrop Data");
  
    // === Sheet 2: Wallet + Private Key + Phrase ===
    const walletHeaders = ["𝗪𝗔𝗟𝗟𝗘𝗧 𝗔𝗗𝗗𝗥𝗘𝗦𝗦", "𝗣𝗥𝗜𝗩𝗔𝗧𝗘 𝗞𝗘𝗬", "𝗣𝗛𝗥𝗔𝗦𝗘"];
    const walletData = walletAddresses.map(addr => [
      addr,
      privateKeys[addr] || "",
      phrases[addr] || ""
    ]);
    const walletSheet = [walletHeaders, ...walletData];
    const ws2 = XLSX.utils.aoa_to_sheet(walletSheet);
  
    // Autosize column widths (Sheet 2)
    const colWidths2 = [];
    for (let col = 0; col < walletSheet[0].length; col++) {
      let maxLength = walletSheet[0][col].length;
      walletSheet.forEach(row => {
        const cellValue = row[col] ? row[col].toString() : "";
        if (cellValue.length > maxLength) maxLength = cellValue.length;
      });
      colWidths2.push({ wch: maxLength + 2 });
    }
    ws2["!cols"] = colWidths2;
    XLSX.utils.book_append_sheet(wb, ws2, "Wallet Data");
  
    // Output file
    const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    return new Blob([wbout], { type: "application/octet-stream" });
  }
  

  function applySidebarState() {
    const minimizeBtn = document.getElementById("minimizeBtn");
    const sidebarContent = sidebar.querySelector(".sidebar-content");
  
    if (!minimizeBtn || !sidebarContent) return;
  
    if (sidebarState === "full") {
      sidebar.classList.remove("minimized");
      sidebar.classList.add("full");

      sidebar.style.width  = "320px";
      sidebar.style.height = "100%";
      sidebar.style.top    = "0";
      sidebar.style.right  = "0";
      sidebar.style.left   = "auto";
      sidebar.style.borderRadius = "0";
      sidebar.style.background = "linear-gradient(135deg, #243B55, #141E30)";

      sidebarContent.style.display = "block";

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

      sidebar.style.width           = "90px";
      sidebar.style.height          = "90px";
      sidebar.style.borderRadius    = "50%";
      sidebar.style.backgroundImage = "none";
      sidebar.style.backgroundColor = "transparent";
      sidebar.style.border          = "none";

      if (sidebarPosition.left !== null) {
        sidebar.style.left  = sidebarPosition.left + "px";
        sidebar.style.top   = sidebarPosition.top  + "px";
        sidebar.style.right = "auto";
      } else {
        sidebar.style.top   = "90px";
        sidebar.style.right = "90px";
        sidebar.style.left  = "auto";
      }

      sidebarContent.style.display = "none";

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

  const sidebar = document.createElement('div');
  sidebar.id = 'extension-sidebar';
  sidebar.classList.add("full");
  sidebar.innerHTML = `
  <div class="sidebar-container">
    <button class="minimize-btn" id="minimizeBtn">Minimize</button>
    <div class="sidebar-content">
      <!-- Konten sidebar -->
      <h2><i class="fas fa-rocket"></i> SHARE IT HUB</h2>

      <!-- — PASSWORD FEATURE — Security Section -->
      <div class="section" id="section-security">
        <h3>Security</h3>
        <div class="input-group">
          <label for="setPasswordInput"><i class="fas fa-lock"></i> Set Password</label>
          <input type="password" id="setPasswordInput" placeholder="Enter new password">
        </div>
        <button id="setPasswordBtn">Save Password</button>
      </div>

      <!-- Section: Add Airdrop -->
      <div class="section" id="section-airdrop">
        <div class="input-group">
          <label for="airdropWalletSelect"><i class="fas fa-wallet"></i> Wallet Address</label>
          <select id="airdropWalletSelect"><option value="">-- Pilih Wallet Address --</option></select>
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
          <select id="walletSelect"><option value="">-- Pilih WALLET ADDRESS --</option></select>
        </div>
        <button id="checkWalletBalance">Check Wallet Balance</button>
        <div id="balanceResult"></div>
      </div>
      <!-- Section: Export Excel -->
      <div class="section" id="section-export">
        <button id="exportExcel"><i class="fas fa-file-excel"></i> Export to Excel</button>
        <button id="exportJSON"><i class="fas fa-file-code"></i> Export JSON</button>
        <button id="importJSON"><i class="fas fa-file-import"></i> Import JSON</button>
        <button id="clearAllData"><i class="fas fa-trash"></i> Clear All Data</button>
        <input type="file" id="importFile" accept="application/json" style="display:none;" />
      </div>
      <!-- Section: EVM Wallet Features -->
      <div class="section" id="section-evm">
        <h3>Create Wallet EVM</h3>
        <button id="createEvmWallet">Generate EVM Wallet</button>
        <div id="evmResult" style="font-size:0.9rem; margin-top:8px;"></div>
        <hr style="border-color:#555;margin:10px 0;">
        <h3>Save Private Key</h3>
        <div class="input-group">
          <label for="saveKeyWalletSelect">Pilih Wallet</label>
          <select id="saveKeyWalletSelect"></select>
        </div>
        <div class="input-group">
          <label for="inputPrivateKey">Private Key</label>
          <input type="text" id="inputPrivateKey" placeholder="0x...">
        </div>
        <button id="savePrivateKey">Save Private Key</button>
        <hr style="border-color:#555;margin:10px 0;">
        <h3>Save Phrase</h3>
        <div class="input-group">
          <label for="savePhraseWalletSelect">Pilih Wallet</label>
          <select id="savePhraseWalletSelect"></select>
        </div>
        <div class="input-group">
          <label for="inputPhrase">Mnemonic Phrase</label>
          <input type="text" id="inputPhrase" placeholder="word1 word2 ...">
        </div>
        <button id="savePhrase">Save Phrase</button>
      </div>
    </div>
  </div>
`;
  document.body.appendChild(sidebar);
  applySidebarState();

// tombol minimize/full dengan password check (diperbaiki)
document.getElementById("minimizeBtn").addEventListener("click", async () => {
  const isMinimizedNow = sidebar.classList.contains("minimized");

  if (isMinimizedNow) {
    // user ingin expand → cek password
    if (passwordHash) {
      const input = prompt("Enter password to unlock:");
      const inputHash = input ? await sha256(input) : "";
      if (inputHash !== passwordHash) {
        alert("Password salah!");
        return; // tetap di-minimize
      }
    }
    unlocked = true;
    sidebarState = "full";
  } else {
    // user meminimize → reset unlocked supaya next expand minta password lagi
    unlocked = false;
    sidebarState = "minimized";
  }

  applySidebarState();
  saveState();
});

  // render selects dasar
  const airdropWalletSelect = document.getElementById("airdropWalletSelect");
  const walletSelect        = document.getElementById("walletSelect");
  renderWalletSelect(airdropWalletSelect);
  renderWalletSelect(walletSelect);

  // custom tag logic
  document.getElementById("airdropTagSelect").addEventListener("change", () => {
    document.getElementById("customTagGroup").style.display =
      document.getElementById("airdropTagSelect").value === "OTHER" ? "flex" : "none";
  });

  // add airdrop
  document.getElementById("addAirdrop").addEventListener("click", () => {
    const wallet = airdropWalletSelect.value;
    let tag = document.getElementById("airdropTagSelect").value;
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
    document.getElementById("airdropTagSelect").selectedIndex = 0;
    document.getElementById("customTagInput").value = "";
    document.getElementById("airdropLink").value = "";
  });

  // view list
  document.getElementById("viewAirdropList").addEventListener("click", viewAirdropList);

  // add wallet
  document.getElementById("addWallet").addEventListener("click", () => {
    const wallet = document.getElementById("walletInput").value.trim();
    if (!wallet) {
      alert("Harap masukkan wallet address.");
      return;
    }
    if (walletAddresses.includes(wallet)) {
      alert("Wallet ini sudah ada di daftar.");
      document.getElementById("walletInput").value = "";
      return;
    }
    walletAddresses.push(wallet);
    saveData();
    renderWalletList();
    ["airdropWalletSelect","walletSelect","saveKeyWalletSelect","savePhraseWalletSelect"]
      .forEach(id => renderWalletSelect(document.getElementById(id)));
    alert("Wallet berhasil ditambahkan!");
    document.getElementById("walletInput").value = "";
  });

  // check balance
  document.getElementById("checkWalletBalance").addEventListener("click", () => {
    const wallet = walletSelect.value;
    if (!wallet) {
      alert("Pilih wallet terlebih dahulu.");
      return;
    }
    window.open(`https://debank.com/profile/${wallet}`, "_blank");
  });

  // export Excel
  document.getElementById("exportExcel").addEventListener("click", () => {
    const blob = generateExcel();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data_airdrop_wallet.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  });

  // export JSON
  document.getElementById("exportJSON").addEventListener("click", () => {
    const backup = { airdrops, walletAddresses, privateKeys, phrases, sidebarState, sidebarPosition };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup_extension_data.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  // import JSON
  const importFile = document.getElementById("importFile");
  document.getElementById("importJSON").addEventListener("click", () => importFile.click());
  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target.result);
        chrome.storage.local.set({
          airdrops: data.airdrops || [],
          walletAddresses: data.walletAddresses || [],
          privateKeys: data.privateKeys || {},
          phrases: data.phrases || {},
          sidebarState: data.sidebarState || sidebarState,
          sidebarPosition: data.sidebarPosition || sidebarPosition,
          passwordHash: data.passwordHash || passwordHash    // restore password jika ada
        }, () => {
          loadData();
          alert("Data berhasil di-import dari JSON.");
        });
      } catch (err) {
        alert("Gagal membaca file JSON: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  // clear all data
  document.getElementById("clearAllData").addEventListener("click", () => {
    if (confirm("Yakin ingin menghapus *semua* data airdrop, wallet, keys & phrases?")) {
      chrome.storage.local.clear(() => {
        airdrops = [];
        walletAddresses = [];
        privateKeys = {};
        phrases = {};
        passwordHash = "";
        unlocked = false;
        renderWalletList();
        renderWalletSelect(document.getElementById("airdropWalletSelect"));
        renderWalletSelect(document.getElementById("walletSelect"));
        renderWalletSelect(document.getElementById("saveKeyWalletSelect"));
        renderWalletSelect(document.getElementById("savePhraseWalletSelect"));
        applySidebarState();
        alert("Semua data telah dihapus.");
      });
    }
  });

  // set password button
  document.getElementById("setPasswordBtn").addEventListener("click", async () => {
    const pwd = document.getElementById("setPasswordInput").value;
    if (!pwd) { alert("Masukkan password baru."); return; }
    passwordHash = await sha256(pwd);
    savePassword();
    document.getElementById("setPasswordInput").value = "";
    unlocked = true;
    alert("Password berhasil disimpan.");
  });

  // Create Wallet EVM
  document.getElementById("createEvmWallet").addEventListener("click", () => {
    const wallet = ethers.Wallet.createRandom();
    const newTab = window.open();
    const html = `
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>New EVM Wallet</title>
      <style>body{font-family:Poppins,sans-serif;padding:20px;background:#f4f4f4;color:#333;}
             h2{margin-bottom:10px;} .item{margin:8px 0;font-size:0.95rem;}</style>
      </head><body>
        <h2>Generated EVM Wallet</h2>
        <div class="item"><strong>Address:</strong> ${wallet.address}</div>
        <div class="item"><strong>Private Key:</strong> ${wallet.privateKey}</div>
        <div class="item"><strong>Phrase:</strong> ${wallet.mnemonic.phrase}</div>
      </body></html>`;
    newTab.document.write(html);
    newTab.document.close();
    walletAddresses.push(wallet.address);
    privateKeys[wallet.address] = wallet.privateKey;
    phrases[wallet.address]      = wallet.mnemonic.phrase;
    saveData(); saveKeys(); savePhrases();
    ["airdropWalletSelect","walletSelect","saveKeyWalletSelect","savePhraseWalletSelect"]
      .forEach(id => renderWalletSelect(document.getElementById(id)));
  });

  // Save Private Key
  document.getElementById("savePrivateKey").addEventListener("click", () => {
    const w = document.getElementById("saveKeyWalletSelect").value;
    const k = document.getElementById("inputPrivateKey").value.trim();
    if (!w) { alert("Pilih wallet terlebih dahulu."); return; }
    if (!k) { alert("Masukkan private key."); return; }
    privateKeys[w] = k;
    saveKeys();
    alert("Private key tersimpan untuk wallet " + w);
    document.getElementById("inputPrivateKey").value = "";
  });

  // Save Phrase
  document.getElementById("savePhrase").addEventListener("click", () => {
    const w = document.getElementById("savePhraseWalletSelect").value;
    const p = document.getElementById("inputPhrase").value.trim();
    if (!w) { alert("Pilih wallet terlebih dahulu."); return; }
    if (!p) { alert("Masukkan mnemonic phrase."); return; }
    phrases[w] = p;
    savePhrases();
    alert("Phrase tersimpan untuk wallet " + w);
    document.getElementById("inputPhrase").value = "";
  });

  // drag & drop saat minimized
  sidebar.addEventListener("mousedown", e => {
    if (!sidebar.classList.contains("minimized")) return;
    isDragging = true;
    const rect = sidebar.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", onStopDrag);
    e.preventDefault();
  });
  function onDrag(e) {
    if (!isDragging) return;
    const newLeft = e.clientX - dragOffsetX;
    const newTop  = e.clientY - dragOffsetY;
    sidebar.style.left  = newLeft + "px";
    sidebar.style.top   = newTop  + "px";
    sidebar.style.right = "auto";
    sidebarPosition.top  = newTop;
    sidebarPosition.left = newLeft;
  }
  function onStopDrag() {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", onStopDrag);
    savePosition();
  }

  loadData();
})();
