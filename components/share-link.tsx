"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";

interface ShareLinkData {
  id: string;
  itemId: string;
  token: string;
  createdAt: string;
  expiresAt?: string;
}

interface ShareLinkProps {
  itemId: string;
  itemTitle: string;
}

const STORAGE_KEY = "nexus:share-links";

function loadLinks(): ShareLinkData[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch { return []; }
}

function saveLinks(links: ShareLinkData[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

export function ShareLink({ itemId, itemTitle }: ShareLinkProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [links, setLinks] = useState<ShareLinkData[]>(() => loadLinks().filter((l) => l.itemId === itemId));
  const [expiryHours, setExpiryHours] = useState(0);

  const generateToken = useCallback(() => {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let token = "";
    for (let i = 0; i < 16; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }, []);

  const handleCreateLink = useCallback(() => {
    const token = generateToken();
    const link: ShareLinkData = {
      id: Date.now().toString(36),
      itemId,
      token,
      createdAt: new Date().toISOString(),
      ...(expiryHours > 0 ? { expiresAt: new Date(Date.now() + expiryHours * 3600000).toISOString() } : {}),
    };

    const allLinks = loadLinks();
    allLinks.push(link);
    saveLinks(allLinks);
    setLinks((prev) => [...prev, link]);

    const url = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  }, [itemId, expiryHours, generateToken]);

  const handleRevoke = useCallback((linkId: string) => {
    const allLinks = loadLinks().filter((l) => l.id !== linkId);
    saveLinks(allLinks);
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    toast.success("Link revoked");
  }, []);

  const isExpired = (link: ShareLinkData) => {
    return link.expiresAt && new Date(link.expiresAt) < new Date();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-2.5 rounded-xl border border-border hover:border-nexus-500/30 text-muted-foreground hover:text-nexus-400 transition-all"
        title="Share item"
      >
        🔗
      </button>

      {showMenu && (
        <div className="absolute right-0 top-full mt-1.5 w-72 glass-card rounded-xl overflow-hidden animate-fade-in-up z-50 border border-border/50" onClick={(e) => e.stopPropagation()}>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Share Link</h3>
              <button onClick={() => setShowMenu(false)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
            </div>

            <p className="text-xs text-muted-foreground">
              Generate a shareable link for &ldquo;{itemTitle.length > 30 ? itemTitle.slice(0, 30) + "…" : itemTitle}&rdquo;
            </p>

            {/* Expiry selector */}
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Link expires after:</label>
              <div className="flex items-center gap-2">
                {[
                  { label: "Never", value: 0 },
                  { label: "1 hour", value: 1 },
                  { label: "24 hours", value: 24 },
                  { label: "7 days", value: 168 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setExpiryHours(opt.value)}
                    className={`px-2 py-1 rounded-lg text-[10px] transition-all ${
                      expiryHours === opt.value
                        ? "bg-nexus-500/20 text-nexus-400"
                        : "glass-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreateLink}
              className="w-full px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all"
            >
              Generate & Copy Link
            </button>

            {/* Existing links */}
            {links.length > 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Active links:</p>
                <div className="space-y-1.5">
                  {links.map((link) => (
                    <div key={link.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-xs">
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-[10px] truncate text-muted-foreground">
                          ...{link.token.slice(0, 8)}
                        </p>
                        {link.expiresAt && (
                          <p className={`text-[9px] ${isExpired(link) ? "text-red-400" : "text-muted-foreground/60"}`}>
                            {isExpired(link) ? "Expired" : `Expires ${new Date(link.expiresAt).toLocaleDateString()}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRevoke(link.id)}
                        className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all text-[10px]"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
