"use client";

import { useState, useEffect, useCallback } from "react";

interface RecentlyViewedItem {
  id: string;
  title: string;
  type: string;
  viewedAt: string;
}

const STORAGE_KEY = "nexus:recently_viewed";
const MAX_ITEMS = 6;

function loadFromStorage(): RecentlyViewedItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentlyViewedItem[];
  } catch {
    return [];
  }
}

function saveToStorage(items: RecentlyViewedItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Storage full or unavailable
  }
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedItem[]>([]);

  useEffect(() => {
    setItems(loadFromStorage());
  }, []);

  const trackView = useCallback((id: string, title: string, type: string) => {
    setItems((prev) => {
      // Remove if already exists (to move to top)
      const filtered = prev.filter((i) => i.id !== id);
      const updated = [
        { id, title: title || "Untitled", type, viewedAt: new Date().toISOString() },
        ...filtered,
      ].slice(0, MAX_ITEMS);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setItems([]);
    saveToStorage([]);
  }, []);

  return { items, trackView, clearHistory };
}
