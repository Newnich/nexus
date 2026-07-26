// @vitest-environment jsdom

/**
 * Unit tests for lib/hooks/use-draft.ts — Draft auto-save hook
 *
 * Tests localStorage-based draft saving with debounce.
 * Uses @testing-library/react's renderHook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDraft } from "../lib/hooks/use-draft";

// ── localStorage mock ──

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  writable: true,
  configurable: true,
});

const originalLocation = window.location;

beforeEach(() => {
  vi.useFakeTimers();
  localStorageMock.clear();
  vi.clearAllMocks();

  Object.defineProperty(window, "location", {
    value: { ...originalLocation, pathname: "/items/new" },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(window, "location", {
    value: originalLocation,
    writable: true,
    configurable: true,
  });
});

const draftData = {
  saveType: "url" as const,
  url: "https://example.com",
  title: "Test Article",
  content: "This is the article content",
  tags: ["test", "article"],
};

describe("useDraft", () => {
  it("starts with hasDraft=false when no saved draft exists", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useDraft());

    expect(result.current.hasDraft).toBe(false);
  });

  it("sets hasDraft=true when a valid draft exists in localStorage", () => {
    const validDraft = { ...draftData, savedAt: Date.now() };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(validDraft));

    const { result } = renderHook(() => useDraft());

    expect(result.current.hasDraft).toBe(true);
  });

  it("clears expired drafts (older than 24 hours)", () => {
    const expiredDraft = { ...draftData, savedAt: Date.now() - 25 * 60 * 60 * 1000 };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredDraft));

    const { result } = renderHook(() => useDraft());

    expect(result.current.hasDraft).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });

  it("saveDraft writes to localStorage after debounce", async () => {
    const { result } = renderHook(() => useDraft());

    act(() => {
      result.current.saveDraft({
        saveType: "url",
        url: "https://example.com",
        title: "Test",
        content: "Content",
        tags: ["test"],
      });
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();
    const savedKey = localStorageMock.setItem.mock.calls[0][0];
    expect(savedKey).toContain("nexus:draft:");
    expect(savedKey).toContain("/items/new");

    const savedValue = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(savedValue.title).toBe("Test");
    expect(savedValue.savedAt).toBeDefined();
  });

  it("loadDraft returns the saved draft data", () => {
    const savedDraft = { ...draftData, savedAt: Date.now() };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedDraft));

    const { result } = renderHook(() => useDraft());

    const loaded = result.current.loadDraft();
    expect(loaded).not.toBeNull();
    expect(loaded!.title).toBe("Test Article");
    expect(loaded!.tags).toEqual(["test", "article"]);
  });

  it("loadDraft returns null and clears expired drafts", () => {
    const expiredDraft = { ...draftData, savedAt: Date.now() - 25 * 60 * 60 * 1000 };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(expiredDraft));

    const { result } = renderHook(() => useDraft());

    const loaded = result.current.loadDraft();
    expect(loaded).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalled();
    expect(result.current.hasDraft).toBe(false);
  });

  it("loadDraft returns null when no draft exists", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useDraft());

    const loaded = result.current.loadDraft();
    expect(loaded).toBeNull();
  });

  it("clearDraft removes draft from localStorage and sets hasDraft=false", () => {
    const savedDraft = { ...draftData, savedAt: Date.now() };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedDraft));

    const { result } = renderHook(() => useDraft());

    expect(result.current.hasDraft).toBe(true);

    act(() => {
      result.current.clearDraft();
    });

    expect(result.current.hasDraft).toBe(false);
    expect(localStorageMock.removeItem).toHaveBeenCalled();
  });

  it("handles localStorage errors gracefully (saveDraft)", () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error("Storage full");
    });

    const { result } = renderHook(() => useDraft());

    act(() => {
      result.current.saveDraft({ saveType: "url", url: "", title: "Test", content: "", tags: [] });
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it("handles localStorage errors gracefully (loadDraft with corrupt JSON)", () => {
    localStorageMock.getItem.mockReturnValue("not valid json{{{");

    const { result } = renderHook(() => useDraft());

    const loaded = result.current.loadDraft();
    expect(loaded).toBeNull();
  });

  it("debounces rapid successive saves", () => {
    const { result } = renderHook(() => useDraft());

    act(() => {
      result.current.saveDraft({ saveType: "url", url: "", title: "A", content: "", tags: [] });
    });
    act(() => {
      result.current.saveDraft({ saveType: "url", url: "", title: "B", content: "", tags: [] });
    });
    act(() => {
      result.current.saveDraft({ saveType: "url", url: "", title: "C", content: "", tags: [] });
    });

    expect(localStorageMock.setItem).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(localStorageMock.setItem).toHaveBeenCalledTimes(1);
    const lastValue = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(lastValue.title).toBe("C");
  });
});
