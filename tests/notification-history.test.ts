/**
 * Unit tests for lib/notifications/history.ts — Notification History
 *
 * Tests recordNotification and getNotificationHistory by mocking Redis.
 *
 * Covers:
 *   - recordNotification stores entry in Redis sorted set
 *   - recordNotification handles Redis errors gracefully
 *   - getNotificationHistory returns parsed entries
 *   - getNotificationHistory handles corrupt JSON gracefully
 *   - getNotificationHistory handles Redis errors gracefully
 *   - MAX_HISTORY cleanup via zremrangebyrank
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock Redis (ioredis chain pattern) ──

const mockMultiExec = vi.fn();
const mockZadd = vi.fn();
const mockZremrangebyrank = vi.fn();
const mockMulti = {
  zadd: (...args: unknown[]) => {
    mockZadd(...args);
    return mockMulti;
  },
  zremrangebyrank: (...args: unknown[]) => {
    mockZremrangebyrank(...args);
    return mockMulti;
  },
  exec: mockMultiExec,
};

const mockZrevrange = vi.fn();

const mockRedis = {
  multi: () => mockMulti,
  zrevrange: mockZrevrange,
  options: {},
};

vi.mock("../lib/queue/config", () => ({
  getRedisConnection: vi.fn(() => mockRedis),
  closeRedisConnection: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockMultiExec.mockResolvedValue([]);
});

// ── recordNotification ──

describe("recordNotification", () => {
  it("stores entry in Redis sorted set with timestamp score", async () => {
    const { recordNotification } = await import("../lib/notifications/history");
    await recordNotification({
      channel: "slack",
      type: "alert",
      sent: true,
      alertId: "redis_disconnected",
    });

    expect(mockZadd).toHaveBeenCalled();
    // First arg should be the history key
    expect(mockZadd.mock.calls[0][0]).toBe("nexus:notifications:history");
    // Third arg should contain alertId
    const savedEntry = JSON.parse(mockZadd.mock.calls[0][2]);
    expect(savedEntry.channel).toBe("slack");
    expect(savedEntry.alertId).toBe("redis_disconnected");
    expect(savedEntry.sent).toBe(true);
    expect(savedEntry.timestamp).toBeDefined();
  });

  it("trims history via zremrangebyrank", async () => {
    const { recordNotification } = await import("../lib/notifications/history");
    await recordNotification({
      channel: "email",
      type: "alert",
      sent: true,
    });

    expect(mockZremrangebyrank).toHaveBeenCalledWith("nexus:notifications:history", 0, -201);
  });

  it("executes the multi command", async () => {
    const { recordNotification } = await import("../lib/notifications/history");
    await recordNotification({
      channel: "discord",
      type: "test",
      sent: false,
      error: "Network error",
    });

    expect(mockMultiExec).toHaveBeenCalled();
  });

  it("handles Redis errors gracefully (does not throw)", async () => {
    mockMultiExec.mockRejectedValue(new Error("Redis connection lost"));

    const { recordNotification } = await import("../lib/notifications/history");

    await expect(
      recordNotification({
        channel: "slack",
        type: "alert",
        sent: true,
      }),
    ).resolves.toBeUndefined();
  });
});

// ── getNotificationHistory ──

describe("getNotificationHistory", () => {
  it("returns parsed entries from Redis sorted set", async () => {
    const entries = [
      JSON.stringify({
        channel: "slack",
        type: "alert",
        sent: true,
        alertId: "redis_disconnected",
        timestamp: "2025-06-15T12:00:00.000Z",
      }),
      JSON.stringify({
        channel: "email",
        type: "test",
        sent: false,
        error: "Rate limited",
        timestamp: "2025-06-15T11:00:00.000Z",
      }),
    ];
    mockZrevrange.mockResolvedValue(entries);

    const { getNotificationHistory } = await import("../lib/notifications/history");
    const results = await getNotificationHistory(10);

    expect(results).toHaveLength(2);
    expect(results[0].channel).toBe("slack");
    expect(results[0].alertId).toBe("redis_disconnected");
    expect(results[1].channel).toBe("email");
    expect(results[1].error).toBe("Rate limited");

    expect(mockZrevrange).toHaveBeenCalledWith("nexus:notifications:history", 0, 9);
  });

  it("uses default limit of 50", async () => {
    mockZrevrange.mockResolvedValue([]);

    const { getNotificationHistory } = await import("../lib/notifications/history");
    await getNotificationHistory();

    expect(mockZrevrange).toHaveBeenCalledWith("nexus:notifications:history", 0, 49);
  });

  it("filters out entries with corrupt JSON", async () => {
    mockZrevrange.mockResolvedValue([
      JSON.stringify({
        channel: "slack",
        type: "alert",
        sent: true,
        timestamp: "2025-01-01T00:00:00Z",
      }),
      "not valid json{{{",
      JSON.stringify({
        channel: "email",
        type: "alert",
        sent: false,
        timestamp: "2025-01-02T00:00:00Z",
      }),
    ]);

    const { getNotificationHistory } = await import("../lib/notifications/history");
    const results = await getNotificationHistory();

    expect(results).toHaveLength(2);
  });

  it("returns empty array when Redis returns empty", async () => {
    mockZrevrange.mockResolvedValue([]);

    const { getNotificationHistory } = await import("../lib/notifications/history");
    const results = await getNotificationHistory();
    expect(results).toEqual([]);
  });

  it("returns empty array when Redis throws an error", async () => {
    mockZrevrange.mockRejectedValue(new Error("Redis connection refused"));

    const { getNotificationHistory } = await import("../lib/notifications/history");
    const results = await getNotificationHistory();
    expect(results).toEqual([]);
  });

  it("includes error field in history entry when present", async () => {
    mockZrevrange.mockResolvedValue([
      JSON.stringify({
        channel: "discord",
        type: "alert",
        sent: false,
        error: "HTTP 429 Too Many Requests",
        timestamp: "2025-06-15T12:00:00.000Z",
      }),
    ]);

    const { getNotificationHistory } = await import("../lib/notifications/history");
    const results = await getNotificationHistory();

    expect(results[0].error).toBe("HTTP 429 Too Many Requests");
    expect(results[0].sent).toBe(false);
  });
});
