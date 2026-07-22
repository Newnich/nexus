// ── NEXUS Browser Extension — Content Script ──
//
// Runs on every page to extract metadata and enable
// in-page save functionality. Communicates with the
// background service worker via chrome.runtime messages.

// ── Listen for save requests from popup or background ──

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageInfo") {
    sendResponse(extractPageInfo());
  }
  return true; // Keep message channel open for async response
});

// ── Page Info Extraction ──

function extractPageInfo() {
  const meta = {
    title: document.title,
    url: window.location.href,
    description: getMetaContent("description"),
    ogImage: getMetaContent("og:image"),
    ogTitle: getMetaContent("og:title"),
    ogDescription: getMetaContent("og:description"),
    favicon: getFavicon(),
    contentType: getContentType(),
    textContent: document.body?.innerText?.slice(0, 10000) || "",
    selection: window.getSelection()?.toString() || "",
  };

  return meta;
}

function getMetaContent(name) {
  const el =
    document.querySelector(`meta[name="${name}"]`) ||
    document.querySelector(`meta[property="${name}"]`);
  return el?.getAttribute("content") || "";
}

function getFavicon() {
  const link =
    document.querySelector('link[rel="icon"]') ||
    document.querySelector('link[rel="shortcut icon"]');
  if (link?.href) return link.href;

  // Fallback to default /favicon.ico
  return `${window.location.origin}/favicon.ico`;
}

function getContentType() {
  const contentType = document.querySelector('meta[property="article:published_time"]');
  if (contentType) return "link";

  const isVideo =
    document.querySelector("video") || document.querySelector('[data-testid="video"]');
  if (isVideo) return "video";

  return "link";
}

// ── Expose for popup ──

window.__NEXUS_PAGE_INFO = extractPageInfo;
