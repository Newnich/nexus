// @vitest-environment jsdom

/**
 * Unit tests for lib/hooks/use-api-data.ts
 *
 * Tests the useApiData React hook using @testing-library/react's renderHook.
 * Mocks globalThis.fetch to simulate API responses.
 *
 * Covers:
 *   - Initial loading state
 *   - Successful data fetch
 *   - Error handling (network, HTTP, Zod validation)
 *   - Refetch behavior
 *   - setData / clearError helpers
 *   - enabled: false option
 *   - Custom fetch options
 *   - URL changes trigger re-fetch
 *   - Cleanup on unmount (abort)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { z } from "zod";
import { useApiData } from "../lib/hooks/use-api-data";

// ── Schema fixture ──

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().default(0),
});

type TestType = z.output<typeof TestSchema>;

// ── Mock fetch ──

let originalFetch: typeof globalThis.fetch;

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json?: unknown;
  throws?: Error;
}) {
  globalThis.fetch = vi.fn().mockImplementation(() => {
    if (response.throws) {
      return Promise.reject(response.throws);
    }
    return Promise.resolve({
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? "OK",
      json: () =>
        response.throws ? Promise.reject(response.throws) : Promise.resolve(response.json ?? {}),
    });
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

describe("useApiData", () => {
  it("starts in loading state with no data or error", () => {
    mockFetch({ json: {} });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns parsed data after successful fetch", async () => {
    mockFetch({
      json: { id: "abc", name: "Test Item" },
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual({
      id: "abc",
      name: "Test Item",
      count: 0, // default value from schema
    });
    expect(result.current.error).toBeNull();
  });

  it("sets error on network failure", async () => {
    mockFetch({
      throws: new TypeError("Failed to fetch"),
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("Failed to fetch");
  });

  it("sets error on HTTP error response", async () => {
    mockFetch({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("500");
    expect(result.current.error).toContain("Internal Server Error");
  });

  it("sets error on Zod validation failure", async () => {
    mockFetch({
      json: { id: 123, name: null }, // wrong types
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("API response validation failed");
  });

  it("refetch re-fetches data and updates", async () => {
    mockFetch({
      json: { id: "first", name: "First" },
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.data?.id).toBe("first"));

    // Change mock for next fetch
    mockFetch({
      json: { id: "second", name: "Second" },
    });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data?.id).toBe("second"));
    expect(result.current.data?.name).toBe("Second");
  });

  it("setData updates data directly", async () => {
    mockFetch({
      json: { id: "abc", name: "Original" },
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setData({ id: "xyz", name: "Optimistic", count: 5 });
    });

    expect(result.current.data).toEqual({
      id: "xyz",
      name: "Optimistic",
      count: 5,
    });
  });

  it("clearError resets error state", async () => {
    mockFetch({
      throws: new TypeError("Failed to fetch"),
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.error).toBeTruthy());

    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it("does not fetch when enabled is false", async () => {
    mockFetch({
      json: { id: "abc", name: "Should not fetch" },
    });

    const { result } = renderHook(() =>
      useApiData<TestType>("/api/test", TestSchema, { enabled: false }),
    );

    // Should never start loading
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // Fetch should not have been called
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("passes fetchOptions to the underlying fetch", async () => {
    const mockJson = { id: "abc", name: "Test" };
    mockFetch({ json: mockJson });

    // Stable reference to prevent infinite re-renders
    const options = {
      method: "POST" as const,
      headers: { "X-Custom": "value" },
      body: JSON.stringify({ foo: "bar" }),
    };

    const { result } = renderHook(
      ({ fetchOpts }) =>
        useApiData<TestType>("/api/test", TestSchema, {
          fetchOptions: fetchOpts,
        }),
      { initialProps: { fetchOpts: options } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, fetchOpts] = callArgs;
    expect(url).toBe("/api/test");
    expect(fetchOpts.method).toBe("POST");
    expect(fetchOpts.headers).toMatchObject({ "X-Custom": "value" });
    expect(fetchOpts.body).toBe(JSON.stringify({ foo: "bar" }));
  });

  it("re-fetches when URL changes", async () => {
    mockFetch({
      json: { id: "url1", name: "First URL" },
    });

    const { result, rerender } = renderHook(({ url }) => useApiData<TestType>(url, TestSchema), {
      initialProps: { url: "/api/first" },
    });

    await waitFor(() => expect(result.current.data?.id).toBe("url1"));

    mockFetch({
      json: { id: "url2", name: "Second URL" },
    });

    rerender({ url: "/api/second" });

    await waitFor(() => expect(result.current.data?.id).toBe("url2"));
    expect(result.current.data?.name).toBe("Second URL");
  });

  it("cleans up on unmount (does not update state after unmount)", async () => {
    // Use a promise that never resolves to keep the fetch pending
    let resolvePromise: (v: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });

    globalThis.fetch = vi.fn().mockReturnValue(pendingPromise);

    const { result, unmount } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    // Should be loading
    expect(result.current.loading).toBe(true);

    // Unmount before fetch completes
    unmount();

    // Now resolve the fetch
    resolvePromise!({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ id: "abc", name: "Test" }),
    });

    // Wait a tick for the effect cleanup to run
    await vi.waitFor(() => {
      expect(result.current.loading).toBe(true); // still loading because it was unmounted
    });
  });
});
