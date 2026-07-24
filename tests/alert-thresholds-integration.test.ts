/**
 * Integration tests for lib/queue/alert-thresholds.ts
 *
 * Tests Redis-dependent functions (loadAlertThresholds, saveAlertThresholds,
 * resetAlertThresholds) using a mocked Redis connection.
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

// Import after mocking
const { loadAlertThresholds, saveAlertThresholds, resetAlertThresholds, DEFAULT_THRESHOLDS } =
  await import("../lib/queue/alert-thresholds");

describe("loadAlertThresholds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns defaults when no saved thresholds exist", async () => {
    mockRedis.get.mockResolvedValue(null);

    const result = await loadAlertThresholds();

    expect(result).toEqual(DEFAULT_THRESHOLDS);
    expect(mockRedis.get).toHaveBeenCalledWith("nexus:alert:thresholds");
  });

  it("returns parsed thresholds from Redis", async () => {
    const saved = {
      consecutiveFailuresThreshold: 5,
      workerInactivityHours: 4,
      backlogThreshold: 2000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(saved));

    const result = await loadAlertThresholds();

    expect(result).toEqual(saved);
  });

  it("sanitizes out-of-range values", async () => {
    const bad = {
      consecutiveFailuresThreshold: 999,
      workerInactivityHours: -1,
      backlogThreshold: 50000,
    };
    mockRedis.get.mockResolvedValue(JSON.stringify(bad));

    const result = await loadAlertThresholds();

    // Values above max are clamped to their respective defaults
    expect(result.consecutiveFailuresThreshold).toBe(3); // 999 > 50, falls back to default
    expect(result.workerInactivityHours).toBe(2); // -1 < 0.5, falls back to default
    expect(result.backlogThreshold).toBe(50000); // within range [10, 100000]
  });

  it("falls back to defaults on JSON parse error", async () => {
    mockRedis.get.mockResolvedValue("not valid json");

    const result = await loadAlertThresholds();

    expect(result).toEqual(DEFAULT_THRESHOLDS);
  });

  it("falls back to defaults when Redis throws", async () => {
    mockRedis.get.mockRejectedValue(new Error("Redis connection refused"));

    const result = await loadAlertThresholds();

    expect(result).toEqual(DEFAULT_THRESHOLDS);
  });
});

describe("saveAlertThresholds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.set.mockResolvedValue("OK");
  });

  it("saves valid thresholds to Redis", async () => {
    const result = await saveAlertThresholds(DEFAULT_THRESHOLDS);

    expect(result).toBe(true);
    expect(mockRedis.set).toHaveBeenCalledWith(
      "nexus:alert:thresholds",
      JSON.stringify(DEFAULT_THRESHOLDS),
    );
  });

  it("sanitizes before saving", async () => {
    await saveAlertThresholds({ consecutiveFailuresThreshold: -5 } as any);

    // Should have been sanitized to default
    expect(mockRedis.set).toHaveBeenCalledWith(
      "nexus:alert:thresholds",
      JSON.stringify({
        consecutiveFailuresThreshold: 3, // default since -5 < min
        workerInactivityHours: 2,
        backlogThreshold: 1000,
      }),
    );
  });

  it("returns false when Redis set fails", async () => {
    mockRedis.set.mockRejectedValue(new Error("Failed"));

    const result = await saveAlertThresholds(DEFAULT_THRESHOLDS);

    expect(result).toBe(false);
  });

  it("fills in missing fields with defaults", async () => {
    await saveAlertThresholds({ backlogThreshold: 5000 } as any);

    expect(mockRedis.set).toHaveBeenCalledWith(
      "nexus:alert:thresholds",
      JSON.stringify({
        consecutiveFailuresThreshold: 3,
        workerInactivityHours: 2,
        backlogThreshold: 5000,
      }),
    );
  });
});

describe("resetAlertThresholds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.del.mockResolvedValue(1);
  });

  it("deletes the threshold key from Redis", async () => {
    const result = await resetAlertThresholds();

    expect(result).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith("nexus:alert:thresholds");
  });

  it("returns false when Redis del fails", async () => {
    mockRedis.del.mockRejectedValue(new Error("Failed"));

    const result = await resetAlertThresholds();

    expect(result).toBe(false);
  });
});
