/**
 * System Health Alerts
 *
 * Evaluates system conditions and returns active alerts.
 * Tracks backfill failure streaks in Redis to detect repeated failures.
 *
 * Alert severities:
 *   critical - Redis down, worker not running (toast + red banner)
 *   warning  - Backfill failing repeatedly, enqueue errors (toast + yellow banner)
 *   info     - Large backlog, maintenance needed (text only)
 */

import { getRedisConnection } from "./config";
import { loadAlertThresholds } from "./alert-thresholds";

// ── Redis keys for failure tracking ──

const CONSECUTIVE_FAILURES_KEY = "nexus:alerts:backfill:consecutiveFailures";
const LAST_SUCCESS_KEY = "nexus:alerts:backfill:lastSuccess";

// ── Alert types ──

export type AlertSeverity = "critical" | "warning" | "info";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** ISO timestamp when this alert was first detected */
  firstSeen: string;
  /** ISO timestamp of last occurrence (updated each poll cycle) */
  lastSeen: string;
  /** True if this alert was just triggered (used for toast) */
  fresh: boolean;
}

// ── Failure streak tracking ──

/**
 * Increment the consecutive backfill failure counter in Redis.
 * Called by the maintenance worker when a backfill job fails.
 */
export async function incrementBackfillFailures(): Promise<number> {
  try {
    const redis = getRedisConnection();
    const count = await redis.incr(CONSECUTIVE_FAILURES_KEY);
    // Set expiry so the counter resets if worker goes quiet
    await redis.expire(CONSECUTIVE_FAILURES_KEY, 86400); // 24 hours
    return count;
  } catch {
    return 0;
  }
}

/**
 * Reset the consecutive backfill failure counter.
 * Called by the maintenance worker when a backfill job succeeds.
 */
export async function resetBackfillFailures(): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.del(CONSECUTIVE_FAILURES_KEY);
    await redis.set(LAST_SUCCESS_KEY, new Date().toISOString());
  } catch {
    // Best-effort
  }
}

/**
 * Get consecutive failure count.
 */
export async function getConsecutiveFailures(): Promise<number> {
  try {
    const redis = getRedisConnection();
    const val = await redis.get(CONSECUTIVE_FAILURES_KEY);
    return val ? parseInt(val, 10) : 0;
  } catch {
    return 0;
  }
}

/**
 * Get timestamp of last successful backfill run.
 */
async function getLastSuccessTime(): Promise<string | null> {
  try {
    const redis = getRedisConnection();
    return await redis.get(LAST_SUCCESS_KEY);
  } catch {
    return null;
  }
}

// ── Alert evaluation ──

export interface HealthStatus {
  redis: string;
  backfillErrors: number;
  consecutiveFailures: number;
  unprocessedItems: number | null;
  lastBackfillRun: {
    completedAt: string | null;
    hasErrors: boolean;
  } | null;
  backfillEnabled: boolean;
}

/**
 * Evaluate all system health conditions and return active alerts.
 * This is called by the /api/queue/alerts endpoint on each poll.
 *
 * Thresholds are loaded from Redis (falling back to defaults in alert-thresholds.ts).
 *
 * @param status - Current health status snapshot
 * @param previousAlertIds - Set of alert IDs that were active in the previous poll
 * @returns Array of active alerts with `fresh` flag set for newly triggered ones
 */
export async function evaluateAlerts(
  status: HealthStatus,
  previousAlertIds: Set<string> = new Set()
): Promise<Alert[]> {
  const now = new Date().toISOString();
  const alerts: Alert[] = [];

  // Load configurable thresholds from Redis
  const thresholds = await loadAlertThresholds();

  // ── Redis health ──
  if (status.redis !== "connected" && status.redis !== "ready") {
    alerts.push({
      id: "redis_disconnected",
      severity: "critical",
      title: "Redis Disconnected",
      message: "Redis connection is " + status.redis + ". AI processing and backfill are unavailable.",
      firstSeen: now,
      lastSeen: now,
      fresh: !previousAlertIds.has("redis_disconnected"),
    });
  }

  // ── Backfill consecutive failures ──
  if (status.consecutiveFailures >= thresholds.consecutiveFailuresThreshold) {
    alerts.push({
      id: "backfill_repeated_failures",
      severity: "warning",
      title: "Backfill Failing Repeatedly",
      message: status.consecutiveFailures + " consecutive backfill failures. Check Ollama and database connectivity.",
      firstSeen: now,
      lastSeen: now,
      fresh: !previousAlertIds.has("backfill_repeated_failures"),
    });
  }

  // ── Backfill job errors (enqueue failed) ──
  if (status.backfillErrors > 0) {
    alerts.push({
      id: "backfill_enqueue_errors",
      severity: "warning",
      title: "Backfill Enqueue Errors",
      message: status.backfillErrors + " items failed to enqueue during last backfill scan.",
      firstSeen: now,
      lastSeen: now,
      fresh: !previousAlertIds.has("backfill_enqueue_errors"),
    });
  }

  // ── Worker inactivity ──
  if (status.backfillEnabled && status.lastBackfillRun?.completedAt) {
    const hoursSinceLastRun =
      (Date.now() - new Date(status.lastBackfillRun.completedAt).getTime()) / 3600000;
    if (hoursSinceLastRun > thresholds.workerInactivityHours) {
      alerts.push({
        id: "worker_inactive",
        severity: "warning",
        title: "Worker Appears Inactive",
        message:
          "Last backfill run was " +
          Math.floor(hoursSinceLastRun) +
          " hours ago. The worker process may have stopped.",
        firstSeen: now,
        lastSeen: now,
        fresh: !previousAlertIds.has("worker_inactive"),
      });
    }
  } else if (status.backfillEnabled && !status.lastBackfillRun) {
    // Worker was just started and hasn't completed a run yet
    const failures = status.consecutiveFailures;
    if (failures > 0) {
      alerts.push({
        id: "worker_no_successful_run",
        severity: "warning",
        title: "Worker Hasn't Completed a Run",
        message:
          "The worker has " +
          failures +
          " consecutive failures and no successful runs. Check the worker logs.",
        firstSeen: now,
        lastSeen: now,
        fresh: !previousAlertIds.has("worker_no_successful_run"),
      });
    }
  }

  // ── Large backlog ──
  if (status.unprocessedItems !== null && status.unprocessedItems > thresholds.backlogThreshold) {
    alerts.push({
      id: "large_backlog",
      severity: "info",
      title: "Large Processing Backlog",
      message:
        status.unprocessedItems.toLocaleString() +
        " items are missing AI embeddings. Backfill is processing them in batches.",
      firstSeen: now,
      lastSeen: now,
      fresh: !previousAlertIds.has("large_backlog"),
    });
  }

  return alerts;
}

// ── Alert helpers ──

export function getAlertIcon(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "warning":
      return "🟡";
    case "info":
      return "🔵";
  }
}

export function getAlertBorder(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "border-red-500/30";
    case "warning":
      return "border-yellow-500/30";
    case "info":
      return "border-blue-500/30";
  }
}

export function getAlertBg(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/5";
    case "warning":
      return "bg-yellow-500/5";
    case "info":
      return "bg-blue-500/5";
  }
}
