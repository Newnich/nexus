// @vitest-environment jsdom

/**
 * Unit tests for lib/hooks/use-saved-searches.ts — Saved search queries
 *
 * Tests localStorage-based saved search management.
 * Uses @testing-library/react's renderHook.
 *
 * Covers:
 *   - Initial state: empty searches
 *   - addSearch adds search to the top
 *   - addSearch generates unique IDs
 *   - addSearch limits to 20 searches
 *   - removeSearch removes by ID
 *   - clearAll removes all searches
 *   - Persists to localStorage
 *   - localStorage errors handled gracefully
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSavedSearches } from "../lib/hooks/use-saved-searches";

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

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Tests ──

describe("useSavedSearches", () => {
  it("starts with an empty searches array", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useSavedSearches());

    expect(result.current.searches).toEqual([]);
  });

  it("loads existing searches from localStorage on mount", () => {
    const existing = [
      { id: "s1", query: "react", mode: "semantic" as const, createdAt: "2025-01-01T00:00:00Z" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));

    const { result } = renderHook(() => useSavedSearches());

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].query).toBe("react");
  });

  it("addSearch adds search to the top of the list", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.addSearch({ query: "machine learning", mode: "semantic" });
    });

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].query).toBe("machine learning");
    expect(result.current.searches[0].mode).toBe("semantic");
    expect(result.current.searches[0].id).toBeDefined();
    expect(result.current.searches[0].createdAt).toBeDefined();
  });

  it("addSearch generates unique IDs for each search", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.addSearch({ query: "first", mode: "semantic" });
    });

    const firstId = result.current.searches[0].id;

    act(() => {
      result.current.addSearch({ query: "second", mode: "fulltext" });
    });

    const secondId = result.current.searches[0].id;

    expect(firstId).not.toBe(secondId);
  });

  it("addSearch supports optional type and range fields", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.addSearch({
        query: "advanced search",
        mode: "fulltext",
        type: "article",
        range: "last-month",
      });
    });

    expect(result.current.searches[0].type).toBe("article");
    expect(result.current.searches[0].range).toBe("last-month");
  });

  it("addSearch limits to 20 searches", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useSavedSearches());

    // Add 25 searches
    for (let i = 0; i < 25; i++) {
      act(() => {
        result.current.addSearch({ query: `search-${i}`, mode: "semantic" });
      });
    }

    // Should cap at 20
    expect(result.current.searches).toHaveLength(20);
    // The newest should be at the top
    expect(result.current.searches[0].query).toBe("search-24");
  });

  it("removeSearch removes search by ID", () => {
    const existing = [
      { id: "s1", query: "react", mode: "semantic" as const, createdAt: "2025-01-01T00:00:00Z" },
      { id: "s2", query: "vue", mode: "semantic" as const, createdAt: "2025-01-02T00:00:00Z" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.removeSearch("s1");
    });

    expect(result.current.searches).toHaveLength(1);
    expect(result.current.searches[0].id).toBe("s2");
  });

  it("removeSearch does nothing when ID doesn't exist", () => {
    const existing = [
      { id: "s1", query: "react", mode: "semantic" as const, createdAt: "2025-01-01T00:00:00Z" },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.removeSearch("nonexistent");
    });

    expect(result.current.searches).toHaveLength(1);
  });

  it("clearAll removes all searches", () => {
    const existing = [
      { id: "s1", query: "react", mode: "semantic" as const, createdAt: "2025-01-01T00:00:00Z" },
      {
        id: "s2",
        query: "typescript",
        mode: "fulltext" as const,
        createdAt: "2025-01-02T00:00:00Z",
      },
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(existing));

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.clearAll();
    });

    expect(result.current.searches).toEqual([]);
  });

  it("persists to localStorage after addSearch", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.addSearch({ query: "test query", mode: "semantic", label: "Test" });
    });

    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "nexus:saved-searches",
      expect.any(String),
    );
    const saved = JSON.parse(localStorageMock.setItem.mock.calls[0][1]);
    expect(saved).toHaveLength(1);
    expect(saved[0].query).toBe("test query");
    expect(saved[0].label).toBe("Test");
  });

  it("handles corrupt localStorage data on mount", () => {
    localStorageMock.getItem.mockReturnValue("not valid json{{{");

    const { result } = renderHook(() => useSavedSearches());

    expect(result.current.searches).toEqual([]);
  });

  it("handles localStorage setItem errors gracefully", () => {
    localStorageMock.getItem.mockReturnValue(null as unknown as string);
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error("Storage full");
    });

    const { result } = renderHook(() => useSavedSearches());

    act(() => {
      result.current.addSearch({ query: "test", mode: "semantic" });
    });

    // Should not throw — error is caught internally
    expect(result.current.searches).toHaveLength(1);
  });
});
