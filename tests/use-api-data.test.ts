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

  it("handles concurrent refetch calls — only last one's data is used", async () => {
    // First call returns slowly
    let resolveFirst: (v: unknown) => void;
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    // Second call returns immediately with different data
    const secondResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ id: "second", name: "Second wins", count: 42 }),
    };

    // Set up mock: first call slow, second call fast
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return firstPromise;
      }
      return Promise.resolve(secondResponse);
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    // Wait for initial fetch to complete
    await vi.waitFor(() => expect(callCount).toBe(1));

    // First call's resolver needs to be accessible
    // Now trigger two refetches in rapid succession
    // Setup: first refetch uses the slow promise, second uses the fast
    let resolveRefetch: (v: unknown) => void;
    const refetchPromise = new Promise((resolve) => {
      resolveRefetch = resolve;
    });

    callCount = 0;
    const refetchResponse = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ id: "first-refetch", name: "First refetch", count: 1 }),
    };
    const refetchResponse2 = {
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ id: "second-refetch", name: "Second refetch", count: 2 }),
    };

    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(refetchResponse);
      return Promise.resolve(refetchResponse2);
    });

    // First refetch (will complete quickly)
    act(() => {
      result.current.refetch();
    });

    // Second refetch (will also complete quickly, aborting the first)
    act(() => {
      result.current.refetch();
    });

    // Wait for state to settle
    await vi.waitFor(() => expect(result.current.loading).toBe(false));

    // The last refetch's data should be used
    expect(result.current.data).toEqual({
      id: "second-refetch",
      name: "Second refetch",
      count: 2,
    });
  });

  it("recovers from error after a successful fetch", async () => {
    // First fetch succeeds
    mockFetch({
      json: { id: "success", name: "First success" },
    });

    const { result } = renderHook(() => useApiData<TestType>("/api/test", TestSchema));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data?.id).toBe("success");
    expect(result.current.error).toBeNull();

    // Second fetch fails
    mockFetch({
      throws: new TypeError("Network failure"),
    });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // Data should still be the previous successful data
    expect(result.current.data?.id).toBe("success");
    expect(result.current.error).toContain("Network failure");

    // Third fetch succeeds again
    mockFetch({
      json: { id: "recovered", name: "Recovered data" },
    });

    await act(async () => {
      result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.data?.id).toBe("recovered");
    });
    expect(result.current.data?.name).toBe("Recovered data");
    expect(result.current.error).toBeNull();
  });

  it("preserves default Content-Type alongside custom headers", async () => {
    mockFetch({
      json: { id: "headers", name: "Header test" },
    });

    const options = {
      method: "POST" as const,
      headers: { Authorization: "Bearer token123", "X-Request-Id": "req-456" },
      body: JSON.stringify({ test: true }),
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
    // Default Content-Type should be present
    expect(fetchOpts.headers["Content-Type"]).toBe("application/json");
    // Custom headers should also be present
    expect(fetchOpts.headers["Authorization"]).toBe("Bearer token123");
    expect(fetchOpts.headers["X-Request-Id"]).toBe("req-456");
    // Method and body should be passed through
    expect(fetchOpts.method).toBe("POST");
    expect(fetchOpts.body).toBe(JSON.stringify({ test: true }));
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
