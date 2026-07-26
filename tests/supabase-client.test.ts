/**
 * Unit tests for lib/supabase/client.ts — Browser Supabase Client
 *
 * Tests supabase() and createClient() by mocking @supabase/ssr.
 * Covers:
 *   - supabase() creates client lazily on first call
 *   - supabase() returns singleton on subsequent calls
 *   - supabase() throws on missing env vars
 *   - createClient() creates a new browser client each call
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock @supabase/ssr createBrowserClient ──

const mockCreateBrowserClient = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: unknown[]) => {
    mockCreateBrowserClient(...args);
    return {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        signOut: vi.fn(),
      },
    };
  },
}));

// ── Env helpers ──

let envBackup: Record<string, string | undefined>;
let moduleUnderTest: typeof import("../lib/supabase/client");

beforeEach(async () => {
  envBackup = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };

  vi.resetModules();
  vi.clearAllMocks();
  moduleUnderTest = await import("../lib/supabase/client");
});

afterEach(() => {
  for (const [key, val] of Object.entries(envBackup)) {
    if (val !== undefined) process.env[key] = val;
    else delete process.env[key];
  }
});

// ── supabase() ──

describe("supabase()", () => {
  it("creates a browser client with URL and anon key on first call", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://browser-test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "browser-anon-key";

    const client = moduleUnderTest.supabase();

    expect(client).toBeDefined();
    expect(mockCreateBrowserClient).toHaveBeenCalledWith(
      "https://browser-test.supabase.co",
      "browser-anon-key",
    );
  });

  it("returns the same instance on subsequent calls (singleton)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://singleton-test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-singleton";

    const client1 = moduleUnderTest.supabase();
    const client2 = moduleUnderTest.supabase();

    expect(client1).toBe(client2);
    // createBrowserClient should only have been called once
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(1);
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_URL", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(() => moduleUnderTest.supabase()).toThrow("Missing Supabase environment variables");
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_ANON_KEY", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => moduleUnderTest.supabase()).toThrow("Missing Supabase environment variables");
  });

  it("throws when both env vars are missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => moduleUnderTest.supabase()).toThrow("Missing Supabase environment variables");
  });
});

// ── createClient() ──

describe("createClient()", () => {
  it("creates a new browser client each call", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https=";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "fresh-anon-key";

    const client1 = moduleUnderTest.createClient();
    const client2 = moduleUnderTest.createClient();

    expect(client1).toBeDefined();
    expect(client2).toBeDefined();
    // createBrowserClient should have been called twice (not singleton)
    expect(mockCreateBrowserClient).toHaveBeenCalledTimes(2);
  });
});
