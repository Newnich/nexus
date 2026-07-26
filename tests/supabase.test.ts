/**
 * Unit tests for lib/supabase/server.ts — Server Supabase helpers
 *
 * Tests createServiceClient and createServerSupabaseClient by mocking
 * @supabase/ssr and next/headers.
 *
 * Covers:
 *   - createServiceClient creates client with correct URL and key
 *   - createServiceClient returns a client with cookie methods
 *   - Missing env vars throw descriptive errors
 *   - createServerSupabaseClient uses cookies
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock @supabase/ssr ──

const mockCreateServerClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => {
    mockCreateServerClient(...args);
    return {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      rpc: vi.fn(),
      auth: {
        getUser: vi.fn(),
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
      },
    };
  },
}));

// ── Mock next/headers ──

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn(),
    getAll: vi.fn().mockReturnValue([]),
    set: vi.fn(),
  }),
}));

// ── Save/restore env ──

let envBackup: Record<string, string | undefined>;

beforeEach(() => {
  envBackup = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
});

afterEach(() => {
  for (const [key, val] of Object.entries(envBackup)) {
    if (val !== undefined) process.env[key] = val;
    else delete process.env[key];
  }
  vi.clearAllMocks();
});

// ── createServiceClient ──

describe("createServiceClient", () => {
  it("creates a client with the correct URL and service role key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key-123";

    const { createServiceClient } = await import("../lib/supabase/server");
    const client = await createServiceClient();

    expect(client).toBeDefined();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "service-role-key-123",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_URL", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key";

    const { createServiceClient } = await import("../lib/supabase/server");
    await expect(createServiceClient()).rejects.toThrow();
  });

  it("throws on missing SUPABASE_SERVICE_ROLE_KEY", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    const { createServiceClient } = await import("../lib/supabase/server");
    await expect(createServiceClient()).rejects.toThrow();
  });

  it("provides empty cookie handlers for service client", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key";

    const { createServiceClient } = await import("../lib/supabase/server");
    await createServiceClient();

    // The cookie handlers should be callable without errors
    const cookiesArg = mockCreateServerClient.mock.calls[0][2] as {
      cookies: { getAll: () => unknown[]; setAll: () => void };
    };
    expect(cookiesArg.cookies.getAll()).toEqual([]);
    expect(() => (cookiesArg.cookies.setAll as (cookies: unknown[]) => void)([])).not.toThrow();
  });
});

// ── createServerSupabaseClient ──

describe("createServerSupabaseClient", () => {
  it("creates a client with the anon key and cookies", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-456";

    const { createServerSupabaseClient } = await import("../lib/supabase/server");
    const client = await createServerSupabaseClient();

    expect(client).toBeDefined();
    expect(mockCreateServerClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "anon-key-456",
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      }),
    );
  });

  it("uses cookies from next/headers", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { createServerSupabaseClient } = await import("../lib/supabase/server");
    const client = await createServerSupabaseClient();

    // The cookie store's getAll should be passed to the client
    const cookiesArg = mockCreateServerClient.mock.calls[0][2] as {
      cookies: { getAll: () => unknown[] };
    };
    const result = cookiesArg.cookies.getAll();
    expect(Array.isArray(result)).toBe(true);
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_URL", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    const { createServerSupabaseClient } = await import("../lib/supabase/server");
    await expect(createServerSupabaseClient()).rejects.toThrow();
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_ANON_KEY", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { createServerSupabaseClient } = await import("../lib/supabase/server");
    await expect(createServerSupabaseClient()).rejects.toThrow();
  });
});
