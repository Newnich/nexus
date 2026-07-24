/**
 * Integration tests for lib/utils.ts — validatedFetcher
 *
 * Tests the fetch + Zod validation pipeline by mocking global fetch.
 * Covers:
 *   - Successful response with valid JSON
 *   - Non-ok HTTP status codes
 *   - JSON that fails Zod schema validation
 *   - Network / DOM errors
 *   - Schema defaults being applied
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { z } from "zod";

// ── Schema fixture ──

const TestSchema = z.object({
  id: z.string(),
  name: z.string(),
  count: z.number().default(0),
});

type TestType = z.output<typeof TestSchema>;

// ── Helper to mock fetch ──

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
      json: () => Promise.resolve(response.json ?? {}),
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

describe("validatedFetcher", () => {
  it("returns parsed data on a successful fetch with valid response", async () => {
    mockFetch({
      json: { id: "abc", name: "Test Item" },
    });

    const { validatedFetcher } = await import("../lib/utils");
    const result = await validatedFetcher("/api/test", TestSchema);

    expect(result.id).toBe("abc");
    expect(result.name).toBe("Test Item");
    // Default value from schema
    expect(result.count).toBe(0);
  });

  it("applies schema defaults when fields are missing", async () => {
    mockFetch({
      json: { id: "abc", name: "Test" },
    });

    const { validatedFetcher } = await import("../lib/utils");
    const result = await validatedFetcher("/api/test", TestSchema);

    // count has default(0) so it should be present
    expect(result.count).toBe(0);
  });

  it("throws descriptive error on non-ok response (404)", async () => {
    mockFetch({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/test", TestSchema)).rejects.toThrow(/404.*Not Found/);
  });

  it("throws descriptive error on non-ok response (500)", async () => {
    mockFetch({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/test", TestSchema)).rejects.toThrow(
      /500.*Internal Server Error/,
    );
  });

  it("throws Zod validation error when response doesn't match schema", async () => {
    mockFetch({
      json: { id: 123, name: null },
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/test", TestSchema)).rejects.toThrow(
      /API response validation failed/,
    );
  });

  it("throws Zod validation error with field paths", async () => {
    mockFetch({
      json: { name: "Only name" }, // missing required 'id'
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/test", TestSchema)).rejects.toThrow(/id/);
  });

  it("throws on network error", async () => {
    mockFetch({
      throws: new TypeError("Failed to fetch"),
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/test", TestSchema)).rejects.toThrow("Failed to fetch");
  });

  it("throws on invalid JSON", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON at position 0")),
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/test", TestSchema)).rejects.toThrow(/Unexpected token/);
  });

  it("passes through custom fetch options", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ id: "x", name: "y" }),
    });
    globalThis.fetch = fetchMock;

    const { validatedFetcher } = await import("../lib/utils");
    await validatedFetcher("/api/test", TestSchema, {
      method: "POST",
      headers: { "X-Custom": "value" },
      body: JSON.stringify({ foo: "bar" }),
    });

    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs[0]).toBe("/api/test");
    expect(callArgs[1]?.method).toBe("POST");
    expect(callArgs[1]?.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Custom": "value",
    });
  });

  it("makes a GET request by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: () => Promise.resolve({ id: "x", name: "y" }),
    });
    globalThis.fetch = fetchMock;

    const { validatedFetcher } = await import("../lib/utils");
    await validatedFetcher("/api/test", TestSchema);

    const callArgs = fetchMock.mock.calls[0];
    // Default should be GET (no method means GET)
    expect(callArgs[1]?.method ?? "GET").toBe("GET");
  });

  it("returns properly typed data that satisfies the schema", async () => {
    mockFetch({
      json: { id: "abc", name: "Test Item", count: 42 },
    });

    const { validatedFetcher } = await import("../lib/utils");
    const result: TestType = await validatedFetcher("/api/test", TestSchema);

    // TypeScript would fail at compile time if the type didn't match
    expect(result.count).toBe(42);
  });

  it("correctly reports the URL in validation error messages", async () => {
    mockFetch({
      json: { invalid: true },
    });

    const { validatedFetcher } = await import("../lib/utils");
    await expect(validatedFetcher("/api/some-endpoint", TestSchema)).rejects.toThrow(
      "/api/some-endpoint",
    );
  });

  // ── Edge case: AbortSignal ──

  // ── Edge case: concurrent requests ──

  it("handles multiple concurrent requests to different URLs", async () => {
    mockFetch({
      json: { id: "abc", name: "Concurrent" },
    });

    const { validatedFetcher } = await import("../lib/utils");

    const [r1, r2, r3] = await Promise.all([
      validatedFetcher("/api/items/1", TestSchema),
      validatedFetcher("/api/items/2", TestSchema),
      validatedFetcher("/api/items/3", TestSchema),
    ]);

    expect(r1.id).toBe("abc");
    expect(r2.id).toBe("abc");
    expect(r3.id).toBe("abc");
    expect(r1.name).toBe("Concurrent");
  });

  it("does not mix response data between concurrent requests", async () => {
    let idx = 0;
    const responses = [
      { id: "a", name: "Alpha", count: 10 },
      { id: "b", name: "Beta", count: 20 },
    ];
    globalThis.fetch = vi.fn().mockImplementation(() => {
      const data = responses[idx++];
      return Promise.resolve({
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.resolve(data),
      });
    });

    const { validatedFetcher } = await import("../lib/utils");
    const [r1, r2] = await Promise.all([
      validatedFetcher("/api/items/a", TestSchema),
      validatedFetcher("/api/items/b", TestSchema),
    ]);

    expect(r1.name).toBe("Alpha");
    expect(r2.name).toBe("Beta");
    expect(r1.count).toBe(10);
    expect(r2.count).toBe(20);
  });
});
