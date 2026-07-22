/**
 * Notification Preferences
 *
 * Stores per-alert, per-channel toggle preferences in Redis.
 * Controls which system alerts trigger notifications on which channels.
 *
 * Structure:
 *   nexus:notification:preferences → JSON string
 *   {
 *     "redis_disconnected":     { "slack": true, "discord": true, "email": true },
 *     "backfill_repeated_failures": { "slack": true, "discord": true, "email": false },
 *     ...
 *   }
 *
 * Default: all alerts enabled for all channels (existing behavior).
 */

import { getRedisConnection } from "@/lib/queue/config";

// ── Constants ──

export type ChannelId = "slack" | "discord" | "email";

/** All channel IDs (defined once for reuse) */
export const ALL_CHANNEL_KEYS: ChannelId[] = ["slack", "discord", "email"];

/** Per-channel default (all enabled) */
const ALL_CHANNELS: Record<ChannelId, boolean> = {
  slack: true,
  discord: true,
  email: true,
};

/** All known alert IDs that can trigger notifications */
export const ALERT_IDS = [
  "redis_disconnected",
  "backfill_repeated_failures",
  "backfill_enqueue_errors",
  "worker_inactive",
  "worker_no_successful_run",
  "large_backlog",
] as const;

export type AlertId = (typeof ALERT_IDS)[number];

/** Mapping: alertId → { channelId → enabled } */
export type NotificationPreferences = Record<AlertId, Record<ChannelId, boolean>>;

/** Default preferences — all alerts sent to all channels */
export function getDefaultPreferences(): NotificationPreferences {
  const prefs: Partial<NotificationPreferences> = {};
  for (const id of ALERT_IDS) {
    prefs[id] = { ...ALL_CHANNELS };
  }
  return prefs as NotificationPreferences;
}

// ── Redis key ──

const PREFERENCES_KEY = "nexus:notification:preferences";

// ── Load / Save ──

/**
 * Load notification preferences from Redis.
 * Falls back to defaults if no saved preferences exist.
 */
export async function loadPreferences(): Promise<NotificationPreferences> {
  try {
    const redis = getRedisConnection();
    const raw = await redis.get(PREFERENCES_KEY);
    if (!raw) return getDefaultPreferences();

    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    // Merge with defaults to ensure all keys exist
    const defaults = getDefaultPreferences();
    for (const id of ALERT_IDS) {
      if (!parsed[id]) {
        parsed[id] = { ...ALL_CHANNELS };
      } else {
        // Ensure all channel keys exist for this alert
        for (const ch of ALL_CHANNEL_KEYS) {
          if (typeof parsed[id]![ch] !== "boolean") {
            parsed[id]![ch] = true;
          }
        }
      }
    }
    return parsed as NotificationPreferences;
  } catch (err) {
    console.error("[NotificationPreferences] Failed to load, using defaults:", err);
    return getDefaultPreferences();
  }
}

/**
 * Save notification preferences to Redis.
 */
export async function savePreferences(prefs: NotificationPreferences): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    await redis.set(PREFERENCES_KEY, JSON.stringify(prefs));
    return true;
  } catch (err) {
    console.error("[NotificationPreferences] Failed to save:", err);
    return false;
  }
}

/**
 * Check if a given alert should be sent to a given channel.
 * Used by the notification dispatcher to filter alerts per channel.
 */
export function shouldNotify(
  prefs: NotificationPreferences,
  alertId: string,
  channel: ChannelId,
): boolean {
  const alertPrefs = prefs[alertId as AlertId];
  if (!alertPrefs) return true; // Unknown alerts default to allowed
  return alertPrefs[channel] !== false;
}
