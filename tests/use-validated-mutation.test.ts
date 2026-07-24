// @vitest-environment jsdom

/**
 * Unit tests for lib/hooks/use-validated-mutation.ts
 *
 * Tests the useValidatedMutation React hook which handles POST/PUT/PATCH/DELETE
 * mutations with Zod validation, AbortController cancellation, and callbacks.
 *
 * Covers:
 *   - Initial idle state
 *   - Loading state during mutation
 *   - Successful mutation with parsed response
 *   - HTTP error handling
 *   - Network error handling
 *   - Zod validation error handling
 *   - onSuccess / onError callbacks
 *   - AbortController cancellation
 *   - Custom headers passed to fetch
 *   - Body serialization
 *   - reset() clears state
 *   - DELETE method (no body)
 *   - State isolation between successive mutations
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { z } from "zod";
import { useValidatedMutation } from "../lib/hooks/use-validated-mutation";

// ── Schema fixtures ──

const SuccessResponseSchema = z.object({
  success: z.boolean(),
  id: z.string().optional(),
});

const ItemResponseSchema = z.object({
  item: z.object({
    id: z.string(),
    title: z.string(),
  }),
});

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

describe("useValidatedMutation", () => {
  it("starts in idle state with no data, loading, or error", () => {
    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets loading to true when mutate is called", async () => {
    // Keep fetch pending so we can observe loading state
    let resolvePromise: (v: unknown) => void;
    const pendingPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    globalThis.fetch = vi.fn().mockReturnValue(pendingPromise);

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    act(() => {
      result.current.mutate({ name: "test" });
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("returns parsed data after successful mutation", async () => {
    mockFetch({
      json: { success: true, id: "abc-123" },
    });

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    expect(result.current.data).toEqual({ success: true, id: "abc-123" });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sends POST request with JSON body", async () => {
    mockFetch({
      json: { success: true },
    });

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string; count: number }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/submit",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "hello", count: 42 });
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, options] = callArgs;
    expect(url).toBe("/api/submit");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ name: "hello", count: 42 }));
  });

  it("sends DELETE request without body", async () => {
    mockFetch({
      json: { success: true },
    });

    const { result } = renderHook(() =>
      useValidatedMutation<void, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/items/123",
        method: "DELETE",
        schema: SuccessResponseSchema,
      }),
    );

    await act(async () => {
      await result.current.mutate();
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [url, options] = callArgs;
    expect(url).toBe("/api/items/123");
    expect(options.method).toBe("DELETE");
    // No body should be sent for DELETE
    expect(options.body).toBeUndefined();
  });

  it("sets error on HTTP error response (500)", async () => {
    mockFetch({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
        onError,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("500");
    expect(result.current.error).toContain("Internal Server Error");
    expect(onError).toHaveBeenCalled();
  });

  it("sets error on network failure", async () => {
    mockFetch({
      throws: new TypeError("Failed to fetch"),
    });

    const onError = vi.fn();
    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
        onError,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    expect(result.current.error).toContain("Failed to fetch");
    expect(onError).toHaveBeenCalledWith("Failed to fetch");
  });

  it("sets error on Zod validation failure", async () => {
    mockFetch({
      json: { success: "not-a-boolean", id: 123 }, // wrong types
    });

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("API response validation failed");
  });

  it("calls onSuccess callback after successful mutation", async () => {
    mockFetch({
      json: { success: true, id: "abc" },
    });

    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
        onSuccess,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ success: true, id: "abc" });
  });

  it("passes custom headers alongside Content-Type", async () => {
    mockFetch({
      json: { success: true },
    });

    const headers = {
      Authorization: "Bearer token-xyz",
      "X-Request-Id": "req-789",
    };

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
        headers,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    const [, options] = callArgs;
    // Content-Type should be set by default
    expect(options.headers["Content-Type"]).toBe("application/json");
    // Custom headers should be present
    expect(options.headers["Authorization"]).toBe("Bearer token-xyz");
    expect(options.headers["X-Request-Id"]).toBe("req-789");
  });

  it("cancels in-flight request on second mutate call", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation((_url, options) => {
      callCount++;
      if (callCount === 1) {
        // First call: hang until aborted
        return new Promise((_, reject) => {
          options.signal.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ success: true, id: "second" }),
      });
    });

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    // First mutate (slow — hangs until aborted)
    let firstMutatePromise: Promise<void>;
    act(() => {
      firstMutatePromise = result.current.mutate({ name: "first" });
    });

    // Second mutate (fast) — should abort the first
    await act(async () => {
      await result.current.mutate({ name: "second" });
    });

    // The first mutate's promise should resolve (AbortError is caught internally)
    await expect(firstMutatePromise!).resolves.toBeUndefined();

    // Data should be from the second (last) call
    expect(result.current.data).toEqual({ success: true, id: "second" });
  });

  it("reset() clears data, loading, and error", async () => {
    mockFetch({
      json: { success: true, id: "abc" },
    });

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/test",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    await act(async () => {
      await result.current.mutate({ name: "test" });
    });

    expect(result.current.data).toEqual({ success: true, id: "abc" });

    act(() => {
      result.current.reset();
    });

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles successive mutations independently", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: "OK",
          json: () => Promise.resolve({ success: true, id: "first-call" }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve({ success: true, id: "second-call" }),
      });
    });

    const { result } = renderHook(() =>
      useValidatedMutation<{ name: string }, z.infer<typeof SuccessResponseSchema>>({
        url: "/api/items",
        method: "POST",
        schema: SuccessResponseSchema,
      }),
    );

    // First mutation
    await act(async () => {
      await result.current.mutate({ name: "first" });
    });
    expect(result.current.data?.id).toBe("first-call");

    // Second mutation (different data)
    await act(async () => {
      await result.current.mutate({ name: "second" });
    });
    expect(result.current.data?.id).toBe("second-call");
  });
});
