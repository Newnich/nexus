/**
 * Integration tests for lib/notifications/cooldown.ts
 *
 * Tests Redis-dependent functions (loadCooldowns, saveCooldowns,
 * resetCooldowns, getCooldownSeconds) using a mocked Redis connection.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the Redis module before importing the module under test
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  quit: vi.fn(),
};

vi.mock("../lib/queue/config", () => ({
  getRedisConnection: vi.fn(() => mockRedis),
  closeRedisConnection: vi.fn(),
}));

const { loadCooldowns, saveCooldowns, resetCooldowns, getCooldownSeconds, DEFAULT_COOLDOWNS } =
  await import("../lib/notifications/cooldown");

describe("loadCooldowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when no saved config exists", async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await loadCooldowns();

    expect(result).toEqual(DEFAULT_COOLDOWNS);
    expect(mockRedis.get).toHaveBeenCalledWith("nexus:notification:cooldowns");
  });

  it("returns parsed config from Redis", async () => {
    const saved = { slack: 15, discord: 60, email: 120 };
    mockRedis.get.mockResolvedValue(JSON.stringify(saved));

    const result = await loadCooldowns();

    expect(result).toEqual(saved);
  });

  it("sanitizes out-of-range values", async () => {
    const bad = { slack: -5, discord: 9999, email: 0 };
    mockRedis.get.mockResolvedValue(JSON.stringify(bad));

    const result = await loadCooldowns();

    expect(result.slack).toBe(30); // -5 < 1, falls back to default
    expect(result.discord).toBe(30); // 9999 > 1440, falls back to default
    expect(result.email).toBe(30); // 0 < 1, falls back to default
  });

  it("falls back to defaults on JSON parse error", async () => {
    mockRedis.get.mockResolvedValue("not valid json");

    const result = await loadCooldowns();

    expect(result).toEqual(DEFAULT_COOLDOWNS);
  });

  it("falls back to defaults when Redis throws", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis connection refused"));

    const result = await loadCooldowns();

    expect(result).toEqual(DEFAULT_COOLDOWNS);
  });
});

describe("saveCooldowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue("OK");
  });

  it("saves valid config to Redis", async () => {
    const result = await saveCooldowns(DEFAULT_COOLDOWNS);

    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "nexus:notification:cooldowns",
      JSON.stringify(DEFAULT_COOLDOWNS),
    );
  });

  it("sanitizes before saving", async () => {
    await saveCooldowns({ slack: -10 } as any);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "nexus:notification:cooldowns",
      JSON.stringify({ slack: 30, discord: 30, email: 30 }),
    );
  });

  it("returns false when Redis set fails", async () => {
    mockRedis.set.mockRejectedValue(new Error("Failed"));

    const result = await saveCooldowns(DEFAULT_COOLDOWNS);

    expect(result).toBe(false);
  });

  it("fills in missing fields with defaults", async () => {
    await saveCooldowns({ discord: 100 } as any);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "nexus:notification:cooldowns",
      JSON.stringify({ slack: 30, discord: 100, email: 30 }),
    );
  });
});

describe("resetCooldowns", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.del.mockResolvedValue(1);
  });

  it("deletes the cooldown key from Redis", async () => {
    const result = await resetCooldowns();

    expect(result).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith("nexus:notification:cooldowns");
  });

  it("returns false when Redis del fails", async () => {
    mockRedis.del.mockRejectedValue(new Error("Failed"));

    const result = await resetCooldowns();

    expect(result).toBe(false);
  });
});

describe("getCooldownSeconds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns cooldown in seconds (minutes * 60)", async () => {
    mockRedis.get.mockResolvedValue(JSON.stringify({ slack: 30, discord: 30, email: 30 }));

    const result = await getCooldownSeconds("slack");

    expect(result).toBe(1800); // 30 * 60
  });

  it("uses defaults when no saved config", async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await getCooldownSeconds("discord");

    expect(result).toBe(1800); // default 30 * 60
  });
});
