const BASE_PORT = 3133;
const MAX_PORT_OFFSET = 9; // Scan 3133 to 3142
const VERSION = "2026-11-browser";
const HEARTBEAT_INTERVAL_MS = 20000;
const RECONNECT_DELAY_MS = 2000;
const COMMAND_TIMEOUT_MS = 12000;
const MAX_TABS_RETURNED = 100;
const ALARM_NAME = "Astro-Agent-bridge-reconnect";

/** @type {Map<number, { socket: WebSocket, info?: any }>} */
let connections = new Map();
/** @type {Set<number>} */
let connectingPorts = new Set();
const debuggerAttachedTabs = new Set();
let heartbeatTimer = null;

// ── Init ──────────────────────────────────────────────────────────────────────
chrome.runtime.onStartup.addListener(startDiscovery);
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
  
  // Cleanup old context menus first to avoid errors on reload
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "Astro-Agent-ingest",
      title: "Send to Astro-Agent Knowledge Base",
      contexts: ["page", "selection"]
    }, () => {
       if (chrome.runtime.lastError) console.log("ContextMenu error:", chrome.runtime.lastError.message);
    });
  });

  startDiscovery();
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: "dashboard.html" });
  startDiscovery();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "get_status") {
    const conns = [];
    let totalClients = 0;
    for (let i = 0; i <= MAX_PORT_OFFSET; i++) {
      const port = BASE_PORT + i;
      const conn = connections.get(port);
      if (conn?.info) totalClients++;
      conns.push({
        port,
        status: (conn?.socket?.readyState === WebSocket.OPEN && conn?.info) ? "connected" : (connectingPorts.has(port) ? "connecting" : "scanning"),
        info: conn?.info
      });
    }
    sendResponse({ connections: conns, totalClients });
    return true;
  }
  if (message.type === "reconnect_all") {
    startDiscovery();
    sendResponse({ ok: true });
  }
  if (message.type === "close_all_sessions") {
    broadcast({ type: "close_session" });
    sendResponse({ ok: true });
  }
  if (message.type === "close_port") {
    const port = Number(message.port);
    const conn = connections.get(port);
    if (conn && conn.socket && conn.socket.readyState === WebSocket.OPEN) {
      try {
        conn.socket.send(JSON.stringify({ type: "close_session" }));
      } catch (e) {
        // ignore
      }
    }
    sendResponse({ ok: true });
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "Astro-Agent-ingest" && tab?.id) {
    executePage({ action: "read_dom", tabId: tab.id, maxChars: 20000 }).then(result => {
      broadcast({
        type: "knowledge_ingest",
        url: result?.url || tab.url,
        title: result?.title || tab.title,
        content: result?.content || ""
      });
      injectOverlay(tab.id, "Sent to Astro-Agent Knowledge Base ✓");
    }).catch(err => {
      console.error("Failed to ingest knowledge:", err);
    });
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) startDiscovery();
});

// ── Discovery & Connection ──────────────────────────────────────────────────
function startDiscovery() {
  for (let i = 0; i <= MAX_PORT_OFFSET; i++) {
    connectToPort(BASE_PORT + i);
  }
  startHeartbeat();
}

// Retry timers per port
const retryTimers = new Map();

function scheduleRetry(port) {
  if (retryTimers.has(port)) return;
  const t = setTimeout(() => {
    retryTimers.delete(port);
    connectToPort(port);
  }, RECONNECT_DELAY_MS);
  retryTimers.set(port, t);
}

function connectToPort(port) {
  if (connections.has(port) || connectingPorts.has(port)) return;
  if (retryTimers.has(port)) return;

  connectingPorts.add(port);
  updateBadge();

  let socket;
  try {
    socket = new WebSocket('ws://127.0.0.1:' + port + '/ws');
  } catch (e) {
    connectingPorts.delete(port);
    scheduleRetry(port);
    return;
  }

  let opened = false;
  let finished = false;

  const cleanup = () => {
    if (finished) return;
    finished = true;
    connections.delete(port);
    connectingPorts.delete(port);
    updateBadge();
    scheduleRetry(port);
  };

  socket.onopen = () => {
    opened = true;
    connectingPorts.delete(port);
    connections.set(port, { socket, info: null });
    updateBadge();
    console.log('[Astro] Connected ' + port);
    sendToSocket(socket, {
      type: 'hello',
      extensionId: chrome.runtime.id || 'N/A',
      version: VERSION,
      capabilities: ['tabs','page','debugger','scroll','smart_scroll','mouse','canvas_info','canvas_draw',
        'console_logs','screenshot','read_dom','hover','drag','upload_file','press_key','get_elements','evaluate','clear_ui']
    });
  };

  socket.onclose = () => {
    if (opened) console.log('[Astro] Disconnected ' + port);
    connections.delete(port);
    updateBadge();
    cleanup();
  };

  socket.onerror = () => {
    if (!opened) {
      connectingPorts.delete(port);
      connections.delete(port);
      finished = true;
      updateBadge();
      scheduleRetry(port);
    }
  };}

function broadcast(message) {
  for (const conn of connections.values()) {
    sendToSocket(conn.socket, message);
  }
}

function sendToSocket(socket, message) {
  if (socket?.readyState === WebSocket.OPEN) {
    try { socket.send(JSON.stringify(message)); } catch { /* ignore */ }
  }
}

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const activeCount = Array.from(connections.values()).filter(c => c.info).length;
    if (activeCount === 0) {
        // Try to rediscover if everything is dead
        startDiscovery();
    }
    broadcast({ type: "ping", time: Date.now() });
  }, HEARTBEAT_INTERVAL_MS);
}

function updateBadge() {
  const activeCount = Array.from(connections.values()).filter(c => c.info).length;
  const isConnecting = connectingPorts.size > 0;

  if (activeCount > 0) {
    chrome.action.setBadgeText({ text: String(activeCount) });
    chrome.action.setBadgeBackgroundColor({ color: "#22c55e" });
    chrome.action.setBadgeTextColor({ color: "#ffffff" });
    chrome.action.setTitle({ title: `Astro-Agent: ${activeCount} session(s) active` });
  } else {
    chrome.action.setBadgeText({ text: isConnecting ? "..." : "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: isConnecting ? "#38bdf8" : "#ef4444" });
    chrome.action.setTitle({ title: isConnecting ? "Astro-Agent: Scanning ports..." : "Astro-Agent: Offline" });
  }
}

// Ensure discovery starts immediately
startDiscovery();

// ── Command dispatcher ────────────────────────────────────────────────────────
async function executeCommand(action, args) {
  if (action === "tabs") return executeTabs(args);
  if (action === "page") return executePage(args);
  throw new Error(`Unknown browser action: ${action}`);
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
async function executeTabs(args) {
  const action = args.action;

  if (action === "list") {
    const tabs = await chrome.tabs.query({});
    return tabs.slice(0, MAX_TABS_RETURNED).map(tabSummary);
  }
  if (action === "active") {
    return tabSummary(await getActiveTab());
  }
  if (action === "open") {
    if (!args.url) throw new Error("open requires url");
    const smartUrl = resolveSmartUrl(args.url);
    const tab = await createTabResilient(smartUrl, args.active !== false);
    return tabSummary(tab);
  }
  if (action === "close") {
    const tabId = requireTabId(args);
    await chrome.tabs.remove(tabId);
    return { closed: tabId };
  }
  if (action === "focus") {
    const tabId = requireTabId(args);
    const tab = await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
    if (tab.windowId !== undefined) await chrome.windows.update(tab.windowId, { focused: true });
    return tabSummary(await chrome.tabs.get(tabId));
  }
  if (action === "reload") {
    const tabId = args.tabId === undefined ? (await getActiveTab()).id : requireTabId(args);
    await chrome.tabs.reload(tabId);
    return { reloaded: tabId };
  }
  if (action === "navigate") {
    const tabId = args.tabId === undefined ? (await getActiveTab()).id : requireTabId(args);
    if (!args.url) throw new Error("navigate requires url");
    const smartUrl = resolveSmartUrl(args.url);
    await chrome.tabs.update(tabId, { url: smartUrl, active: args.active !== false });
    await waitForTabReady(tabId);
    try { await injectOverlay(tabId, "Astro-Agent Synchronized"); } catch { /* internal/CSP pages are still navigated */ }
    return tabSummary(await chrome.tabs.get(tabId));
  }
  throw new Error(`Unknown tabs action: ${action}`);
}

// ── Page ──────────────────────────────────────────────────────────────────────
async function executePage(args) {
  const action = args.action;
  const tab = args.tabId === undefined
    ? await getActiveTab()
    : await chrome.tabs.get(Number(args.tabId));
  const tabId = tab.id;
  if (tabId === undefined) throw new Error("No target tab id");
  if (action !== "screenshot") assertScriptableTab(tab);

  // Only script actions need the document to be ready. Avoid blocking lightweight actions.
  if (!["wait", "mouse", "screenshot", "console_logs"].includes(action)) await waitForTabReady(tabId, 1200);

  if (action === "scroll") {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (direction, amount) => {
        const val = Math.max(1, Math.min(Number(amount) || 500, 5000));
        const before = { x: window.scrollX, y: window.scrollY };

        const isScrollable = (el) => {
          if (!el || el === document.body || el === document.documentElement) return false;
          const st = getComputedStyle(el);
          const canY = /(auto|scroll|overlay)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 2;
          const canX = /(auto|scroll|overlay)/.test(st.overflowX) && el.scrollWidth > el.clientWidth + 2;
          return canY || canX;
        };
        const center = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        let target = center;
        while (target && !isScrollable(target)) target = target.parentElement;

        const scrollTarget = target || window;
        if (direction === "up") scrollTarget.scrollBy?.(0, -val);
        else if (direction === "down") scrollTarget.scrollBy?.(0, val);
        else if (direction === "left") scrollTarget.scrollBy?.(-val, 0);
        else if (direction === "right") scrollTarget.scrollBy?.(val, 0);
        else if (direction === "top") target ? (target.scrollTop = 0) : window.scrollTo(window.scrollX, 0);
        else if (direction === "bottom") target ? (target.scrollTop = target.scrollHeight) : window.scrollTo(window.scrollX, document.documentElement.scrollHeight || document.body.scrollHeight);
        else throw new Error(`Unknown scroll direction: ${direction}`);

        return {
          scrolled: true,
          direction,
          target: target ? cssPath(target) : "window",
          before,
          after: target ? { x: target.scrollLeft, y: target.scrollTop } : { x: window.scrollX, y: window.scrollY }
        };

        function cssPath(el) {
          if (!el || !el.tagName) return "window";
          if (el.id) return `#${CSS.escape(el.id)}`;
          const cls = String(el.className || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(c => `.${CSS.escape(c)}`).join("");
          return `${el.tagName.toLowerCase()}${cls}`;
        }
      },
      args: [args.direction || "down", args.amount || 500]
    });
    return result?.result;
  }

  if (action === "console_logs") {
    return getConsoleLogs(tabId);
  }

  if (action === "screenshot") {
    return captureScreenshot(tab, args);
  }

  if (action === "read_dom") {
    const maxChars = Math.max(300, Math.min(Number.isFinite(Number(args.maxChars)) ? Number(args.maxChars) : 3500, 9000));
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (limit) => {
        const isInteractive = (el) => {
          const tag = el.tagName.toLowerCase();
          const role = el.getAttribute("role") || "";
          return ["a", "button", "input", "select", "textarea"].includes(tag)
            || el.hasAttribute("onclick")
            || ["button", "link", "checkbox", "menuitem", "tab", "radio"].includes(role);
        };

        const isVisible = (el) => {
          if (el.checkVisibility) return el.checkVisibility();
          return el.offsetWidth > 0 && el.offsetHeight > 0;
        };

        let visited = 0;
        const walk = (node, depth = 0) => {
          if (++visited > 900 || depth > 10) return "";
          if (node.nodeType === 3) {
            const text = node.textContent.trim();
            return text.length > 2 ? text : "";
          }
          if (node.nodeType !== 1) return "";

          const tag = node.tagName.toLowerCase();
          if (["script", "style", "noscript", "svg", "path", "head", "meta", "link"].includes(tag)) return "";
          if (!isVisible(node)) return "";

          // Fast path: if no interactive elements in entire subtree, return textContent directly
          const hasInteractive = isInteractive(node) || (() => {
            try {
              return !!node.querySelector('a, button, input, select, textarea, [role="button"], [role="link"], [role="checkbox"], [role="tab"], [onclick]');
            } catch {
              return true;
            }
          })();

          if (!hasInteractive) {
            const txt = node.textContent.replace(/\s+/g, " ").trim();
            return txt.length > 2 ? txt : "";
          }

          const children = Array.from(node.childNodes).slice(0, 80)
            .map(c => walk(c, depth + 1))
            .filter(Boolean)
            .join(" ");

          if (isInteractive(node)) {
            const label = node.getAttribute("aria-label") || node.title || node.placeholder || children || node.textContent.trim() || "";
            const href = node.getAttribute("href") || "";
            return `\n[${tag.toUpperCase()}${href ? " href=" + href : ""}: ${label.slice(0, 80)}]\n`;
          }
          if (["h1","h2","h3","h4"].includes(tag)) return `\n## ${children}\n`;
          if (tag === "p" && children.length > 10) return `\n${children}\n`;
          return children;
        };

        return {
          url: location.href,
          title: document.title,
          content: walk(document.body)
            .replace(/\s{3,}/g, " ")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, limit)
        };
      },
      args: [maxChars]
    });
    return result?.result;
  }

  if (action === "read") {
    const maxChars = Math.max(300, Math.min(Number.isFinite(Number(args.maxChars)) ? Number(args.maxChars) : 3000, 9000));
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (limit) => {
        const selection = String(window.getSelection?.() || "").trim();
        const visibleText = [];
        const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
          acceptNode(node) {
            const value = node.nodeValue?.replace(/\s+/g, " ").trim();
            if (!value || value.length < 2) return NodeFilter.FILTER_REJECT;
            const parent = node.parentElement;
            if (!parent || ["SCRIPT", "STYLE", "NOSCRIPT", "SVG"].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
            const style = getComputedStyle(parent);
            if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        });
        let total = 0;
        while (walker.nextNode() && total < limit + 400) {
          const value = walker.currentNode.nodeValue.replace(/\s+/g, " ").trim();
          visibleText.push(value);
          total += value.length + 1;
        }
        const text = visibleText.join("\n");
        return {
          title: document.title,
          url: location.href,
          selection,
          text: text.slice(0, limit),
          truncated: text.length > limit
        };
      },
      args: [maxChars]
    });
    return result?.result;
  }

  if (action === "get_elements") {
    const maxElements = Math.max(1, Math.min(Number.isFinite(Number(args.maxElements)) ? Number(args.maxElements) : 40, 80));
    const showLabels = args.showLabels === true;
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (maxElements, showLabels) => {
        document.querySelectorAll(".astro-label").forEach(el => el.remove());
        if (window.__moon_labels_cleanup) clearTimeout(window.__moon_labels_cleanup);

        const selectors = [
          'a', 'button', 'input', 'select', 'textarea', 
          '[role="button"]', '[role="link"]', '[role="checkbox"]', '[role="tab"]',
          '[onclick]', '[tabindex]:not([tabindex="-1"])',
          '.btn', '.button', 'summary'
        ].join(',');
        
        const getAllInteractive = (root) => {
          let els = Array.from(root.querySelectorAll(selectors));
          const all = root.querySelectorAll('*');
          for (const el of all) {
            if (el.shadowRoot) {
              els = els.concat(getAllInteractive(el.shadowRoot));
            }
          }
          return els;
        };

        const interactive = getAllInteractive(document);
        let idCounter = 1;
        const map = [];
        const fragment = document.createDocumentFragment();

        for (const el of interactive) {
          const rect = el.getBoundingClientRect();
          const style = window.getComputedStyle(el);

          // Visibility: include partially visible controls so edge UI is not missed.
          const inViewport = rect.width > 4 && rect.height > 4
            && rect.bottom >= 0 && rect.right >= 0
            && rect.top <= window.innerHeight
            && rect.left <= window.innerWidth;

          if (!inViewport) continue;
          if (style.display === "none" || style.visibility === "hidden") continue;
          if (parseFloat(style.opacity) < 0.1) continue;
          if (style.pointerEvents === "none") continue;

          const id = idCounter++;
          el.setAttribute("data-astro-id", String(id));

          if (showLabels) {
            const label = document.createElement("div");
            label.className = "astro-label";
            label.textContent = String(id);
            label.style.cssText = [
              "position:fixed",
              `top:${Math.max(0, Math.min(rect.top, window.innerHeight - 18))}px`,
              `left:${Math.max(0, Math.min(rect.left, window.innerWidth - 28))}px`,
              "transform:translate(-50%,-50%)",
              "background:rgba(14, 165, 233, 0.95)",
              "color:#ffffff",
              "font-size:11px",
              "font-weight:600",
              "letter-spacing:0.5px",
              "padding:2px 6px",
              "border-radius:4px",
              "z-index:2147483647",
              "pointer-events:none",
              "border:1px solid rgba(255,255,255,0.3)",
              "box-shadow:0 2px 8px rgba(0,0,0,0.25)",
              "line-height:1",
              "font-family:'Inter', system-ui, -apple-system, sans-serif"
            ].join(";");
            fragment.appendChild(label);
          }

          map.push({
            id,
            tag: el.tagName.toLowerCase(),
            text: (el.textContent?.trim() || el.value || "").replace(/\s+/g, " ").slice(0, 60),
            placeholder: el.placeholder || undefined,
            type: el.type || undefined,
            ariaLabel: el.getAttribute("aria-label") || undefined,
            title: el.title || undefined,
            disabled: !!el.disabled || el.getAttribute("aria-disabled") === "true",
            rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) }
          });

          if (map.length >= maxElements) break;
        }
        
        if (showLabels) {
          (document.body || document.documentElement).appendChild(fragment);
          window.__moon_labels_cleanup = setTimeout(() => {
            document.querySelectorAll(".astro-label").forEach(el => el.remove());
          }, 10000);
        }
        return map;
      },
      args: [maxElements, showLabels]
    });
    return result?.result;
  }

  if (action === "click") {
    if (!args.selector) throw new Error("click requires selector");
    const selector = await resolveSelector(tabId, args.selector);
    if (args.visual === true) await injectOverlay(tabId, `Clicking ${selector}`);
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (selector, visual) => {
        // Try direct querySelector, then shadow DOM walk
        function findEl(root, sel) {
          try {
            const direct = root.querySelector(sel);
            if (direct) return direct;
          } catch { /* invalid selector */ }
          // Search shadow roots
          const all = root.querySelectorAll('*');
          for (const el of all) {
            if (el.shadowRoot) {
              const found = findEl(el.shadowRoot, sel);
              if (found) return found;
            }
          }
          return null;
        }
        const el = findEl(document, selector);
        if (!el) return { clicked: false, reason: `selector not found: ${selector}` };
        el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
        await new Promise(r => setTimeout(r, 30));
        const rect = el.getBoundingClientRect();
        if (visual && window.__moon_move_cursor) await window.__moon_move_cursor(rect.left + rect.width / 2, rect.top + rect.height / 2, 'hand');
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        if (visual) {
          if (window.__moon_highlight_element) window.__moon_highlight_element(selector);
          if (window.__moon_click_animation) window.__moon_click_animation(cx, cy);
        }
        // Full mouse sequence
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
        }
        if (typeof el.click === 'function') el.click();
        else el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy }));
        // Also dispatch focus/blur for React/Vue controlled components
        el.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
        return { clicked: true, selector, tag: el.tagName.toLowerCase(), text: (el.textContent?.trim() || '').slice(0, 120) };
      },
      args: [selector, args.visual === true]
    });
    // If JS click failed, fall back to CDP Input.dispatchMouseEvent
    if (!result?.result?.clicked) {
      try {
        const tab = await chrome.tabs.get(tabId);
        const didAttach = await attachDebugger(tabId);
        try {
          // Get element center via CDP
          await chrome.debugger.sendCommand({ tabId }, 'DOM.enable', {});
          const { root } = await chrome.debugger.sendCommand({ tabId }, 'DOM.getDocument', { depth: -1 });
          let nodeId;
          try {
            const found = await chrome.debugger.sendCommand({ tabId }, 'DOM.querySelector', { nodeId: root.nodeId, selector });
            nodeId = found?.nodeId;
          } catch { /* skip */ }
          if (nodeId) {
            const box = await chrome.debugger.sendCommand({ tabId }, 'DOM.getBoxModel', { nodeId });
            if (box?.model?.content) {
              const [x1, y1, x2, , , , x4, y4] = box.model.content;
              const cx = (x1 + x2) / 2;
              const cy = (y1 + y4) / 2;
              for (const type of ['mousePressed', 'mouseReleased']) {
                await chrome.debugger.sendCommand({ tabId }, 'Input.dispatchMouseEvent', {
                  type, x: cx, y: cy, button: 'left', clickCount: 1
                });
              }
              return { clicked: true, selector, method: 'cdp' };
            }
          }
        } finally {
          if (didAttach) await detachDebugger(tabId);
        }
      } catch (cdpErr) {
        return { clicked: false, reason: `JS+CDP both failed: ${cdpErr?.message || cdpErr}` };
      }
    }
    return result?.result;
  }

  if (action === "hover") {
    if (!args.selector) throw new Error("hover requires selector");
    const selector = await resolveSelector(tabId, args.selector);
    if (args.visual === true) await injectOverlay(tabId, `Hovering ${selector}`);
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (selector, visual) => {
        const el = document.querySelector(selector);
        if (!el) return { hovered: false, reason: "selector not found" };
        el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        await new Promise(r => setTimeout(r, 20));
        const rect = el.getBoundingClientRect();
        if (visual) {
          if (window.__moon_highlight_element) window.__moon_highlight_element(selector);
        }
        if (visual && window.__moon_move_cursor) await window.__moon_move_cursor(rect.left + rect.width / 2, rect.top + rect.height / 2, "arrow");
        for (const type of ["pointerover", "pointerenter", "mouseover", "mouseenter"]) {
          el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
        }
        return { hovered: true, selector };
      },
      args: [selector, args.visual === true]
    });
    return result?.result;
  }

  if (action === "type") {
    if (!args.selector) throw new Error("type requires selector");
    const selector = await resolveSelector(tabId, args.selector);
    if (args.visual === true) {
      await injectOverlay(tabId, `Typing into ${selector}`);
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (sel) => {
          if (window.__moon_highlight_element) window.__moon_highlight_element(sel);
        },
        args: [selector]
      });
    }

    // 1. Move virtual cursor and focus target element first
    const [focusResult] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (selector, visual) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        await new Promise(r => setTimeout(r, 20));
        const rect = el.getBoundingClientRect();
        if (visual && window.__moon_move_cursor) {
          await window.__moon_move_cursor(rect.left + rect.width / 2, rect.top + rect.height / 2, "type");
        }
        el.focus?.();
        return true;
      },
      args: [selector, args.visual === true]
    });

    if (!focusResult?.result) {
      return { typed: false, reason: `Element not found or not focusable: ${selector}` };
    }

    // 2. Emulated hardware typing via CDP for React/Vue/Angular compatibility
    const didAttach = await attachDebugger(tabId);
    try {
      if (!args.append) {
        // Select-all and delete existing content
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "keyDown", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65
        });
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "keyUp", modifiers: 2, key: "a", code: "KeyA", windowsVirtualKeyCode: 65
        });
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "keyDown", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8
        });
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
          type: "keyUp", key: "Backspace", code: "Backspace", windowsVirtualKeyCode: 8
        });
      }
      
      // Hardware-emulate typing using CDP insertText
      await chrome.debugger.sendCommand({ tabId }, "Input.insertText", { text: args.text ?? "" });
    } finally {
      if (didAttach) await detachDebugger(tabId);
    }

    // Dispatch input/change events to be absolutely sure triggers fire
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const el = document.querySelector(selector);
        if (el) {
          el.dispatchEvent(new InputEvent("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        }
      },
      args: [selector]
    });

    return { typed: true, selector, length: (args.text ?? "").length, method: "cdp" };
  }

  if (action === "drag") {
    if (!args.selector || !args.targetSelector) throw new Error("drag requires selector and targetSelector");
    const selector = await resolveSelector(tabId, args.selector);
    const targetSelector = await resolveSelector(tabId, args.targetSelector);
    if (args.visual === true) await injectOverlay(tabId, `Dragging ${selector}`);
    
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (selector, targetSelector, visual) => {
        const source = document.querySelector(selector);
        const target = document.querySelector(targetSelector);
        if (!source) return { ready: false, reason: "source not found" };
        if (!target) return { ready: false, reason: "target not found" };
        
        source.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        await new Promise(r => setTimeout(r, 20));
        target.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        await new Promise(r => setTimeout(r, 20));
        
        const s = source.getBoundingClientRect();
        const t = target.getBoundingClientRect();
        
        if (visual && window.__moon_move_cursor) {
          await window.__moon_move_cursor(s.left + s.width / 2, s.top + s.height / 2, "hand");
          await window.__moon_move_cursor(t.left + t.width / 2, t.top + t.height / 2, "hand");
        }
        
        return {
          ready: true,
          source: { x: s.left + s.width / 2, y: s.top + s.height / 2 },
          target: { x: t.left + t.width / 2, y: t.top + t.height / 2 }
        };
      },
      args: [selector, targetSelector, args.visual === true]
    });
    
    const coords = result?.result;
    if (!coords?.ready) {
      return { dragged: false, reason: coords?.reason || "failed to resolve coordinates" };
    }
    
    return dispatchMouse(tabId, {
      x: coords.source.x,
      y: coords.source.y,
      toX: coords.target.x,
      toY: coords.target.y,
      button: "left",
      steps: 30,
      ms: 600
    }).then(res => ({ dragged: true, selector, targetSelector, method: "cdp", ...res }));
  }

  if (action === "mouse") {
    return dispatchMouse(tabId, args);
  }

  if (action === "canvas_info") {
    return getCanvasInfo(tabId);
  }

  if (action === "canvas_draw") {
    return drawOnCanvas(tabId, args);
  }

  if (action === "upload_file") {
    if (!args.selector) throw new Error("upload_file requires selector");
    const selector = await resolveSelector(tabId, args.selector);
    const files = Array.isArray(args.filePaths) ? args.filePaths.map(String) : args.filePath ? [String(args.filePath)] : [];
    if (files.length === 0) throw new Error("upload_file requires filePath or filePaths");
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const el = document.querySelector(selector);
        if (!el) return { ready: false, reason: "selector not found" };
        if (el.tagName !== "INPUT" || el.type !== "file") return { ready: false, reason: "selector is not input[type=file]" };
        el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
        return { ready: true, multiple: !!el.multiple };
      },
      args: [selector]
    });
    if (!result?.result?.ready) return { uploaded: false, selector, reason: result?.result?.reason || "input not ready" };
    const didAttach = await attachDebugger(tabId);
    try {
      await chrome.debugger.sendCommand({ tabId }, "DOM.enable", {});
      const doc = await chrome.debugger.sendCommand({ tabId }, "DOM.getDocument", { depth: -1, pierce: true });
      const found = await chrome.debugger.sendCommand({ tabId }, "DOM.querySelector", { nodeId: doc.root.nodeId, selector });
      if (!found.nodeId) throw new Error("file input not found by debugger");
      await chrome.debugger.sendCommand({ tabId }, "DOM.setFileInputFiles", { nodeId: found.nodeId, files });
    } finally {
      if (didAttach) await detachDebugger(tabId);
    }
    const [after] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (selector) => {
        const el = document.querySelector(selector);
        if (!el) return { changed: false };
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { changed: true, files: el.files?.length || 0 };
      },
      args: [selector]
    });
    return { uploaded: true, selector, files: files.length, page: after?.result };
  }

  if (action === "clear_ui") {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        document.querySelectorAll(".astro-label,#Astro-Agent-overlay,#astro-visual-cursor,#Astro-Agent-banner,#Astro-Agent-bar,#Astro-Agent-style").forEach(el => el.remove());
        if (window.__Astro-Agent_hide) clearTimeout(window.__Astro-Agent_hide);
        if (window.__moon_labels_cleanup) clearTimeout(window.__moon_labels_cleanup);
        return { cleared: true };
      }
    });
    return result?.result;
  }

  if (action === "press_key") {
    if (!args.key) throw new Error("press_key requires key");
    await dispatchKey(tabId, args.key, args.modifiers || []);
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (key, modifiers) => {
        const target = document.activeElement || document.body;
        const opts = {
          key,
          bubbles: true,
          cancelable: true,
          ctrlKey:  modifiers.includes("ctrl"),
          shiftKey: modifiers.includes("shift"),
          altKey:   modifiers.includes("alt"),
          metaKey:  modifiers.includes("meta")
        };
        target.dispatchEvent(new KeyboardEvent("keydown",  opts));
        target.dispatchEvent(new KeyboardEvent("keypress", opts));
        target.dispatchEvent(new KeyboardEvent("keyup",    opts));

        // Handle Enter on forms and submit buttons
        if (key === "Enter" && target.tagName === "INPUT") {
          const form = target.closest("form");
          if (form) {
            const submit = form.querySelector('[type="submit"]');
            if (submit) submit.click();
            else form.submit?.();
          }
        }
        return { pressed: key };
      },
      args: [args.key, args.modifiers || []]
    });
    return result?.result;
  }

  if (action === "evaluate") {
    if (!args.script) throw new Error("evaluate requires script");
    return evaluateInPage(tabId, String(args.script));
  }

  if (action === "wait") {
    const ms = Math.min(Number(args.ms) || 1000, 15000);
    const selector = args.selector;
    const text = args.text;
    const timeoutMs = Math.max(100, Math.min(Number(args.timeoutMs || args.timeout) || 10000, 15000));

    if (selector) {
      const start = Date.now();
      const resolvedSel = await resolveSelector(tabId, selector);
      while (Date.now() - start < timeoutMs) {
        const [found] = await chrome.scripting.executeScript({
          target: { tabId },
          func: (sel) => !!document.querySelector(sel),
          args: [resolvedSel]
        });
        if (found?.result) return { waited: Date.now() - start, found: resolvedSel };
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error(`Timeout waiting for selector: ${selector}`);
    }

    if (text) {
      const start = Date.now();
      const lowerText = String(text).toLowerCase();
      while (Date.now() - start < timeoutMs) {
        const [found] = await chrome.scripting.executeScript({
          target: { tabId },
          func: (txt) => {
            const bodyText = (document.body || document.documentElement).textContent || "";
            return bodyText.toLowerCase().includes(txt);
          },
          args: [lowerText]
        });
        if (found?.result) return { waited: Date.now() - start, foundText: text };
        await new Promise(r => setTimeout(r, 200));
      }
      throw new Error(`Timeout waiting for text: ${text}`);
    }

    await new Promise(r => setTimeout(r, ms));
    return { waited: ms };
  }

  if (action === "youtube_data") {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const title = document.querySelector('h1.ytd-video-primary-info-renderer')?.textContent?.trim() || document.title;
        const channel = document.querySelector('#channel-name a')?.textContent?.trim();
        const views = document.querySelector('tp-yt-paper-tooltip #tooltip')?.textContent?.trim();
        const description = document.querySelector('#description-inner')?.textContent?.trim() || "";
        return { title, channel, views, description, url: location.href };
      }
    });
    return result?.result;
  }

  throw new Error(`Unknown page action: ${action}`);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
async function captureScreenshot(tab, args = {}) {
  const tabId = tab?.id;
  if (tabId === undefined) throw new Error("screenshot requires a tab id");
  const format = args.format === "jpeg" ? "jpeg" : "png";
  const quality = Math.max(1, Math.min(Number(args.quality) || 85, 100));

  if (!tab.active) {
    try {
      await Promise.race([
        chrome.tabs.update(tabId, { active: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Tab update timeout")), 1500))
      ]);
    } catch (e) {
      // ignore or log
    }
  }
  
  let windowId = tab.windowId;
  if (windowId === undefined) {
    try {
      const currentWin = await chrome.windows.getCurrent();
      windowId = currentWin?.id;
    } catch {
      // ignore
    }
  }
  
  if (windowId !== undefined) {
    try {
      await Promise.race([
        chrome.windows.update(windowId, { focused: true }),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Window update timeout")), 1500))
      ]);
    } catch {
      // ignore
    }
  }
  await new Promise(r => setTimeout(r, 100));

  const captureOptions = format === "jpeg" ? { format, quality } : { format };
  let dataUrl = "";
  
  const captureWithTimeout = async () => {
    return Promise.race([
      (async () => {
        try {
          return await chrome.tabs.captureVisibleTab(windowId, captureOptions);
        } catch (err) {
          return await chrome.tabs.captureVisibleTab(captureOptions);
        }
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("captureVisibleTab call timed out")), 5000))
    ]);
  };

  try {
    dataUrl = await captureWithTimeout();
  } catch (innerErr) {
    try {
      dataUrl = await captureScreenshotWithDebugger(tabId, format, quality);
    } catch (debuggerErr) {
      throw new Error(`Screenshot capture failed: ${innerErr.message || String(innerErr)}; debugger fallback failed: ${debuggerErr.message || String(debuggerErr)}. Make sure the browser window is active and not on an internal chrome:// page.`);
    }
  }
  
  const match = /^data:([^;]+);base64,(.*)$/.exec(dataUrl || "");
  if (!match) throw new Error("captureVisibleTab returned invalid image data");

  let page = {};
  try {
    const [dims] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => ({
        viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio || 1 },
        scroll: { x: window.scrollX, y: window.scrollY },
        title: document.title,
        url: location.href
      })
    });
    page = dims?.result || {};
  } catch {
    page = { title: tab.title, url: tab.url };
  }

  return {
    title: page.title || tab.title || "",
    url: page.url || tab.url || "",
    viewport: page.viewport,
    scroll: page.scroll,
    screenshot: {
      mimeType: match[1],
      data: match[2],
      format,
      capturedAt: new Date().toISOString()
    }
  };
}

async function captureScreenshotWithDebugger(tabId, format, quality) {
  const target = { tabId };
  let attached = false;
  try {
    await chrome.debugger.attach(target, "1.3");
    attached = true;
    const result = await chrome.debugger.sendCommand(target, "Page.captureScreenshot", {
      format: format === "jpeg" ? "jpeg" : "png",
      quality: format === "jpeg" ? quality : undefined,
      fromSurface: true
    });
    if (!result?.data) throw new Error("Page.captureScreenshot returned no data");
    return `data:image/${format};base64,${result.data}`;
  } finally {
    if (attached) {
      try { await chrome.debugger.detach(target); } catch { /* already detached */ }
    }
  }
}

async function getCanvasInfo(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => Array.from(document.querySelectorAll("canvas"))
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        return {
          index: i,
          selector: el.id ? `#${CSS.escape(el.id)}` : `canvas:nth-of-type(${i + 1})`,
          x: Math.round(r.left), y: Math.round(r.top),
          width: Math.round(r.width), height: Math.round(r.height),
          bitmapWidth: el.width, bitmapHeight: el.height,
          visible: r.width > 1 && r.height > 1 && r.bottom >= 0 && r.right >= 0 && r.top <= innerHeight && r.left <= innerWidth
        };
      })
      .filter(c => c.visible)
      .sort((a, b) => (b.width * b.height) - (a.width * a.height))
      .slice(0, 8)
  });
  return { canvases: result?.result || [] };
}

async function drawOnCanvas(tabId, args) {
  const rawPoints = Array.isArray(args.points) ? args.points.slice(0, 240) : [];
  if (rawPoints.length < 2) throw new Error("canvas_draw requires at least two points");
  const [info] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (selector) => {
      const el = selector ? document.querySelector(selector) : Array.from(document.querySelectorAll("canvas"))
        .sort((a, b) => (b.getBoundingClientRect().width * b.getBoundingClientRect().height) - (a.getBoundingClientRect().width * a.getBoundingClientRect().height))[0];
      if (!el) return null;
      el.scrollIntoView({ behavior: "instant", block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    args: [args.selector || ""]
  });
  const rect = info?.result;
  if (!rect) throw new Error("canvas not found");
  const absolute = args.absolute === true;
  const points = rawPoints.map(p => ({
    x: Math.max(-10000, Math.min(Number(p?.[0]) || 0, 10000)) + (absolute ? 0 : rect.x),
    y: Math.max(-10000, Math.min(Number(p?.[1]) || 0, 10000)) + (absolute ? 0 : rect.y)
  }));

  const button = args.button || "left";
  const steps = Math.max(1, Math.min(Number(args.steps) || 2, 10));
  const delayMs = Math.max(0, Math.min(Number(args.ms) || 5, 500));
  const wait = (ms) => new Promise(r => setTimeout(r, ms));

  const didAttach = await attachDebugger(tabId);

  // Press down at the first point
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mousePressed", x: points[0].x, y: points[0].y, button, clickCount: 1
  });
  if (delayMs) await wait(delayMs);

  // Drag through intermediate points
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    for (let s = 1; s <= steps; s++) {
      const nx = prev.x + ((curr.x - prev.x) * s) / steps;
      const ny = prev.y + ((curr.y - prev.y) * s) / steps;
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseMoved", x: nx, y: ny, button
      });
      if (delayMs) await wait(Math.max(1, delayMs / steps));
    }
  }

  // Release at the last point
  const lastPoint = points[points.length - 1];
  await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
    type: "mouseReleased", x: lastPoint.x, y: lastPoint.y, button, clickCount: 1
  });

  return { drawn: true, points: points.length, canvas: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) } };
}

async function dispatchMouse(tabId, args) {
  const x = Number(args.x);
  const y = Number(args.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error("mouse requires finite x and y");
  const toX = args.toX === undefined ? undefined : Number(args.toX);
  const toY = args.toY === undefined ? undefined : Number(args.toY);
  const button = ["left", "right", "middle", "none"].includes(args.button) ? args.button : "left";
  const clickCount = Math.max(1, Math.min(Number(args.clickCount) || 1, 3));
  const steps = Math.max(1, Math.min(Number(args.steps) || 16, 120));
  const duration = Math.max(0, Math.min(Number(args.ms) || 0, 15000));
  const hasTarget = Number.isFinite(toX) && Number.isFinite(toY);
  const didAttach = await attachDebugger(tabId);
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  try {
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseMoved", x, y, button: "none"
    });
    if (hasTarget) {
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mousePressed", x, y, button, clickCount
      });
      for (let i = 1; i <= steps; i++) {
        const nx = x + ((toX - x) * i) / steps;
        const ny = y + ((toY - y) * i) / steps;
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
          type: "mouseMoved", x: nx, y: ny, button
        });
        if (duration) await wait(duration / steps);
      }
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
        type: "mouseReleased", x: toX, y: toY, button, clickCount
      });
      return { mouse: "drag", from: { x, y }, to: { x: toX, y: toY }, button, steps };
    }
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mousePressed", x, y, button, clickCount
    });
    if (duration) await wait(duration);
    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", {
      type: "mouseReleased", x, y, button, clickCount
    });
    return { mouse: "click", x, y, button, clickCount };
  } finally {
    if (didAttach) await detachDebugger(tabId);
  }
}

async function dispatchKey(tabId, key, modifiers = []) {
  const didAttach = await attachDebugger(tabId);
  const modifierBit = (modifiers.includes("alt") ? 1 : 0)
    | (modifiers.includes("ctrl") ? 2 : 0)
    | (modifiers.includes("meta") ? 4 : 0)
    | (modifiers.includes("shift") ? 8 : 0);
  try {
    for (const type of ["keyDown", "keyUp"]) {
      await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", {
        type,
        key: String(key),
        text: String(key).length === 1 ? String(key) : undefined,
        modifiers: modifierBit
      });
    }
  } finally {
    if (didAttach) await detachDebugger(tabId);
  }
}

async function resolveSelector(tabId, selector) {
  // Numeric moon id (#123)
  if (/^#\d+$/.test(selector)) {
    const id = selector.slice(1);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (id) => {
        const el = document.querySelector(`[data-astro-id="${id}"]`);
        return el ? `[data-astro-id="${id}"]` : null;
      },
      args: [id]
    });
    if (res?.result) return res.result;
  }

  // Try the selector as-is first
  const [check] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (sel) => {
      try { return !!document.querySelector(sel); }
      catch { return false; }
    },
    args: [selector]
  });
  if (check?.result) return selector;

  // Fuzzy fallback: match by visible text, aria-label, placeholder, title, value
  const [found] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (hint) => {
      const lower = hint.toLowerCase();
      const candidates = Array.from(
        document.querySelectorAll('a,button,input,select,textarea,[role="button"],[role="link"],[role="tab"],[role="menuitem"],[onclick],[tabindex]')
      );
      const score = (el) => {
        const text = [
          el.textContent, el.value, el.placeholder,
          el.getAttribute('aria-label'), el.title,
          el.getAttribute('data-label'), el.getAttribute('alt')
        ].filter(Boolean).join(' ').toLowerCase();
        if (text === lower) return 3;
        if (text.startsWith(lower)) return 2;
        if (text.includes(lower)) return 1;
        return 0;
      };
      const style = (el) => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0.1
          && r.width > 2 && r.height > 2 && r.bottom >= 0 && r.top <= window.innerHeight;
      };
      const best = candidates
        .map(el => ({ el, s: score(el) }))
        .filter(x => x.s > 0 && style(x.el))
        .sort((a, b) => b.s - a.s)[0];
      if (!best) return null;
      const el = best.el;
      // build a specific selector
      if (el.id) return `#${CSS.escape(el.id)}`;
      const moonId = el.getAttribute('data-astro-id');
      if (moonId) return `[data-astro-id="${moonId}"]`;
      // nth-child path
      const path = [];
      let cur = el;
      while (cur && cur !== document.body && path.length < 5) {
        const tag = cur.tagName.toLowerCase();
        const parent = cur.parentElement;
        if (!parent) break;
        const siblings = Array.from(parent.children).filter(c => c.tagName === cur.tagName);
        const idx = siblings.indexOf(cur) + 1;
        path.unshift(siblings.length > 1 ? `${tag}:nth-of-type(${idx})` : tag);
        cur = parent;
      }
      return path.length ? path.join(' > ') : null;
    },
    args: [selector]
  });
  if (found?.result) return found.result;

  // Return original — let the click fail with a clear message
  return selector;
}

async function waitForTabReady(tabId, timeoutMs = 5000) {
  // Try rapid check first to see if page is already loaded and interactive
  try {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.readyState !== "loading" && !!document.body
    });
    if (res?.result) return;
  } catch {
    // Ignore and fallback
  }

  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (tab.status === "complete") return;
    } catch { return; }
    await new Promise(r => setTimeout(r, 50));
  }
}

async function evaluateInPage(tabId, expression) {
  const didAttach = await attachDebugger(tabId);
  try {
    const payload = await chrome.debugger.sendCommand({ tabId }, "Runtime.evaluate", {
      expression: String(expression),
      awaitPromise: true,
      returnByValue: true,
      userGesture: true
    });
    if (payload?.exceptionDetails) {
      const text = payload.exceptionDetails.text || payload.exceptionDetails.exception?.description || "Evaluation error";
      throw new Error(text);
    }
    return makeSerializable(payload?.result?.value);
  } finally {
    if (didAttach) await detachDebugger(tabId);
  }
}

async function getConsoleLogs(tabId) {
  const [result] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      if (!window.__moon_console_hooked) {
        window.__moon_console_hooked = true;
        window.__moon_logs = window.__moon_logs || [];
        for (const level of ["log", "info", "warn", "error", "debug"]) {
          const original = console[level]?.bind(console);
          if (!original) continue;
          console[level] = (...items) => {
            try {
              window.__moon_logs.push({ level, time: new Date().toISOString(), text: items.map(String).join(" ").slice(0, 1000) });
              window.__moon_logs = window.__moon_logs.slice(-100);
            } catch { /* ignore */ }
            original(...items);
          };
        }
      }
      return { logs: (window.__moon_logs || []).slice(-100), count: (window.__moon_logs || []).length };
    }
  });
  return result?.result || { logs: [], count: 0 };
}

function makeSerializable(value) {
  if (value === undefined) return null;
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return value;
  try { return JSON.parse(JSON.stringify(value)); } catch { return String(value); }
}

function assertScriptableTab(tab) {
  const url = tab?.url || "";
  if (!url) return;
  if (/^(chrome|edge|brave|opera|vivaldi|about|devtools):/i.test(url)) {
    throw new Error(`This browser page cannot be automated by extensions: ${url}`);
  }
  if (/^chrome-extension:/i.test(url) && !url.startsWith(chrome.runtime.getURL(""))) {
    throw new Error("Cannot automate another extension page");
  }
}

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

async function attachDebugger(tabId) {
  if (debuggerAttachedTabs.has(tabId)) return false;
  await chrome.debugger.attach({ tabId }, "1.3");
  debuggerAttachedTabs.add(tabId);
  return true;
}

async function detachDebugger(tabId) {
  try { await chrome.debugger.detach({ tabId }); } catch { /* already detached */ }
  debuggerAttachedTabs.delete(tabId);
}

async function createTabResilient(url, active = true) {
  try {
    const tab = await chrome.tabs.create({ url, active });
    if (tab?.id) return tab;
  } catch {
    // Fall through to new-window fallback for sessions with no normal browser window.
  }

  const win = await chrome.windows.create({ url, focused: active });
  const tab = win?.tabs?.find(t => t?.id !== undefined);
  if (!tab?.id) throw new Error(`Failed to open tab for ${url}`);
  return tab;
}

async function getActiveTab() {
  const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (focused?.id) return focused;
  const activeTabs = await chrome.tabs.query({ active: true });
  const active = activeTabs.find(tab => tab.id !== undefined);
  if (active?.id) return active;
  const tabs = await chrome.tabs.query({});
  const fallback = tabs.find(tab => tab.id !== undefined);
  if (fallback?.id) return fallback;
  throw new Error("No Chrome tab found");
}

function requireTabId(args) {
  if (args.tabId === undefined) throw new Error("tabId is required");
  const id = Number(args.tabId);
  if (!Number.isFinite(id)) throw new Error("tabId must be a number");
  return id;
}

function tabSummary(tab) {
  if (!tab) return undefined;
  return {
    id: tab.id,
    windowId: tab.windowId,
    active: tab.active,
    pinned: tab.pinned,
    title: tab.title,
    url: tab.url,
    status: tab.status
  };
}

function resolveSmartUrl(url) {
  const trimmed = String(url).trim();
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed;

  const localUrl = /^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:[0-9]+)?(\/.*)?$/i.test(trimmed);
  if (localUrl) return `http://${trimmed}`;

  // Check if it's a domain/URL structure (e.g. "google.com")
  const isUrl = /^[a-zA-Z0-9][-a-zA-Z0-9]{0,62}(\.[a-zA-Z0-9][-a-zA-Z0-9]{0,62})+(:[0-9]+)?(\/.*)?$/.test(trimmed);
  if (isUrl) return `https://${trimmed}`;

  // Otherwise, treat as Google search query
  return `https://www.google.com/search?q=${encodeURIComponent(trimmed)}`;
}

// Overlay is injected once and reused; message updates in-place
const overlayInjectedTabs = new Set();

async function injectOverlay(tabId, message = "Astro-Agent Active Control") {
  const arrowUrl = chrome.runtime.getURL("cursors/arrow.cur");
  const handUrl  = chrome.runtime.getURL("cursors/hand.cur");
  const typeUrl  = chrome.runtime.getURL("cursors/ibeam.cur");

  await chrome.scripting.executeScript({
    target: { tabId },
    func: (msg, arrowUrl, handUrl, typeUrl) => {
      const OVERLAY_ID = "Astro-Agent-overlay";
      const CURSOR_ID  = "astro-visual-cursor";
      const BANNER_ID  = "Astro-Agent-banner";
      const FRAME_ID   = "Astro-Agent-neon-frame";

      // ── Premium Glassmorphism Banner ──────────────────────────────────────
      let banner = document.getElementById(BANNER_ID);
      if (!banner) {
        banner = document.createElement("div");
        banner.id = BANNER_ID;
        banner.style.cssText = `
          position: fixed;
          top: 24px;
          left: 50%;
          transform: translateX(-50%) translateY(-20px);
          background: rgba(15, 23, 42, 0.75);
          color: #f8fafc;
          padding: 10px 20px;
          border-radius: 999px;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.3px;
          z-index: 2147483647;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.05) inset;
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          display: flex;
          align-items: center;
          gap: 12px;
          pointer-events: none;
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        const pulse = document.createElement("div");
        pulse.style.cssText = "width:8px;height:8px;background:#38bdf8;border-radius:50%;box-shadow:0 0 10px #38bdf8;animation:astro-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;";
        banner.appendChild(pulse);

        const txt = document.createElement("span");
        txt.id = "Astro-Agent-txt";
        banner.appendChild(txt);

        if (!document.getElementById("astro-style")) {
          const s = document.createElement("style");
          s.id = "astro-style";
          s.textContent = "@keyframes astro-pulse{0%,100%{opacity:1}50%{opacity:.4}}";
          document.head.appendChild(s);
        }

        (document.body || document.documentElement).appendChild(banner);
        
        // Trigger entrance animation
        requestAnimationFrame(() => {
          banner.style.transform = "translateX(-50%) translateY(0)";
          banner.style.opacity = "1";
        });
      }

      document.getElementById("Astro-Agent-txt").textContent = msg;

      // Clear auto-hide if exists
      if (window._moon_hide_timer) clearTimeout(window._moon_hide_timer);
      window._moon_hide_timer = setTimeout(() => {
         const b = document.getElementById(BANNER_ID);
         if (b) {
           b.style.transform = "translateX(-50%) translateY(-20px)";
           b.style.opacity = "0";
           setTimeout(() => b.remove(), 400);
         }
      }, 5000);

      // ── Cursor ────────────────────────────────────────────────────────────
      let cursor = document.getElementById(CURSOR_ID);
      if (!cursor) {
        cursor = document.createElement("img");
        cursor.id = CURSOR_ID;
        cursor.src = arrowUrl;
        cursor.style.cssText = [
          "position:fixed",
          `top:${window.innerHeight / 2}px`,
          `left:${window.innerWidth / 2}px`,
          "width:28px",
          "height:28px",
          "pointer-events:none",
          "z-index:2147483647",
          "transition:top 0.35s cubic-bezier(.4,0,.2,1),left 0.35s cubic-bezier(.4,0,.2,1)",
          "will-change:top,left"
        ].join(";");
        (document.body || document.documentElement).appendChild(cursor);
      }

      window.__moon_move_cursor = (x, y, type = "arrow") => new Promise((resolve) => {
        const cur = document.getElementById(CURSOR_ID);
        if (!cur) { resolve(); return; }
        cur.src = type === "hand" ? handUrl : type === "type" ? typeUrl : arrowUrl;
        cur.style.top  = y + "px";
        cur.style.left = x + "px";
        setTimeout(resolve, 380);
      });

      window.__moon_click_animation = (x, y) => {
        const ripple = document.createElement("div");
        ripple.style.cssText = `
          position: fixed;
          top: ${y}px;
          left: ${x}px;
          width: 6px;
          height: 6px;
          background: #38bdf8;
          border-radius: 50%;
          z-index: 2147483647;
          pointer-events: none;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 12px #38bdf8, 0 0 24px #38bdf8;
          transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        `;
        (document.body || document.documentElement).appendChild(ripple);
        requestAnimationFrame(() => {
          ripple.style.width = "48px";
          ripple.style.height = "48px";
          ripple.style.opacity = "0";
        });
        setTimeout(() => ripple.remove(), 500);
      };

      window.__moon_highlight_element = (selector) => {
        const el = document.querySelector(selector);
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const glow = document.createElement("div");
        glow.className = "astro-element-glow";
        glow.style.cssText = `
          position: fixed;
          top: ${rect.top - 4}px;
          left: ${rect.left - 4}px;
          width: ${rect.width + 8}px;
          height: ${rect.height + 8}px;
          border: 2px solid #0ea5e9;
          border-radius: 6px;
          box-shadow: 0 0 15px rgba(14, 165, 233, 0.5);
          z-index: 2147483646;
          pointer-events: none;
          opacity: 0;
          transition: all 0.3s ease;
        `;
        (document.body || document.documentElement).appendChild(glow);
        requestAnimationFrame(() => glow.style.opacity = "1");
        setTimeout(() => {
          glow.style.opacity = "0";
          setTimeout(() => glow.remove(), 300);
        }, 1500);
      };
    },
    args: [message, arrowUrl, handUrl, typeUrl]
  });
}
