"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const DRAFT_PREFIX = "nexus:draft:";

interface DraftState {
  saveType: string;
  url: string;
  title: string;
  content: string;
  tags: string[];
  savedAt: number;
}

function getDraftKey(): string {
  // Use pathname as the draft key so different pages don't clash
  if (typeof window === "undefined") return `${DRAFT_PREFIX}default`;
  return `${DRAFT_PREFIX}${window.location.pathname}`;
}

export function useDraft() {
  const key = getDraftKey();
  const [hasDraft, setHasDraft] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Load draft on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftState;
        // Only restore drafts younger than 24 hours
        const age = Date.now() - parsed.savedAt;
        if (age < 24 * 60 * 60 * 1000) {
          setHasDraft(true);
        } else {
          localStorage.removeItem(key);
        }
      }
    } catch {}
  }, [key]);

  // Save draft with debounce
  const saveDraft = useCallback(
    (state: Omit<DraftState, "savedAt">) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          const draft: DraftState = { ...state, savedAt: Date.now() };
          localStorage.setItem(key, JSON.stringify(draft));
          setHasDraft(true);
        } catch {}
      }, 1000);
    },
    [key]
  );

  // Load draft data
  const loadDraft = useCallback((): Partial<DraftState> | null => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftState;
      const age = Date.now() - parsed.savedAt;
      if (age >= 24 * 60 * 60 * 1000) {
        localStorage.removeItem(key);
        setHasDraft(false);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [key]);

  // Clear draft (call after successful save)
  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(key);
      setHasDraft(false);
    } catch {}
  }, [key]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { hasDraft, saveDraft, loadDraft, clearDraft };
}
