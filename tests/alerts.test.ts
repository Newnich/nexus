/**
 * Unit tests for lib/queue/alerts.ts — evaluateAlertsWithThresholds
 *
 * Tests all alert conditions and the `fresh` flag behavior using the pure
 * function that doesn't require a Redis connection.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { evaluateAlertsWithThresholds } from "../lib/queue/alerts";

// ── Fixed timestamps ──

const NOW_ISO = "2025-06-15T12:00:00.000Z";
const NOW_MS = new Date(NOW_ISO).getTime();

// ── Mock Date.now for deterministic tests ──

let origDateNow: typeof Date.now;

beforeAll(() => {
  origDateNow = Date.now;
  Date.now = () => NOW_MS;
});

afterAll(() => {
  Date.now = origDateNow;
});

// ── Default thresholds ──

const THRESHOLDS = {
  consecutiveFailuresThreshold: 3,
  workerInactivityHours: 2,
  backlogThreshold: 1000,
};

// ── Helpers ──

function healthyStatus() {
  return {
    redis: "connected",
    backfillErrors: 0,
    consecutiveFailures: 0,
    unprocessedItems: 50,
    lastBackfillRun: {
      completedAt: new Date(NOW_MS - 30 * 60 * 1000).toISOString(), // 30 min ago
      hasErrors: false,
    },
    backfillEnabled: true,
  };
}

// ── Tests ──

describe("evaluateAlertsWithThresholds", () => {
  it("returns no alerts for a healthy system", () => {
    const alerts = evaluateAlertsWithThresholds(healthyStatus(), THRESHOLDS, new Set(), NOW_ISO);
    expect(alerts.length).toBe(0);
  });

  it("returns critical alert when Redis is disconnected", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "disconnected" },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "redis_disconnected");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
    expect(alert!.message).toContain("disconnected");
  });

  it("returns critical alert when Redis connection is 'error'", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "error" },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "redis_disconnected");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("critical");
  });

  it("does NOT return redis alert when Redis is connected", () => {
    const alerts = evaluateAlertsWithThresholds(healthyStatus(), THRESHOLDS, new Set(), NOW_ISO);
    expect(alerts.filter((a) => a.id === "redis_disconnected").length).toBe(0);
  });

  it("returns warning alert when consecutive failures exceed threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), consecutiveFailures: 5 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "backfill_repeated_failures");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning");
    expect(alert!.message).toContain("5");
  });

  it("does NOT trigger backfill_repeated_failures when failures are below threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), consecutiveFailures: 2 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "backfill_repeated_failures");
    expect(alert).toBeUndefined();
  });

  it("returns warning alert when backfill errors > 0", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), backfillErrors: 3 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "backfill_enqueue_errors");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning");
    expect(alert!.message).toContain("3");
  });

  it("returns warning alert when worker is inactive (hoursSinceLastRun > threshold)", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        lastBackfillRun: {
          completedAt: new Date(NOW_MS - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
          hasErrors: false,
        },
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "worker_inactive");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning");
    expect(alert!.message).toContain("5 hours ago");
  });

  it("does NOT return worker_inactive when lastBackfillRun was recent", () => {
    const alerts = evaluateAlertsWithThresholds(healthyStatus(), THRESHOLDS, new Set(), NOW_ISO);
    const alert = alerts.find((a) => a.id === "worker_inactive");
    expect(alert).toBeUndefined();
  });

  it("returns warning when no successful run and failures > 0", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        lastBackfillRun: null,
        consecutiveFailures: 2,
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "worker_no_successful_run");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("warning");
    expect(alert!.message).toContain("2");
  });

  it("does NOT return worker_no_successful_run when failures are 0", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), lastBackfillRun: null, consecutiveFailures: 0 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "worker_no_successful_run");
    expect(alert).toBeUndefined();
  });

  it("does NOT return worker_no_successful_run when backfill is disabled", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        backfillEnabled: false,
        lastBackfillRun: null,
        consecutiveFailures: 5,
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "worker_no_successful_run");
    expect(alert).toBeUndefined();
  });

  it("returns info alert when unprocessed items exceed backlog threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: 1500 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "large_backlog");
    expect(alert).toBeDefined();
    expect(alert!.severity).toBe("info");
  });

  it("does NOT return large_backlog when unprocessed is within threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: 500 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "large_backlog");
    expect(alert).toBeUndefined();
  });

  it("does NOT return large_backlog when unprocessedItems is null", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: null },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "large_backlog");
    expect(alert).toBeUndefined();
  });

  it("sets fresh=true for newly triggered alerts", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "disconnected" },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "redis_disconnected")!;
    expect(alert.fresh).toBe(true);
  });

  it("sets fresh=false for previously existing alerts", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "disconnected" },
      THRESHOLDS,
      new Set(["redis_disconnected"]),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "redis_disconnected")!;
    expect(alert.fresh).toBe(false);
  });

  it("can trigger multiple alerts simultaneously", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        redis: "error",
        backfillErrors: 5,
        consecutiveFailures: 10,
        unprocessedItems: 5000,
        lastBackfillRun: {
          completedAt: new Date(NOW_MS - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
          hasErrors: true,
        },
        backfillEnabled: true,
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );

    const ids = new Set(alerts.map((a) => a.id));
    expect(ids.has("redis_disconnected")).toBe(true);
    expect(ids.has("backfill_repeated_failures")).toBe(true);
    expect(ids.has("backfill_enqueue_errors")).toBe(true);
    expect(ids.has("worker_inactive")).toBe(true);
    expect(ids.has("large_backlog")).toBe(true);
  });

  it("includes required fields on each alert", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "disconnected" },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts[0];
    expect(alert.id).toBeDefined();
    expect(alert.severity).toBeDefined();
    expect(alert.title).toBeDefined();
    expect(alert.message).toBeDefined();
    expect(alert.firstSeen).toBe(NOW_ISO);
    expect(alert.lastSeen).toBe(NOW_ISO);
    expect(typeof alert.fresh).toBe("boolean");
  });

  it("returns empty array for backfill disabled with all metrics normal", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        redis: "connected",
        backfillErrors: 0,
        consecutiveFailures: 0,
        unprocessedItems: 100,
        lastBackfillRun: {
          completedAt: new Date().toISOString(),
          hasErrors: false,
        },
        backfillEnabled: false,
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    expect(alerts.length).toBe(0);
  });

  it("honors custom thresholds", () => {
    // With a very high consecutiveFailuresThreshold, even 10 failures won't trigger
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), consecutiveFailures: 10 },
      { ...THRESHOLDS, consecutiveFailuresThreshold: 20 },
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "backfill_repeated_failures");
    expect(alert).toBeUndefined();
  });

  // ── Edge case: boundary values ──

  it("triggers backlog alert above threshold boundary", () => {
    // Condition is > not >=, so need 1001, not 1000
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: 1001 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "large_backlog");
    expect(alert).toBeDefined();
  });

  it("does NOT trigger backlog just below threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: 999 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "large_backlog");
    expect(alert).toBeUndefined();
  });

  it("triggers inactivity alert above threshold boundary", () => {
    // Condition is > not >=, so need just above 2 hours
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        lastBackfillRun: {
          completedAt: new Date(NOW_MS - 2.001 * 60 * 60 * 1000).toISOString(), // slightly over 2 hours ago
          hasErrors: false,
        },
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "worker_inactive");
    expect(alert).toBeDefined();
    expect(alert!.message).toContain("2 hours ago");
  });

  it("does NOT trigger inactivity just below threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        lastBackfillRun: {
          completedAt: new Date(NOW_MS - 1.99 * 60 * 60 * 1000).toISOString(), // ~1.99 hours ago
          hasErrors: false,
        },
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "worker_inactive");
    expect(alert).toBeUndefined();
  });

  it("triggers failure alert at exact threshold", () => {
    // consecutiveFailuresThreshold = 3, so exactly 3 should trigger
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), consecutiveFailures: 3 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "backfill_repeated_failures");
    expect(alert).toBeDefined();
  });

  it("does NOT trigger failure just below threshold", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), consecutiveFailures: 2 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "backfill_repeated_failures");
    expect(alert).toBeUndefined();
  });

  // ── Edge case: Redis health states ──

  it("does NOT trigger redis alert when redis is 'ready'", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "ready" },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    expect(alerts.filter((a) => a.id === "redis_disconnected").length).toBe(0);
  });

  it("triggers redis alert when redis is 'connecting'", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), redis: "connecting" },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    expect(alerts.find((a) => a.id === "redis_disconnected")).toBeDefined();
  });

  it("triggers redis alert when redis is 'end' or 'closing'", () => {
    for (const state of ["end", "closing", "reconnecting"]) {
      const alerts = evaluateAlertsWithThresholds(
        { ...healthyStatus(), redis: state },
        THRESHOLDS,
        new Set(),
        NOW_ISO,
      );
      expect(alerts.find((a) => a.id === "redis_disconnected")).toBeDefined();
    }
  });

  // ── Edge case: lastBackfillRun states ──

  it("does NOT trigger worker_inactive when lastBackfillRun has null completedAt", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        lastBackfillRun: {
          completedAt: null,
          hasErrors: false,
        },
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    // null completedAt means no timestamp to compare — can't compute inactivity
    expect(alerts.find((a) => a.id === "worker_inactive")).toBeUndefined();
  });

  it("does NOT trigger worker_no_successful_run when failures are 0 and no lastBackfillRun", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        backfillEnabled: true,
        lastBackfillRun: null,
        consecutiveFailures: 0,
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    expect(alerts.find((a) => a.id === "worker_no_successful_run")).toBeUndefined();
  });

  // ── Edge case: backfill disabled with various states ──

  it("suppresses worker_inactive and worker_no_successful_run when backfill is disabled", () => {
    // Note: backfill_repeated_failures and backfill_enqueue_errors are NOT suppressed
    // by backfillEnabled because they don't check that flag — only worker_inactive
    // and worker_no_successful_run check backfillEnabled.
    const alerts = evaluateAlertsWithThresholds(
      {
        redis: "connected",
        backfillErrors: 10,
        consecutiveFailures: 10,
        unprocessedItems: 500,
        lastBackfillRun: null,
        backfillEnabled: false,
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    // worker_inactive and worker_no_successful_run check backfillEnabled
    expect(alerts.find((a) => a.id === "worker_inactive")).toBeUndefined();
    expect(alerts.find((a) => a.id === "worker_no_successful_run")).toBeUndefined();
    // backfill_repeated_failures and backfill_enqueue_errors don't check backfillEnabled
    expect(alerts.find((a) => a.id === "backfill_repeated_failures")).toBeDefined();
    expect(alerts.find((a) => a.id === "backfill_enqueue_errors")).toBeDefined();
  });

  // ── Edge case: concurrent alert lifecycle ──

  it("marks previously fresh alert as not fresh on second evaluation", () => {
    const status = { ...healthyStatus(), redis: "disconnected" };
    const firstRun = evaluateAlertsWithThresholds(status, THRESHOLDS, new Set(), NOW_ISO);
    const firstAlert = firstRun.find((a) => a.id === "redis_disconnected")!;
    expect(firstAlert.fresh).toBe(true);

    // Second evaluation with previous alert IDs
    const prevIds = new Set(firstRun.map((a) => a.id));
    const secondRun = evaluateAlertsWithThresholds(status, THRESHOLDS, prevIds, NOW_ISO);
    const secondAlert = secondRun.find((a) => a.id === "redis_disconnected")!;
    expect(secondAlert.fresh).toBe(false);
  });

  it("marks a recurring alert as fresh again after it clears and returns", () => {
    // First: trigger redis_disconnected
    const status1 = { ...healthyStatus(), redis: "disconnected" };
    const run1 = evaluateAlertsWithThresholds(status1, THRESHOLDS, new Set(), NOW_ISO);
    expect(run1.find((a) => a.id === "redis_disconnected")!.fresh).toBe(true);

    // Second: redis recovers
    const run2 = evaluateAlertsWithThresholds(
      healthyStatus(),
      THRESHOLDS,
      new Set(run1.map((a) => a.id)),
      NOW_ISO,
    );
    expect(run2.find((a) => a.id === "redis_disconnected")).toBeUndefined();

    // Third: redis fails again — should be fresh again
    const run3 = evaluateAlertsWithThresholds(status1, THRESHOLDS, new Set(), NOW_ISO);
    expect(run3.find((a) => a.id === "redis_disconnected")!.fresh).toBe(true);
  });

  // ── Edge case: empty / null unprocessedItems ──

  it("does NOT trigger backlog when unprocessedItems is 0", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: 0 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    expect(alerts.find((a) => a.id === "large_backlog")).toBeUndefined();
  });

  it("handles extremely large unprocessedItems", () => {
    const alerts = evaluateAlertsWithThresholds(
      { ...healthyStatus(), unprocessedItems: 1_000_000 },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    const alert = alerts.find((a) => a.id === "large_backlog");
    expect(alert).toBeDefined();
    expect(alert!.message).toContain("1,000,000");
  });

  // ── Edge case: worker_inactive with backfill disabled but lastBackfillRun exists ──

  it("does NOT trigger worker_inactive when backfill is disabled even if lastBackfillRun is old", () => {
    const alerts = evaluateAlertsWithThresholds(
      {
        ...healthyStatus(),
        backfillEnabled: false,
        lastBackfillRun: {
          completedAt: new Date(NOW_MS - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
          hasErrors: false,
        },
      },
      THRESHOLDS,
      new Set(),
      NOW_ISO,
    );
    expect(alerts.find((a) => a.id === "worker_inactive")).toBeUndefined();
  });
});
