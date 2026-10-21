function updateUI() {
  chrome.runtime.sendMessage({ type: "get_status" }, (response) => {
    if (!response) return;

    const statusEl = document.getElementById("overall-status");
    const listEl = document.getElementById("port-list");

    const activePorts = response.connections.filter(c => c.status === "connected");

    statusEl.textContent = activePorts.length > 0 ? "Connected" : "Offline";
    statusEl.className = `status-badge ${activePorts.length > 0 ? "connected" : "offline"}`;

    listEl.innerHTML = "";
    response.connections.forEach(conn => {
      const item = document.createElement("div");
      item.className = "port-item";

      const isActive = conn.status === "connected";
      const statusText = isActive ? "Active" : "Scanning";
      const statusClass = isActive ? "active" : "scanning";

      const actionButton = isActive
        ? `<button class="btn-terminate-port" data-port="${conn.port}">Terminate</button>`
        : `<span class="port-status-tag ${statusClass}">${statusText}</span>`;

      item.innerHTML = `
        <div class="port-info">
          <span class="port-number">:${conn.port}</span>
        </div>
        ${actionButton}
      `;
      listEl.appendChild(item);
    });
  });
}

document.getElementById("reconnect-btn").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "reconnect_all" });
  setTimeout(updateUI, 250);
});

document.getElementById("dashboard-btn").addEventListener("click", () => {
  chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
});

document.getElementById("close-all-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to terminate all active Astro-Agent bridge sessions?")) {
    chrome.runtime.sendMessage({ type: "close_all_sessions" });
    setTimeout(updateUI, 250);
  }
});

document.getElementById("port-list").addEventListener("click", (e) => {
  if (e.target.classList.contains("btn-terminate-port")) {
    const port = Number(e.target.getAttribute("data-port"));
    if (confirm(`Are you sure you want to terminate session on port :${port}?`)) {
      chrome.runtime.sendMessage({ type: "close_port", port });
      setTimeout(updateUI, 250);
    }
  }
});

setInterval(updateUI, 1000);
updateUI();