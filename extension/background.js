// ── NEXUS Browser Extension — Background Service Worker ──
//
// Handles keyboard shortcuts (Ctrl+Shift+S), context menus,
// and communication with the NEXUS API.
//
// The user must configure their NEXUS server URL and API key
// in the extension settings (storage).

const DEFAULT_SERVER_URL = "http://localhost:3000";
const STORAGE_KEYS = {
  serverUrl: "nexus_server_url",
  apiKey: "nexus_api_key",
};

// ── Initialize ──

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu for saving pages and links
  chrome.contextMenus.create({
    id: "save-page",
    title: "Save this page to NEXUS",
    contexts: ["page", "link"],
  });

  chrome.contextMenus.create({
    id: "save-link",
    title: "Save this link to NEXUS",
    contexts: ["link"],
  });

  chrome.contextMenus.create({
    id: "save-selection",
    title: "Save selection to NEXUS",
    contexts: ["selection"],
  });

  console.log("[NEXUS Extension] Installed. Right-click any page or link to save.");
});

// ── Context Menu Handler ──

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  try {
    if (info.menuItemId === "save-page") {
      await saveToNexus({
        type: "link",
        title: tab?.title || "Untitled",
        content: info.linkUrl || tab?.url || "",
        metadata: {
          sourceUrl: info.linkUrl || tab?.url || "",
        },
      });
    } else if (info.menuItemId === "save-link") {
      await saveToNexus({
        type: "link",
        title: info.linkText || info.linkUrl || "Untitled Link",
        content: info.linkUrl || "",
        metadata: {
          sourceUrl: info.linkUrl || "",
        },
      });
    } else if (info.menuItemId === "save-selection") {
      await saveToNexus({
        type: "note",
        title: `Selection from ${tab?.title || "page"}`,
        content: info.selectionText || "",
        metadata: {
          sourceUrl: tab?.url || "",
        },
      });
    }
  } catch (err) {
    showNotification("Failed to save to NEXUS", String(err));
  }
});

// ── Keyboard Shortcut Handler ──

chrome.commands.onCommand.addListener(async (command) => {
  if (command === "save-to-nexus") {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !tab.url) return;

    try {
      // Inject content script to extract page content
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const meta = document.querySelector('meta[name="description"]');
          const content = document.body?.innerText?.slice(0, 5000) || "";
          return {
            title: document.title,
            description: meta?.getAttribute("content") || "",
            content: content,
          };
        },
      });

      await saveToNexus({
        type: "link",
        title: result?.result?.title || tab.title || "Untitled",
        content: result?.result?.content || tab.url,
        metadata: {
          sourceUrl: tab.url,
          description: result?.result?.description || "",
        },
      });
    } catch (err) {
      // Fallback: save just the URL if content script fails
      await saveToNexus({
        type: "link",
        title: tab.title || "Untitled",
        content: tab.url,
        metadata: { sourceUrl: tab.url },
      });
    }
  }
});

// ── API Call ──

async function saveToNexus(data) {
  const { serverUrl, apiKey } = await chrome.storage.sync.get([
    STORAGE_KEYS.serverUrl,
    STORAGE_KEYS.apiKey,
  ]);

  const baseUrl = serverUrl || DEFAULT_SERVER_URL;

  const headers = {
    "Content-Type": "application/json",
  };

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

  const result = await res.json();
  showNotification("Saved to NEXUS", `"${data.title}" has been saved.`);
  return result;
}

// ── Notification ──

function showNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message,
    priority: 2,
  });
}
