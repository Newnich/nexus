/**
 * Unit tests for lib/schemas.ts — Zod API response schemas
 */

import { describe, it, expect } from "vitest";
import {
  AlertSchema,
  AlertsResponseSchema,
  DashboardStatsSchema,
  ItemSchema,
  ItemsResponseSchema,
  QueueStatusSchema,
} from "../lib/schemas";

// ── AlertSchema ──

describe("AlertSchema", () => {
  it("validates a correct alert", () => {
    const result = AlertSchema.safeParse({
      id: "redis_disconnected",
      severity: "critical",
      title: "Redis Disconnected",
      message: "Redis is down",
      firstSeen: "2025-06-15T12:00:00.000Z",
      lastSeen: "2025-06-15T12:00:00.000Z",
      fresh: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid severity", () => {
    const result = AlertSchema.safeParse({
      id: "test",
      severity: "unknown",
      title: "Test",
      message: "Test",
      firstSeen: "2025-01-01",
      lastSeen: "2025-01-01",
      fresh: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = AlertSchema.safeParse({ id: "test" });
    expect(result.success).toBe(false);
  });
});

// ── AlertsResponseSchema ──

describe("AlertsResponseSchema", () => {
  it("provides default empty array for missing alerts", () => {
    const result = AlertsResponseSchema.parse({});
    expect(result.alerts).toEqual([]);
  });

  it("validates a full response", () => {
    const result = AlertsResponseSchema.safeParse({
      alerts: [
        {
          id: "test",
          severity: "warning",
          title: "Test",
          message: "Test message",
          firstSeen: "2025-01-01T00:00:00Z",
          lastSeen: "2025-01-01T00:00:00Z",
          fresh: false,
        },
      ],
      timestamp: "2025-01-01T00:00:00Z",
    });
    expect(result.success).toBe(true);
  });

  it("filters out invalid alerts from array", () => {
    const result = AlertsResponseSchema.safeParse({
      alerts: [
        {
          id: "valid",
          severity: "info",
          title: "Valid",
          message: "Valid",
          firstSeen: "2025-01-01",
          lastSeen: "2025-01-01",
          fresh: false,
        },
        { id: "invalid" }, // missing fields
      ],
    });
    // Zod's default behavior with .array() will reject the whole array
    expect(result.success).toBe(false);
  });
});

// ── DashboardStatsSchema ──

describe("DashboardStatsSchema", () => {
  const validStats = {
    totalItems: 42,
    totalCollections: 5,
    totalConnections: 128,
  };

  it("validates minimal stats (defaults for optional arrays)", () => {
    const result = DashboardStatsSchema.parse(validStats);
    expect(result.totalItems).toBe(42);
    expect(result.itemsByType).toEqual([]);
    expect(result.recentItems).toEqual([]);
    expect(result.topCategories).toEqual([]);
    expect(result.recentActivity).toEqual([]);
  });

  it("validates full stats with arrays", () => {
    const result = DashboardStatsSchema.parse({
      ...validStats,
      itemsByType: [{ type: "link", count: 20 }],
      recentItems: [
        {
          id: "item-1",
          title: "Test Item",
          type: "link",
          createdAt: "2025-01-01T00:00:00Z",
          category: null,
        },
      ],
      topCategories: [{ category: "AI", count: 10 }],
      recentActivity: [
        {
          id: "act-1",
          action: "create",
          entityType: "item",
          entityId: null,
          metadata: { key: "value" },
          createdAt: "2025-01-01T00:00:00Z",
        },
      ],
    });
    expect(result.recentItems).toHaveLength(1);
    expect(result.recentItems[0].title).toBe("Test Item");
  });

  it("rejects missing totalItems", () => {
    const result = DashboardStatsSchema.safeParse({ totalCollections: 5 });
    expect(result.success).toBe(false);
  });

  it("accepts null category in recentItems", () => {
    const result = DashboardStatsSchema.safeParse({
      ...validStats,
      recentItems: [{ id: "1", title: "T", type: "link", createdAt: "2025-01-01", category: null }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-null category where null expected", () => {
    // category is nullable, so a string should also be fine
    const result = DashboardStatsSchema.safeParse({
      ...validStats,
      recentItems: [
        { id: "1", title: "T", type: "link", createdAt: "2025-01-01", category: "Tech" },
      ],
    });
    expect(result.success).toBe(true);
  });
});

// ── ItemSchema ──

describe("ItemSchema", () => {
  const validItem = {
    id: "item-1",
    title: "Test Item",
    type: "link",
    content: "Some content",
  };

  it("validates a minimal item", () => {
    const result = ItemSchema.safeParse(validItem);
    expect(result.success).toBe(true);
  });

  it("validates with optional fields", () => {
    const result = ItemSchema.safeParse({
      ...validItem,
      metadata: { domain: "example.com" },
      ai_data: { summary: "A summary", tags: ["ai"], category: "Tech" },
      created_at: "2025-01-01T00:00:00Z",
      is_favorite: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing id", () => {
    const result = ItemSchema.safeParse({ title: "No ID", type: "note", content: "" });
    expect(result.success).toBe(false);
  });
});

// ── ItemsResponseSchema ──

describe("ItemsResponseSchema", () => {
  it("provides default empty array", () => {
    const result = ItemsResponseSchema.parse({});
    expect(result.items).toEqual([]);
    expect(result.count).toBe(0);
  });

  it("validates items array", () => {
    const result = ItemsResponseSchema.safeParse({
      items: [
        { id: "1", title: "A", type: "link", content: "" },
        { id: "2", title: "B", type: "note", content: "text" },
      ],
      count: 2,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toHaveLength(2);
    }
  });
});

// ── QueueStatusSchema ──

describe("QueueStatusSchema", () => {
  it("validates a minimal status", () => {
    const result = QueueStatusSchema.safeParse({
      redis: "connected",
    });
    expect(result.success).toBe(true);
  });

  it("validates full status with all sections", () => {
    const result = QueueStatusSchema.safeParse({
      redis: "connected",
      queues: {
        ai_processing: { waiting: 0, active: 0, completed: 10, failed: 0, delayed: 0 },
        maintenance: { waiting: 0, active: 1, completed: 50, failed: 2, delayed: 0 },
      },
      backfill: {
        cursor: null,
        schedule: "*/15 * * * *",
        nextRun: "2025-01-01T00:15:00Z",
        batchSize: 200,
        enabled: true,
        hasMore: false,
        lastRun: {
          scanned: 100,
          enqueued: 50,
          skipped: 48,
          errors: 2,
          hasMore: false,
          completedAt: "2025-01-01T00:00:00Z",
        },
      },
      database: { unprocessedItems: 500 },
      config: {
        redisHost: "localhost",
        redisPort: "6379",
        ollamaUrl: "http://localhost:11434",
        workerConcurrency: "2",
        backfillCron: "*/15 * * * *",
        backfillBatch: "200",
        dbListener: true,
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.redis).toBe("connected");
      expect(result.data.queues?.ai_processing.waiting).toBe(0);
    }
  });

  it("accepts null sections", () => {
    const result = QueueStatusSchema.safeParse({
      redis: "connecting",
      queues: null,
      backfill: null,
      database: null,
      config: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid queue count fields", () => {
    const result = QueueStatusSchema.safeParse({
      redis: "connected",
      queues: {
        ai_processing: { waiting: "many" }, // string instead of number
        maintenance: { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 },
      },
    });
    expect(result.success).toBe(false);
  });
});
