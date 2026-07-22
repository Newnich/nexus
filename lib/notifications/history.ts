/**
 * Notification History
 *
 * Tracks sent notifications in a Redis sorted set (scored by timestamp).
 * Used by the settings page to display recent notification activity.
 *
 * Keys:
 *   nexus:notifications:history  - Sorted set of all notifications (score = epoch ms)
 *
 * Each entry is a JSON string with:
 *   channel: "slack" | "discord" | "email"
 *   type: "alert" | "test"
 *   sent: boolean
 *   alertId?: string
 *   error?: string
 *   timestamp: ISO string
 */

import { getRedisConnection } from "@/lib/queue/config";

const HISTORY_KEY = "nexus:notifications:history";
const MAX_HISTORY = 200; // Keep at most 200 entries

export interface NotificationHistoryEntry {
  channel: "slack" | "discord" | "email";
  type: "alert" | "test";
  sent: boolean;
  alertId?: string;
  error?: string;
  timestamp: string;
}

/**
 * Record a notification event in the history.
 */
export async function recordNotification(
  entry: Omit<NotificationHistoryEntry, "timestamp">,
): Promise<void> {
  try {
    const redis = getRedisConnection();
    const timestamp = Date.now();
    const fullEntry: NotificationHistoryEntry = {
      ...entry,
      timestamp: new Date(timestamp).toISOString(),
    };

    await redis
      .multi()
      .zadd(HISTORY_KEY, timestamp, JSON.stringify(fullEntry))
      .zremrangebyrank(HISTORY_KEY, 0, -(MAX_HISTORY + 1)) // Keep only newest N
      .exec();
  } catch (err) {
    console.error("[NotificationHistory] Failed to record:", err);
  }
}

/**
 * Get recent notification history entries, newest first.
 */
export async function getNotificationHistory(
  limit: number = 50,
): Promise<NotificationHistoryEntry[]> {
  try {
    const redis = getRedisConnection();
    const results = await redis.zrevrange(HISTORY_KEY, 0, limit - 1);

    return results
      .map((item) => {
        try {
          return JSON.parse(item) as NotificationHistoryEntry;
        } catch {
          return null;
        }
      })
      .filter((e): e is NotificationHistoryEntry => e !== null);
  } catch (err) {
    console.error("[NotificationHistory] Failed to fetch:", err);
    return [];
  }
}
