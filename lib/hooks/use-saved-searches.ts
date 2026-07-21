"use client";

import { useState, useEffect, useCallback } from "react";

export interface SavedSearch {
  id: string;
  query: string;
  mode: "semantic" | "fulltext";
  type?: string;
  range?: string;
  createdAt: string;
  label?: string;
}

const STORAGE_KEY = "nexus:saved-searches";

function loadSearches(): SavedSearch[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSearches(searches: SavedSearch[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches));
  } catch {}
}

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>([]);

  useEffect(() => {
    setSearches(loadSearches());
  }, []);

  const addSearch = useCallback((search: Omit<SavedSearch, "id" | "createdAt">) => {
    setSearches((prev) => {
      const updated = [
        {
          ...search,
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, 20); // Max 20 saved searches
      saveSearches(updated);
      return updated;
    });
  }, []);

  const removeSearch = useCallback((id: string) => {
    setSearches((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveSearches(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setSearches([]);
    saveSearches([]);
  }, []);

  return { searches, addSearch, removeSearch, clearAll };
}
