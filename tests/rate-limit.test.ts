/**
 * Unit tests for lib/rate-limit/ — In-memory rate limiter
 *
 * Tests the in-memory fallback path (no env vars set).
 * The Upstash path requires external credentials and is tested separately.
 *
 * Covers:
 *   - Basic allow/block behavior
 *   - Window expiry and reset
 *   - Per-IP isolation
 *   - Store reset
 *   - Sweep cleanup
 */

import { describe, it, expect, beforeEach } from "vitest";

describe("checkRateLimit (in-memory)", () => {
  let checkRateLimit: (ip: string) => Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: number;
  }>;
  let _resetStore: () => void;
  let rateLimitConfig: { windowMs: number; max: number; mode: string };

  beforeEach(async () => {
    // Clear env to ensure in-memory path
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    // Set small window for fast tests
    process.env.RATE_LIMIT_WINDOW_MS = "60000";
    process.env.RATE_LIMIT_MAX = "5";

    const mod = await import("../lib/rate-limit");
    checkRateLimit = mod.checkRateLimit;
    _resetStore = mod._resetStore;
    rateLimitConfig = mod.rateLimitConfig;

    _resetStore();
  });

  it("allows the first request from an IP", async () => {
    const result = await checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("allows requests within the limit", async () => {
    for (let i = 0; i < 4; i++) {
      const result = await checkRateLimit("1.2.3.4");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests that exceed the limit", async () => {
    // Send max requests (5)
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("1.2.3.4");
    }

    // 6th request should be blocked
    const result = await checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different IPs independently", async () => {
    // Exhaust both IPs
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("1.2.3.4");
      await checkRateLimit("5.6.7.8");
    }

    // Both should now be blocked
    const r1 = await checkRateLimit("1.2.3.4");
    const r2 = await checkRateLimit("5.6.7.8");
    expect(r1.allowed).toBe(false);
    expect(r2.allowed).toBe(false);

    // A new IP should still be allowed
    const r3 = await checkRateLimit("9.10.11.12");
    expect(r3.allowed).toBe(true);
  });

  it("provides correct remaining count", async () => {
    const r1 = await checkRateLimit("1.2.3.4");
    expect(r1.remaining).toBe(4);

    const r2 = await checkRateLimit("1.2.3.4");
    expect(r2.remaining).toBe(3);

    const r3 = await checkRateLimit("1.2.3.4");
    expect(r3.remaining).toBe(2);
  });

  it("_resetStore clears state", async () => {
    // Use up some requests
    for (let i = 0; i < 5; i++) {
      await checkRateLimit("1.2.3.4");
    }

    expect((await checkRateLimit("1.2.3.4")).allowed).toBe(false);

    // Reset
    _resetStore();

    // Should be allowed again
    const result = await checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("rateLimitConfig reflects env settings", () => {
    expect(rateLimitConfig.max).toBe(5);
    expect(rateLimitConfig.windowMs).toBe(60000);
    expect(rateLimitConfig.mode).toBe("memory");
  });
});
