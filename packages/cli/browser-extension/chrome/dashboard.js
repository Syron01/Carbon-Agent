function refresh() {
  chrome.runtime.sendMessage({ type: "get_status" }, (response) => {
    if (!response) return;

    const grid = document.getElementById("nodes-grid");
    const activeNodesEl = document.getElementById("active-nodes");
    const totalClientsEl = document.getElementById("total-clients");

    const activeConns = response.connections.filter(c => c.status === "connected");
    activeNodesEl.textContent = activeConns.length;
    totalClientsEl.textContent = response.totalClients || 0;

    grid.innerHTML = "";

    response.connections.forEach(conn => {
      const isActive = conn.status === "connected";
      const card = document.createElement("div");
      card.className = `node-card ${isActive ? 'active' : ''}`;

      const info = conn.info || {};
      const version = info.version || "---";
      const capabilities = info.capabilities || [];

      let capHtml = "";
      if (isActive && capabilities.length > 0) {
        capHtml = `
          <div class="capabilities">
            ${capabilities.slice(0, 10).map(cap => `<span class="cap-tag">${cap}</span>`).join('')}
          </div>
        `;
      }

      const statusText = isActive ? "ACTIVE" : (conn.status === "connecting" ? "CONNECTING" : "SCANNING");
      const statusColor = isActive ? "var(--success)" : (conn.status === "connecting" ? "var(--accent)" : "var(--muted)");

      const terminateBtnHtml = isActive
        ? `<button class="terminate-btn" data-port="${conn.port}">Terminate Session</button>`
        : '';

      card.innerHTML = `
        <div class="card-top">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${isActive ? 'var(--success)' : 'var(--muted)'}" stroke-width="2.5">
            <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
            <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
            <line x1="6" y1="6" x2="6.01" y2="6"></line>
            <line x1="6" y1="18" x2="6.01" y2="18"></line>
          </svg>
          <span class="port-label">:${conn.port}</span>
        </div>
        <div class="node-details">
          <div class="detail-row">
            <span class="detail-key">Status</span>
            <span class="detail-val" style="color: ${statusColor}">${statusText}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">Version</span>
            <span class="detail-val">${version}</span>
          </div>
          <div class="detail-row">
            <span class="detail-key">Type</span>
            <span class="detail-val">BRIDGE_NODE</span>
          </div>
        </div>
        ${capHtml}
        ${terminateBtnHtml}
      `;
      grid.appendChild(card);
    });
  });
}

document.getElementById("refresh-btn").addEventListener("click", () => {
  const icon = document.getElementById("sync-icon");
  icon.classList.add("spinning");
  chrome.runtime.sendMessage({ type: "reconnect_all" });
  setTimeout(() => {
    icon.classList.remove("spinning");
    refresh();
  }, 800);
});

document.getElementById("nodes-grid").addEventListener("click", (e) => {
  if (e.target.classList.contains("terminate-btn")) {
    const port = Number(e.target.getAttribute("data-port"));
    if (confirm(`Are you sure you want to terminate the Astro-Agent session on port :${port}?`)) {
      chrome.runtime.sendMessage({ type: "close_port", port });
      setTimeout(refresh, 250);
    }
  }
});

setInterval(refresh, 1500);
refresh();