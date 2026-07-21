/**
 * Alert Thresholds
 *
 * Configurable numeric thresholds for system alert conditions.
 * Stored in Redis as a JSON object. Falls back to defaults if not set.
 *
 * Thresholds:
 *   consecutiveFailuresThreshold  - Min consecutive backfill failures before alerting (default: 3)
 *   workerInactivityHours         - Hours of no backfill run before alerting (default: 2)
 *   backlogThreshold              - Unprocessed item count before backlog alert (default: 1000)
 *
 * Redis key: nexus:alert:thresholds
 * Structure: { consecutiveFailuresThreshold: 3, workerInactivityHours: 2, backlogThreshold: 1000 }
 */

import { getRedisConnection } from "./config";

// ── Types ──

export interface AlertThresholds {
  /** Min consecutive backfill failures before triggering backfill_repeated_failures (default: 3) */
  consecutiveFailuresThreshold: number;
  /** Hours of no successful backfill run before triggering worker_inactive (default: 2) */
  workerInactivityHours: number;
  /** Unprocessed item count before triggering large_backlog (default: 1000) */
  backlogThreshold: number;
}

// ── Defaults ──

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  consecutiveFailuresThreshold: 3,
  workerInactivityHours: 2,
  backlogThreshold: 1000,
};

// ── Redis key ──

const THRESHOLDS_KEY = "nexus:alert:thresholds";

// ── Helpers ──

function clamp(value: number, min: number, max: number, fallback: number): number {
  if (isNaN(value) || value < min || value > max) return fallback;
  return Math.round(value);
}

function sanitize(raw: Partial<AlertThresholds>): AlertThresholds {
  return {
    consecutiveFailuresThreshold: clamp(
      raw.consecutiveFailuresThreshold ?? DEFAULT_THRESHOLDS.consecutiveFailuresThreshold,
      1, 50, DEFAULT_THRESHOLDS.consecutiveFailuresThreshold
    ),
    workerInactivityHours: clamp(
      raw.workerInactivityHours ?? DEFAULT_THRESHOLDS.workerInactivityHours,
      0.5, 168, DEFAULT_THRESHOLDS.workerInactivityHours // 0.5h to 7 days
    ),
    backlogThreshold: clamp(
      raw.backlogThreshold ?? DEFAULT_THRESHOLDS.backlogThreshold,
      10, 100000, DEFAULT_THRESHOLDS.backlogThreshold
    ),
  };
}

// ── Load / Save / Reset ──

/**
 * Load alert thresholds from Redis.
 * Falls back to defaults if no saved thresholds exist.
 * Sanitizes all values to valid ranges.
 */
export async function loadAlertThresholds(): Promise<AlertThresholds> {
  try {
    const redis = getRedisConnection();
    const raw = await redis.get(THRESHOLDS_KEY);
    if (!raw) return { ...DEFAULT_THRESHOLDS };

    const parsed = JSON.parse(raw) as Partial<AlertThresholds>;
    return sanitize(parsed);
  } catch (err) {
    console.error("[AlertThresholds] Failed to load, using defaults:", err);
    return { ...DEFAULT_THRESHOLDS };
  }
}

/**
 * Save alert thresholds to Redis.
 * Sanitizes values before saving.
 */
export async function saveAlertThresholds(
  thresholds: Partial<AlertThresholds>
): Promise<boolean> {
  try {
    const sanitized = sanitize(thresholds);
    const redis = getRedisConnection();
    await redis.set(THRESHOLDS_KEY, JSON.stringify(sanitized));
    return true;
  } catch (err) {
    console.error("[AlertThresholds] Failed to save:", err);
    return false;
  }
}

/**
 * Reset alert thresholds to defaults, clearing the Redis key.
 */
export async function resetAlertThresholds(): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    await redis.del(THRESHOLDS_KEY);
    return true;
  } catch (err) {
    console.error("[AlertThresholds] Failed to reset:", err);
    return false;
  }
}
