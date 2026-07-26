// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentlyViewed } from "../lib/hooks/use-recently-viewed";

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

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useRecentlyViewed", () => {
  it("starts with an empty items array", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.items).toEqual([]);
  });

  it("loads existing items from localStorage on mount", () => {
    const existing = [
      { id: "item-1", title: "First", type: "note", viewedAt: "2025-01-01T00:00:00.000Z" },
      { id: "item-2", title: "Second", type: "article", viewedAt: "2025-01-02T00:00:00.000Z" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe("item-1");
  });

  it("trackView adds item to the top of the list", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView("new-item", "New Item", "note");
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("new-item");
    expect(result.current.items[0].viewedAt).toBeDefined();
  });

  it("trackView moves existing item to the top (deduplication)", () => {
    const existing = [
      { id: "item-1", title: "First", type: "note", viewedAt: "2025-01-01T00:00:00.000Z" },
      { id: "item-2", title: "Second", type: "note", viewedAt: "2025-01-02T00:00:00.000Z" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView("item-1", "First (revisited)", "note");
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].id).toBe("item-1");
  });

  it("trackView limits to 6 items", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    const { result } = renderHook(() => useRecentlyViewed());
    for (let i = 0; i < 8; i++) {
      act(() => {
        result.current.trackView(`item-${i}`, `Item ${i}`, "note");
      });
    }
    expect(result.current.items).toHaveLength(6);
    expect(result.current.items[0].id).toBe("item-7");
    expect(result.current.items[5].id).toBe("item-2");
  });

  it("clearHistory removes all items", () => {
    const existing = [
      { id: "item-1", title: "First", type: "note", viewedAt: "2025-01-01T00:00:00.000Z" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.items).toEqual([]);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "nexus:recently_viewed",
      JSON.stringify([]),
    );
  });

  it("persists items to localStorage after trackView", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView("persist-test", "Persist Me", "article");
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "nexus:recently_viewed",
      expect.any(String),
    );
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe("persist-test");
  });

  it("uses 'Untitled' as fallback title when title is empty", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView("no-title", "", "note");
    });
    expect(result.current.items[0].title).toBe("Untitled");
  });

  it("handles corrupt localStorage data on mount", () => {
    localStorageMock.getItem.mockReturnValue("not valid json{{{");
    const { result } = renderHook(() => useRecentlyViewed());
    expect(result.current.items).toEqual([]);
  });

  it("handles localStorage setItem errors gracefully", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error("Storage full");
    });
    const { result } = renderHook(() => useRecentlyViewed());
    act(() => {
      result.current.trackView("test", "Test", "note");
    });
    expect(result.current.items).toHaveLength(1);
  });
});
