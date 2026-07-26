/**
 * Unit tests for lib/supabase/admin.ts — Admin Supabase Client
 *
 * Tests createAdminClient and module-level adminClient by mocking
 * @supabase/supabase-js. Covers:
 *   - createAdminClient creates client with correct URL and service key
 *   - createAdminClient throws on missing env vars
 *   - adminClient is exported as a module-level singleton
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock @supabase/supabase-js ──

const mockCreateClient = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => {
    mockCreateClient(...args);
    return {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      auth: {
        admin: {
          createUser: vi.fn(),
          deleteUser: vi.fn(),
        },
      },
    };
  },
}));

// ── Env helpers ──

let envBackup: Record<string, string | undefined>;

beforeEach(() => {
  envBackup = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
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

// ── createAdminClient ──

describe("createAdminClient", () => {
  it("creates a client with the URL and service role key", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://admin-test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-admin-789";

    // Use fresh import to avoid cached module state
    vi.resetModules();
    const { createAdminClient } = await import("../lib/supabase/admin");
    createAdminClient();

    expect(mockCreateClient).toHaveBeenCalledWith(
      "https://admin-test.supabase.co",
      "service-key-admin-789",
      expect.objectContaining({
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    );
  });

  it("throws on missing NEXT_PUBLIC_SUPABASE_URL", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "key";

    // Note: the module-level `adminClient = createAdminClient()` will throw
    // during import because env vars are missing. We catch that here.
    vi.resetModules();
    try {
      await import("../lib/supabase/admin");
      // If we get here without error, call createAdminClient directly
      const { createAdminClient } = await import("../lib/supabase/admin");
      expect(() => createAdminClient()).toThrow("Missing Supabase admin credentials");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("Missing Supabase admin credentials");
    }
  });

  it("throws on missing SUPABASE_SERVICE_ROLE_KEY", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    vi.resetModules();
    try {
      await import("../lib/supabase/admin");
      const { createAdminClient } = await import("../lib/supabase/admin");
      expect(() => createAdminClient()).toThrow("Missing Supabase admin credentials");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain("Missing Supabase admin credentials");
    }
  });
});

// ── adminClient module-level singleton ──

describe("adminClient (module-level)", () => {
  it("exports an admin client created at module load time", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://module-test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "module-level-key";

    vi.resetModules();
    const mod = await import("../lib/supabase/admin");
    expect(mod.adminClient).toBeDefined();
    // createClient should have been called during module load (for the adminClient export)
    expect(mockCreateClient).toHaveBeenCalled();
  });
});
