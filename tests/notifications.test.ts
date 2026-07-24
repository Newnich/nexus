/**
 * Unit tests for lib/notifications/
 *
 * Tests pure functions from:
 *   - cooldown.ts (clampMinutes, sanitize)
 *   - preferences.ts (getDefaultPreferences, shouldNotify)
 *   - shared.ts (escapeHtml, getDashboardUrl)
 */

import { describe, it, expect, beforeEach } from "vitest";

// ── Cooldown tests ──

describe("clampMinutes", () => {
  let clampMinutes: (value: number, fallback: number) => number;

  beforeEach(async () => {
    const mod = await import("../lib/notifications/cooldown");
    clampMinutes = mod.clampMinutes;
  });

  it("returns the value when within range", () => {
    expect(clampMinutes(30, 15)).toBe(30);
    expect(clampMinutes(1, 15)).toBe(1);
    expect(clampMinutes(1440, 15)).toBe(1440);
  });

  it("returns fallback for NaN", () => {
    expect(clampMinutes(NaN, 15)).toBe(15);
  });

  it("returns fallback for values below minimum", () => {
    expect(clampMinutes(0, 15)).toBe(15);
    expect(clampMinutes(-1, 15)).toBe(15);
  });

  it("returns fallback for values above maximum", () => {
    expect(clampMinutes(1441, 15)).toBe(15);
    expect(clampMinutes(9999, 15)).toBe(15);
  });

  it("rounds float values to nearest integer", () => {
    expect(clampMinutes(30.7, 15)).toBe(31);
    expect(clampMinutes(30.2, 15)).toBe(30);
  });
});

describe("sanitize (cooldown)", () => {
  let sanitize: (raw: Partial<{ slack: number; discord: number; email: number }>) => {
    slack: number;
    discord: number;
    email: number;
  };

  beforeEach(async () => {
    const mod = await import("../lib/notifications/cooldown");
    sanitize = mod.sanitize;
  });

  it("returns defaults for empty input", () => {
    const result = sanitize({});
    expect(result).toEqual({ slack: 30, discord: 30, email: 30 });
  });

  it("passes through valid values", () => {
    const result = sanitize({ slack: 15, discord: 60, email: 120 });
    expect(result).toEqual({ slack: 15, discord: 60, email: 120 });
  });

  it("clamps out-of-range values to defaults", () => {
    const result = sanitize({ slack: -1, discord: 9999, email: 0 });
    expect(result).toEqual({ slack: 30, discord: 30, email: 30 });
  });

  it("handles NaN gracefully", () => {
    const result = sanitize({ slack: NaN, discord: 60, email: NaN });
    expect(result.slack).toBe(30);
    expect(result.discord).toBe(60);
    expect(result.email).toBe(30);
  });
});

// ── Preferences tests ──

describe("getDefaultPreferences", () => {
  let getDefaultPreferences: () => Record<string, unknown>;

  beforeEach(async () => {
    const mod = await import("../lib/notifications/preferences");
    getDefaultPreferences = mod.getDefaultPreferences;
  });

  it("returns all alert IDs", () => {
    const prefs = getDefaultPreferences();
    const keys = Object.keys(prefs);
    expect(keys).toContain("redis_disconnected");
    expect(keys).toContain("backfill_repeated_failures");
    expect(keys).toContain("backfill_enqueue_errors");
    expect(keys).toContain("worker_inactive");
    expect(keys).toContain("worker_no_successful_run");
    expect(keys).toContain("large_backlog");
    expect(keys).toHaveLength(6);
  });

  it("enables all channels for each alert", () => {
    const prefs = getDefaultPreferences();
    for (const [alertId, channels] of Object.entries(prefs)) {
      expect(channels).toEqual({ slack: true, discord: true, email: true });
    }
  });
});

describe("shouldNotify", () => {
  let shouldNotify: (
    prefs: Record<string, Record<string, boolean>>,
    alertId: string,
    channel: string,
  ) => boolean;

  beforeEach(async () => {
    const mod = await import("../lib/notifications/preferences");
    shouldNotify = mod.shouldNotify as typeof shouldNotify;
  });

  const defaultPrefs = {
    redis_disconnected: { slack: true, discord: true, email: true },
    backfill_repeated_failures: { slack: true, discord: false, email: false },
  };

  it("returns true for enabled channels", () => {
    expect(shouldNotify(defaultPrefs, "redis_disconnected", "slack")).toBe(true);
    expect(shouldNotify(defaultPrefs, "redis_disconnected", "email")).toBe(true);
  });

  it("returns false for disabled channels", () => {
    expect(shouldNotify(defaultPrefs, "backfill_repeated_failures", "discord")).toBe(false);
    expect(shouldNotify(defaultPrefs, "backfill_repeated_failures", "email")).toBe(false);
  });

  it("returns true for unknown alerts (default allow)", () => {
    expect(shouldNotify(defaultPrefs, "unknown_alert", "slack")).toBe(true);
  });

  it("returns false for explicitly disabled channel", () => {
    const prefs = {
      ...defaultPrefs,
      redis_disconnected: { slack: true, discord: false, email: false },
    };
    expect(shouldNotify(prefs, "redis_disconnected", "discord")).toBe(false);
    expect(shouldNotify(prefs, "redis_disconnected", "email")).toBe(false);
  });
});

// ── Shared tests ──

describe("escapeHtml", () => {
  let escapeHtml: (text: string) => string;

  beforeEach(async () => {
    const mod = await import("../lib/notifications/shared");
    escapeHtml = mod.escapeHtml;
  });

  it("escapes ampersands", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes angle brackets", () => {
    expect(escapeHtml("<script>alert('xss')</script>")).toBe(
      "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;",
    );
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('he said "hello"')).toBe("he said &quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s");
  });

  it("handles plain text without modification", () => {
    expect(escapeHtml("Hello, world!")).toBe("Hello, world!");
  });

  it("handles empty string", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("escapes all special characters together", () => {
    expect(escapeHtml('<a href="test" onclick="xss">Click & Run</a>')).toBe(
      "&lt;a href=&quot;test&quot; onclick=&quot;xss&quot;&gt;Click &amp; Run&lt;/a&gt;",
    );
  });
});

describe("getDashboardUrl", () => {
  let getDashboardUrl: () => string;

  beforeEach(async () => {
    const mod = await import("../lib/notifications/shared");
    getDashboardUrl = mod.getDashboardUrl;
  });

  it("falls back to localhost when no env vars are set", () => {
    // Ensure env vars are not set
    const originalNexusUrl = process.env.NEXUS_URL;
    const originalVercelUrl = process.env.VERCEL_URL;
    delete process.env.NEXUS_URL;
    delete process.env.VERCEL_URL;

    const url = getDashboardUrl();

    expect(url).toBe("http://localhost:3000/status");

    // Restore
    if (originalNexusUrl) process.env.NEXUS_URL = originalNexusUrl;
    if (originalVercelUrl) process.env.VERCEL_URL = originalVercelUrl;
  });

  it("uses NEXUS_URL when set", () => {
    const original = process.env.NEXUS_URL;
    process.env.NEXUS_URL = "nexus.example.com";

    const url = getDashboardUrl();

    expect(url).toBe("https://nexus.example.com/status");

    if (original) process.env.NEXUS_URL = original;
    else delete process.env.NEXUS_URL;
  });

  it("uses VERCEL_URL as fallback", () => {
    const originalNexus = process.env.NEXUS_URL;
    const originalVercel = process.env.VERCEL_URL;
    delete process.env.NEXUS_URL;
    process.env.VERCEL_URL = "nexus-vercel.vercel.app";

    const url = getDashboardUrl();

    expect(url).toBe("https://nexus-vercel.vercel.app/status");

    if (originalNexus) process.env.NEXUS_URL = originalNexus;
    else delete process.env.NEXUS_URL;
    if (originalVercel) process.env.VERCEL_URL = originalVercel;
    else delete process.env.VERCEL_URL;
  });
});
