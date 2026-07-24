// @vitest-environment jsdom

/**
 * Integration tests for lib/hooks/use-api-data.ts
 *
 * Renders real React components that use the useApiData hook and verifies
 * the full data flow: loading state → data fetched → data displayed.
 *
 * Covers:
 *   - Loading skeleton renders while fetch is in progress
 *   - Data renders after successful fetch
 *   - Error message renders on fetch failure
 *   - Refetch button updates data
 *   - URL change triggers re-fetch with correct data
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { z } from "zod";
import { useApiData } from "../lib/hooks/use-api-data";

// ── Schema fixture ──

const ItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
});

type Item = z.output<typeof ItemSchema>;

// ── Test Components ──

function ItemDisplay({ url }: { url: string | null }) {
  const { data, loading, error, refetch } = useApiData<Item>(url, ItemSchema);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error}</div>;
  if (!data) return <div data-testid="empty">No item data</div>;

  return (
    <div data-testid="loaded">
      <h1 data-testid="title">{data.title}</h1>
      <p data-testid="desc">{data.description || "No description"}</p>
      <button data-testid="refetch-btn" onClick={refetch}>
        Refresh
      </button>
    </div>
  );
}

function ItemWithToggle({ id }: { id: string }) {
  const { data, loading, error } = useApiData<Item>(`/api/items/${id}`, ItemSchema);

  if (loading) return <div data-testid="loading">Loading...</div>;
  if (error) return <div data-testid="error">{error}</div>;
  if (!data) return <div data-testid="empty">No data</div>;

  return (
    <div data-testid="loaded">
      <span data-testid="item-id">{data.id}</span>
      <span data-testid="item-title">{data.title}</span>
    </div>
  );
}

// ── Mock fetch ──

let originalFetch: typeof globalThis.fetch;

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  throws?: Error;
  delay?: number;
}) {
  const delay = response.delay ?? 0;
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const result = response.throws
      ? Promise.reject(response.throws)
      : Promise.resolve({
          ok: response.ok ?? true,
          status: response.status ?? 200,
          statusText: response.statusText ?? "OK",
          json: () =>
            response.throws
              ? Promise.reject(response.throws)
              : Promise.resolve(response.json ?? {}),
        });
    return delay > 0 ? new Promise((resolve) => setTimeout(() => resolve(result), delay)) : result;
  });
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ── Tests ──

describe("useApiData integration", () => {
  it("renders loading state then transitions to data display", async () => {
    mockFetch({
      json: { id: "item-1", title: "Test Item", description: "A test item" },
      delay: 50,
    });

    render(<ItemDisplay url="/api/items/1" />);

    expect(screen.getByTestId("loading")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByTestId("loaded")).toBeDefined();
    });

    expect(screen.getByTestId("title").textContent).toBe("Test Item");
    expect(screen.getByTestId("desc").textContent).toBe("A test item");
  });

  it("renders error state when fetch fails", async () => {
    mockFetch({
      throws: new TypeError("Network request failed"),
    });

    render(<ItemDisplay url="/api/items/1" />);

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeDefined();
    });

    expect(screen.getByTestId("error").textContent).toContain("Network request failed");
  });

  it("renders empty state when URL is null", async () => {
    mockFetch({
      json: { id: "should-not-fetch", title: "Never" },
    });

    render(<ItemDisplay url={null} />);

    expect(screen.getByTestId("empty")).toBeDefined();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("refetches data when refetch button is clicked", async () => {
    mockFetch({
      json: { id: "item-1", title: "Original Title" },
    });

    render(<ItemDisplay url="/api/items/1" />);

    await waitFor(() => {
      expect(screen.getByTestId("loaded")).toBeDefined();
    });
    expect(screen.getByTestId("title").textContent).toBe("Original Title");

    mockFetch({
      json: { id: "item-1", title: "Updated Title" },
    });

    act(() => {
      screen.getByTestId("refetch-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("title").textContent).toBe("Updated Title");
    });
  });

  it("re-fetches when the URL prop changes", async () => {
    mockFetch({
      json: { id: "item-a", title: "Item A" },
    });

    const { rerender } = render(<ItemWithToggle id="a" />);

    await waitFor(() => {
      expect(screen.getByTestId("loaded")).toBeDefined();
    });
    expect(screen.getByTestId("item-id").textContent).toBe("item-a");

    mockFetch({
      json: { id: "item-b", title: "Item B" },
    });

    rerender(<ItemWithToggle id="b" />);

    await waitFor(() => {
      expect(screen.getByTestId("item-id").textContent).toBe("item-b");
    });
    expect(screen.getByTestId("item-title").textContent).toBe("Item B");
  });

  it("recovers from error after refetch succeeds", async () => {
    mockFetch({
      throws: new TypeError("Temporary failure"),
    });

    render(<ItemDisplay url="/api/items/1" />);

    await waitFor(() => {
      expect(screen.getByTestId("error")).toBeDefined();
    });

    mockFetch({
      json: {
        id: "item-1",
        title: "Recovered",
        description: "Back online",
      },
    });

    act(() => {
      screen.getByTestId("refetch-btn").click();
    });

    await waitFor(() => {
      expect(screen.getByTestId("loaded")).toBeDefined();
    });
    expect(screen.getByTestId("title").textContent).toBe("Recovered");
  });
});
