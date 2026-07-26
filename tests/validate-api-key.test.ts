/**
 * Unit tests for lib/auth/validate-api-key.ts — API Key Validation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockDigest = vi.fn();
const originalCrypto = globalThis.crypto;

beforeEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      subtle: {
        digest: mockDigest,
      },
    },
    writable: true,
    configurable: true,
  });

  mockDigest.mockResolvedValue(
    new Uint8Array([
      0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77,
      0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff, 0x00, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45,
      0x67, 0x89,
    ]),
  );
});

afterEach(() => {
  Object.defineProperty(globalThis, "crypto", {
    value: originalCrypto,
    writable: true,
    configurable: true,
  });
});

describe("hashApiKey", () => {
  it("returns a SHA-256 hex string", async () => {
    const { hashApiKey } = await import("../lib/auth/validate-api-key");
    const hash = await hashApiKey("nx_test_key");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("calls crypto.subtle.digest with SHA-256", async () => {
    const { hashApiKey } = await import("../lib/auth/validate-api-key");
    await hashApiKey("nx_abc123");
    expect(mockDigest).toHaveBeenCalledWith("SHA-256", expect.any(Uint8Array));
  });

  it("produces consistent hashes for the same input", async () => {
    const { hashApiKey } = await import("../lib/auth/validate-api-key");
    const hash1 = await hashApiKey("nx_consistent");
    const hash2 = await hashApiKey("nx_consistent");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    mockDigest
      .mockResolvedValueOnce(new Uint8Array(Array.from({ length: 32 }, (_, i) => i)))
      .mockResolvedValueOnce(new Uint8Array(Array.from({ length: 32 }, (_, i) => 255 - i)));

    const { hashApiKey } = await import("../lib/auth/validate-api-key");
    const hash1 = await hashApiKey("nx_key_one");
    const hash2 = await hashApiKey("nx_key_two");
    expect(hash1).not.toBe(hash2);
  });
});

describe("validateApiKey", () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-123";

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([{ id: "key-1", user_id: "user-abc" }]),
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns userId and keyId for a valid nx_ key", async () => {
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_valid_key_here");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-abc");
    expect(result!.keyId).toBe("key-1");
  });

  it("returns null for key without nx_ prefix", async () => {
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("invalid_key_format");
    expect(result).toBeNull();
  });

  it("returns null for empty string", async () => {
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("");
    expect(result).toBeNull();
  });

  it("returns null when SUPABASE env vars are missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("returns null when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("returns null when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("returns null when fetch returns non-ok status", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("returns null when results array is empty", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve([]) });
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("returns null when results is not an array", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ id: "not-an-array" }),
    });
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("returns null when fetch throws an error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).toBeNull();
  });

  it("makes a PATCH call to update last_used_at asynchronously", async () => {
    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).not.toBeNull();

    const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls as Array<
      [string, RequestInit]
    >;

    const getCall = calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("api_keys?key_hash="),
    );
    expect(getCall).toBeDefined();

    const patchCall = calls.find(
      (c) => typeof c[0] === "string" && c[0].includes("id=eq.") && c[1]?.method === "PATCH",
    );
    expect(patchCall).toBeDefined();
    if (patchCall) {
      const headers = patchCall[1]?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    }
  });

  it("does not crash when PATCH update fails (fire-and-forget)", async () => {
    let callCount = 0;
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve([{ id: "key-1", user_id: "user-abc" }]),
        });
      }
      return Promise.reject(new Error("PATCH failed"));
    });

    const { validateApiKey } = await import("../lib/auth/validate-api-key");
    const result = await validateApiKey("nx_test_key");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-abc");
  });
});
