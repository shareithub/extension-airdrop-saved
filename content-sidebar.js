(function() {
  if (document.getElementById('extension-sidebar')) return;

  let airdrops = [];
  let walletAddresses = [];
  let sidebarState = "minimized"; 
  let sidebarPosition = { top: 90, left: null };   // default posisi saat minimized
  let nameTags        = {};   // { address: tag }
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
      ["airdrops","walletAddresses","sidebarState","sidebarPosition","privateKeys","phrases","passwordHash","nameTags"],
      async (result) => {    // ← jadikan callback async
        airdrops        = result.airdrops        || [];
        walletAddresses = result.walletAddresses || [];
        sidebarState    = result.sidebarState    || "minimized";
        sidebarPosition = result.sidebarPosition || sidebarPosition;
        privateKeys     = result.privateKeys     || {};
        phrases         = result.phrases         || {};
        nameTags        = result.nameTags        || {};

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
  function saveTags()     { chrome.storage.local.set({ nameTags }); }
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
      // jika ada tag, tampilkan "address ( TAG )"
      const display = nameTags[wallet]
        ? `${wallet} ( ${nameTags[wallet]} )`
        : wallet;
      const option = document.createElement("option");
      option.value = wallet;
      option.textContent = display;
      selectElement.appendChild(option);
    });
  }
  
  function renderWalletList() {
    const walletList = document.getElementById('walletList');
    if (!walletList) return;
    walletList.innerHTML = "";
    walletAddresses.forEach(wallet => {
      const display = nameTags[wallet]
        ? `${wallet} ( ${nameTags[wallet]} )`
        : wallet;
  
      const li = document.createElement("li");
      li.style.marginBottom = "6px";
      li.style.display = "flex";
      li.style.alignItems = "center";
      li.style.justifyContent = "space-between";
  
      // Tombol buka Debank
      const openBtn = document.createElement("button");
      openBtn.textContent = display;
      openBtn.style.flexGrow = "1";
      openBtn.style.marginRight = "6px";
      openBtn.style.padding = "5px 10px";
      openBtn.style.border = "1px solid #ccc";
      openBtn.style.borderRadius = "4px";
      openBtn.style.background = "#3498db";
      openBtn.style.color = "#fff";
      openBtn.style.cursor = "pointer";
      openBtn.addEventListener("click", () => {
        window.open(`https://debank.com/profile/${wallet}`, "_blank");
      });
  
      // Tombol Delete
      const deleteBtn = document.createElement("button");
      deleteBtn.textContent = "🗑️";
      deleteBtn.style.padding = "5px 10px";
      deleteBtn.style.background = "#e74c3c";
      deleteBtn.style.color = "#fff";
      deleteBtn.style.border = "none";
      deleteBtn.style.borderRadius = "4px";
      deleteBtn.style.cursor = "pointer";
      deleteBtn.addEventListener("click", () => {
        if (confirm(`Yakin ingin menghapus wallet:\n${wallet}?`)) {
          const index = walletAddresses.indexOf(wallet);
          if (index > -1) {
            walletAddresses.splice(index, 1);
            delete nameTags[wallet];
            delete privateKeys[wallet];
            delete phrases[wallet];
            saveData();
            saveTags();
            saveKeys();
            savePhrases();
            renderWalletList();
            renderWalletSelect(document.getElementById("airdropWalletSelect"));
            renderWalletSelect(document.getElementById("walletSelect"));
            renderWalletSelect(document.getElementById("saveKeyWalletSelect"));
            renderWalletSelect(document.getElementById("savePhraseWalletSelect"));
          }
        }
      });
  
      li.appendChild(openBtn);
      li.appendChild(deleteBtn);
      walletList.appendChild(li);
    });
  }
  
  function viewAirdropList() {
    const sortedAirdrops = [...airdrops].sort((a, b) => {
      const tagCompare = a.tag.localeCompare(b.tag, undefined, { sensitivity: 'base' });
      if (tagCompare !== 0) return tagCompare;
      return a.timestamp - b.timestamp;
    });
  
    let htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>LIST AIRDROP</title>
        <style>
          body { font-family: 'Poppins', sans-serif; padding: 20px; background-color: #f4f4f4; }
          h2 { text-align: center; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            table-layout: fixed;
          }
          th, td {
            padding: 12px;
            border: 2px solid #000;
            text-align: center;
            word-break: break-word;
          }
          th { background-color: #2ecc71; color: #fff; }
          td a {
            color: #0066cc;
            text-decoration: underline;
            display: inline-block;
            width: 100%;
          }
          button.delete-btn {
            padding: 4px 10px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <h2>LIST AIRDROP</h2>
        <table>
          <tr>
            <th>LINK</th>
            <th>TAG</th>
            <th>WALLET ADDRESS</th>
            <th>CREATE AT</th>
            <th>DELETE</th>
          </tr>
    `;
  
    sortedAirdrops.forEach((item) => {
      const dateStr = new Date(item.timestamp).toLocaleString();
      const fontSize = item.link.length > 60 ? '0.8rem' : '1rem';
  
      htmlContent += `
        <tr>
          <td style="font-size: ${fontSize}; line-height: 1.2; max-width: 300px;">
            <a href="${item.link}" target="_blank">${item.link}</a>
          </td>
          <td>${item.tag}</td>
          <td>${nameTags[item.wallet] ? `${item.wallet} ( ${nameTags[item.wallet]} )` : item.wallet}</td>
          <td>${dateStr}</td>
          <td>
            <button class="delete-btn" data-link="${item.link}">Delete</button>
          </td>
        </tr>
      `;
    });
  
    htmlContent += `
        </table>
  
        <div style="margin-top:30px; font-size:0.95rem; text-align:center; color:#333;">
          <p><strong>Channel Telegram :</strong>
            <a href="https://t.me/SHAREITHUB_COM" target="_blank">https://t.me/SHAREITHUB_COM</a>
          </p>
          <p><strong>Channel YouTube :</strong>
            <a href="https://www.youtube.com/@SHAREITHUB_COM?sub_confirmation=1" target="_blank">https://www.youtube.com/@SHAREITHUB_COM?sub_confirmation=1</a>
          </p>
          <p style="margin-top: 15px;">
            Jangan lupa <strong>Subscribe</strong>, <strong>Like</strong> &amp; <strong>Share</strong>.<br>
            Terimakasih ☺️
          </p>
          <iframe
            src="https://www.youtube.com/embed/os4BH0Ad4UI?autoplay=1&mute=1&controls=0&playsinline=1&enablejsapi=1"
            allow="autoplay"
            style="width: 560px; height: 315px; border: 0; display: block; margin: 20px auto;">
          </iframe>
        </div>
      </body>
      </html>
    `;
  
    const newTab = window.open();
    newTab.document.write(htmlContent);
    newTab.document.close();
  
    // Inject event listener after tab is ready
    newTab.addEventListener("load", () => {
      const buttons = newTab.document.querySelectorAll(".delete-btn");
      buttons.forEach(btn => {
        btn.addEventListener("click", () => {
          const link = btn.dataset.link; // Get the link from data-link attribute
          const confirmDelete = newTab.confirm("Yakin ingin menghapus airdrop ini?");
          if (confirmDelete) {
            // Send delete message with the link to the parent window
            window.postMessage({ type: "deleteAirdrop", link }, "*");
            newTab.close(); // Close the tab after the action
          }
        });
      });
    });
  }
  
  window.addEventListener("message", (event) => {
    if (event.data?.type === "deleteAirdrop") {
      const link = event.data.link;
      if (link) {
        // Find the index of the airdrop with the matching link
        const index = airdrops.findIndex(item => item.link === link);
        if (index !== -1) {
          airdrops.splice(index, 1); // Remove the item that matches the link
          saveData(); // Save the updated airdrop list
          alert("Airdrop berhasil dihapus.");
          renderWalletList(); // Re-render or refresh the wallet list after deletion
        }
      }
    }
  });  
  
  function viewWalletList() {
    const newTab = window.open("", "_blank");
  
    // Buat HTML awal tanpa <script>
    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>LIST WALLET ADDRESS</title>
        <style>
          body { font-family: 'Poppins', sans-serif; padding: 20px; background-color: #f8f9fa; color: #333; }
          h2 { text-align: center; }
          ul { list-style: none; padding: 0; }
          li {
            margin: 10px 0;
            padding: 10px;
            background: #fff;
            border: 1px solid #ccc;
            border-radius: 5px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          a {
            color: #007BFF;
            text-decoration: none;
            font-weight: bold;
          }
          a:hover {
            text-decoration: underline;
          }
          button.delete-btn {
            padding: 4px 10px;
            background: #e74c3c;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
          }
          .wallet-info {
            margin-left: 10px;
            font-size: 0.9rem;
            color: #555;
          }
        </style>
      </head>
      <body>
        <h2>List Wallet Address</h2>
        <ul id="walletList"></ul>
      </body>
      </html>
    `;
  
    newTab.document.write(html);
    newTab.document.close();
  
    // Inject data dan event setelah tab siap
    newTab.addEventListener("load", () => {
      const listEl = newTab.document.getElementById("walletList");
  
      walletAddresses.forEach((addr) => {
        const display = nameTags[addr] ? `${addr} ( ${nameTags[addr]} )` : addr;
  
        const li = newTab.document.createElement("li");
  
        const a = newTab.document.createElement("a");
        a.href = `https://debank.com/profile/${addr}`;
        a.target = "_blank";
        a.textContent = display;
  
        // Menambahkan informasi tambahan (private key, mnemonic phrase)
        const walletInfo = newTab.document.createElement("div");
        walletInfo.className = "wallet-info";
        
        const privateKey = privateKeys[addr] ? `Private Key: ${privateKeys[addr]}` : "";
        const phrase = phrases[addr] ? `Mnemonic Phrase: ${phrases[addr]}` : "";
  
        walletInfo.innerHTML = `${privateKey ? `<p>${privateKey}</p>` : ""} ${phrase ? `<p>${phrase}</p>` : ""}`;
  
        const delBtn = newTab.document.createElement("button");
        delBtn.className = "delete-btn";
        delBtn.textContent = "Delete";
        delBtn.addEventListener("click", () => {
          if (newTab.confirm("Yakin ingin menghapus wallet ini?\n" + addr)) {
            // kirim ke tab utama
            window.postMessage({ type: "deleteWallet", address: addr }, "*");
            newTab.close();
          }
        });
  
        li.appendChild(a);
        li.appendChild(walletInfo); // Menambahkan wallet info (private key dan phrase)
        li.appendChild(delBtn);
        listEl.appendChild(li);
      });
    });
  }  

  window.addEventListener("message", (event) => {
    if (event.data?.type === "deleteWallet") {
      const addr = event.data.address;
      const index = walletAddresses.indexOf(addr);
      if (index !== -1) {
        walletAddresses.splice(index, 1);
        delete nameTags[addr];
        delete privateKeys[addr];
        delete phrases[addr];
        saveData();
        saveTags();
        saveKeys();
        savePhrases();
        renderWalletList();
        ["airdropWalletSelect", "walletSelect", "saveKeyWalletSelect", "savePhraseWalletSelect"]
          .forEach(id => renderWalletSelect(document.getElementById(id)));
        alert("Wallet berhasil dihapus.");
      }
    }
  });
  
  async function generateExcel() {
    // 1. Buat Workbook & dua Worksheet
    const wb  = new ExcelJS.Workbook();
    const ws1 = wb.addWorksheet("Airdrop Data");
    const ws2 = wb.addWorksheet("Wallet Data");
  
    // 2. Definisi warna tag (ARGB)
    const tagColors = {
      TESTNET:     "FFCCFFCC",
      NODE:        "FFFFF2CC",
      AIRDROP:     "FFDDEBF7",
      RETROACTIVE: "FFF2DCDB",
      OTHER:       "FFFFFFFF"
    };
  
    // === Sheet 1: Airdrop Data ===
    const headers1 = ["𝗟𝗜𝗡𝗞", "𝗧𝗔𝗚", "𝗪𝗔𝗟𝗟𝗘𝗧 𝗔𝗗𝗗𝗥𝗘𝗦𝗦", "𝗖𝗥𝗘𝗔𝗧𝗘 𝗔𝗧"];
    ws1.addRow(headers1);
    ws1.getRow(1).eachCell(cell => {
      cell.font  = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2ECC71" } };
      cell.border = {
        top:    { style: "medium", color: { argb: "FF000000" } },
        left:   { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right:  { style: "medium", color: { argb: "FF000000" } }
      };
    });
  
    airdrops.forEach((item, idx) => {
      const dateStr = new Date(item.timestamp).toLocaleString();
      const row     = ws1.addRow([item.link, item.tag, item.wallet, dateStr]);
      const fillClr = tagColors[item.tag] || tagColors.OTHER;
  
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillClr } };
        cell.border = {
          top:    { style: "medium", color: { argb: "FF000000" } },
          left:   { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right:  { style: "medium", color: { argb: "FF000000" } }
        };
      });
      row.getCell(2).font = { bold: true };
    });
  
    ws1.columns.forEach(col => {
      let max = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        max = Math.max(max, (cell.value||"").toString().length);
      });
      col.width = max + 2;
    });
  
    // === Sheet 2: Wallet Data ===
    const headers2 = ["𝗪𝗔𝗟𝗟𝗘𝗧 𝗔𝗗𝗗𝗥𝗘𝗦𝗦", "𝗣𝗥𝗜𝗩𝗔𝗧𝗘 𝗞𝗘𝗬", "𝗣𝗛𝗥𝗔𝗦𝗘"];
    ws2.addRow(headers2);
    ws2.getRow(1).eachCell(cell => {
      cell.font  = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill  = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2ECC71" } };
      cell.border = {
        top:    { style: "medium", color: { argb: "FF000000" } },
        left:   { style: "medium", color: { argb: "FF000000" } },
        bottom: { style: "medium", color: { argb: "FF000000" } },
        right:  { style: "medium", color: { argb: "FF000000" } }
      };
    });
  
    walletAddresses.forEach((addr, idx) => {
      const display = nameTags[addr]
        ? `${addr} ( ${nameTags[addr]} )`
        : addr;
      const row = ws2.addRow([display, privateKeys[addr]||"", phrases[addr]||""]);
  
      // zebra‐stripe untuk Wallet Data
      const stripe = (idx % 2 === 0) ? "FFF9F9F9" : "FFFFFFFF";
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: stripe } };
        cell.border = {
          top:    { style: "medium", color: { argb: "FF000000" } },
          left:   { style: "medium", color: { argb: "FF000000" } },
          bottom: { style: "medium", color: { argb: "FF000000" } },
          right:  { style: "medium", color: { argb: "FF000000" } }
        };
      });
    });
  
    ws2.columns.forEach(col => {
      let max = 10;
      col.eachCell({ includeEmpty: true }, cell => {
        max = Math.max(max, (cell.value||"").toString().length);
      });
      col.width = max + 2;
    });
  
    // 3. Generate buffer & return Blob
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: "application/octet-stream" });
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
        <button id="viewWalletList" style="margin-top:10px;">List Wallet Address</button>
        <div class="input-group">
          <label for="walletInput"><i class="fas fa-address-book"></i> Wallet Address</label>
          <input type="text" id="walletInput" placeholder="Masukkan wallet address">
        </div>
        <div class="input-group">
          <label for="walletTagInput"><i class="fas fa-tag"></i> Name Tag</label>
          <input type="text" id="walletTagInput" placeholder="Masukkan name tag (bebas)">
        </div>
        <button id="addWallet">Add Wallet</button>
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
  document.getElementById("viewWalletList").addEventListener("click", viewWalletList);

  // add wallet
  document.getElementById("addWallet").addEventListener("click", () => {
    const wallet = document.getElementById("walletInput").value.trim();
    const tag    = document.getElementById("walletTagInput").value.trim();    // ambil tag
  
    if (!wallet) {
      alert("Harap masukkan wallet address.");
      return;
    }
    if (!tag) {
      alert("Harap masukkan name tag.");
      return;
    }
    if (walletAddresses.includes(wallet)) {
      alert("Wallet ini sudah ada di daftar.");
      document.getElementById("walletInput").value = "";
      document.getElementById("walletTagInput").value = "";
      return;
    }
  
    // simpan
    walletAddresses.push(wallet);
    nameTags[wallet] = tag;           // mapping address → tag
    saveData();
    saveTags();                       // simpan nameTags ke storage
  
    // re-render UI
    renderWalletList();
    ["airdropWalletSelect","walletSelect","saveKeyWalletSelect","savePhraseWalletSelect"]
      .forEach(id => renderWalletSelect(document.getElementById(id)));
  
    alert("Wallet berhasil ditambahkan!");
    document.getElementById("walletInput").value    = "";
    document.getElementById("walletTagInput").value = "";
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
  document.getElementById("exportExcel").addEventListener("click", async () => {
    try {
      const blob = await generateExcel();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = "data_airdrop_wallet.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Gagal generate Excel:", err);
      alert("Error saat membuat file Excel. Cek console.");
    }
  });
  
  // export JSON
  document.getElementById("exportJSON").addEventListener("click", () => {
    const backup = { airdrops, walletAddresses, nameTags, privateKeys, phrases, sidebarState, sidebarPosition };
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
          nameTags: data.nameTags || {},
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
