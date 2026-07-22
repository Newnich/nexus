// ── NEXUS Browser Extension — Popup Script ──
//
// Handles the popup UI: auto-fills page info, saves to NEXUS API,
// and manages settings (server URL, API key).

const STORAGE_KEYS = {
  serverUrl: "nexus_server_url",
  apiKey: "nexus_api_key",
};

// ── DOM refs ──

const titleInput = document.getElementById("title");
const urlInput = document.getElementById("url");
const typeSelect = document.getElementById("type");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const settingsToggle = document.getElementById("settingsToggle");
const settingsPanel = document.getElementById("settingsPanel");
const serverUrlInput = document.getElementById("serverUrl");
const apiKeyInput = document.getElementById("apiKey");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");

// ── Load settings ──

async function loadSettings() {
  const { serverUrl, apiKey } = await chrome.storage.sync.get([
    STORAGE_KEYS.serverUrl,
    STORAGE_KEYS.apiKey,
  ]);
  serverUrlInput.value = serverUrl || "http://localhost:3000";
  apiKeyInput.value = apiKey || "";
}

// ── Get page info from content script ──

async function getPageInfo() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return {};

    const response = await chrome.tabs.sendMessage(tab.id, { action: "getPageInfo" });
    return response || {};
  } catch {
    // Content script might not be loaded — use tab info as fallback
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return {
      title: tab?.title || "",
      url: tab?.url || "",
      textContent: "",
      selection: "",
    };
  }
}

// ── Auto-fill form with page info ──

async function autoFill() {
  try {
    const info = await getPageInfo();
    titleInput.value = info.selection
      ? `"${info.selection.slice(0, 50)}" — ${info.title}`
      : info.title || "";
    urlInput.value = info.selection || info.url || "";
  } catch {
    // Leave inputs empty if we can't get page info
  }
}

// ── Show status message ──

function showStatus(message, type = "success") {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  setTimeout(() => {
    statusEl.className = "status";
  }, 4000);
}

// ── Set loading state ──

function setLoading(loading) {
  saveBtn.disabled = loading;
  saveBtn.innerHTML = loading
    ? '<span class="spinner"></span> Saving...'
    : "<span>⟠</span> Save to NEXUS";
}

// ── Save to NEXUS API ──

async function saveToNexus(data) {
  const { serverUrl, apiKey } = await chrome.storage.sync.get([
    STORAGE_KEYS.serverUrl,
    STORAGE_KEYS.apiKey,
  ]);

  const baseUrl = serverUrl || "http://localhost:3000";
  const headers = { "Content-Type": "application/json" };

  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${baseUrl}/api/items/webhook`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// ── Event Handlers ──

saveBtn.addEventListener("click", async () => {
  const title = titleInput.value.trim();
  const content = urlInput.value.trim();
  const type = typeSelect.value;

  if (!title) {
    showStatus("Please enter a title", "error");
    return;
  }

  setLoading(true);

  try {
    await saveToNexus({
      type,
      title,
      content,
      metadata: {
        sourceUrl: content.startsWith("http") ? content : undefined,
      },
    });
    showStatus("✅ Saved to NEXUS!");
    titleInput.value = "";
    urlInput.value = "";
  } catch (err) {
    showStatus(`❌ ${err.message}`, "error");
  } finally {
    setLoading(false);
  }
});

// Enter key to submit
titleInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") saveBtn.click();
});

// Settings toggle
settingsToggle.addEventListener("click", () => {
  settingsPanel.classList.toggle("visible");
});

// Save settings
saveSettingsBtn.addEventListener("click", async () => {
  await chrome.storage.sync.set({
    [STORAGE_KEYS.serverUrl]: serverUrlInput.value.trim(),
    [STORAGE_KEYS.apiKey]: apiKeyInput.value.trim(),
  });
  showStatus("Settings saved");
  settingsPanel.classList.remove("visible");
});

// ── Initialize ──

loadSettings();
autoFill();
