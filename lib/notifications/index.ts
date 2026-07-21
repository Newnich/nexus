/**
 * Unified Notification Dispatcher
 *
 * Sends alert notifications to configured channels based on user preferences.
 * Each alert is checked against per-channel preferences before sending.
 * Default behavior (no saved preferences): all fresh+critical alerts go to all channels.
 *
 * Call `sendCriticalAlertNotifications(alerts)` once from the alerts route.
 */

import type { Alert } from "@/lib/queue/alerts";
import { sendCriticalAlertEmail } from "@/lib/email";
import { sendAlertToSlack, sendAlertToDiscord } from "./webhook";
import {
  loadPreferences,
  shouldNotify,
  ALL_CHANNEL_KEYS,
  type ChannelId,
} from "./preferences";

export interface NotificationResult {
  channel: "email" | "slack" | "discord";
  sent: boolean;
  alertId: string;
  error?: string;
}

/**
 * Send alert notifications to ALL configured channels, respecting preferences.
 * This is fire-and-forget — individual channel failures are logged but don't
 * affect other channels.
 */
export async function sendCriticalAlertNotifications(
  alerts: Alert[]
): Promise<NotificationResult[]> {
  // Only send fresh alerts (not recurring ones the user has already seen)
  const freshAlerts = alerts.filter((a) => a.fresh);
  if (freshAlerts.length === 0) return [];

  // Load user preferences (defaults to all enabled)
  const prefs = await loadPreferences();

  console.log(
    "[Notifications] Processing " + freshAlerts.length + " alert(s) against preferences"
  );

  const results: NotificationResult[] = [];

  // Helper: send an alert to a specific channel, handling errors
  async function sendToChannel(alert: Alert, channelId: ChannelId): Promise<NotificationResult | null> {
    if (!shouldNotify(prefs, alert.id, channelId)) return null;

    try {
      if (channelId === "slack") {
        const r = await sendAlertToSlack(alert);
        return r ? { channel: "slack", sent: r.sent, alertId: alert.id, error: r.error } : null;
      }
      if (channelId === "discord") {
        const r = await sendAlertToDiscord(alert);
        return r ? { channel: "discord", sent: r.sent, alertId: alert.id, error: r.error } : null;
      }
      if (channelId === "email") {
        const r = await sendCriticalAlertEmail(alert);
        return { channel: "email", sent: r.sent, alertId: alert.id, error: r.error };
      }
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return { channel: channelId, sent: false, alertId: alert.id, error: msg };
    }
  }

  // Fire all channels in parallel for each alert, then across all alerts
  const alertPromises = freshAlerts.map(async (alert) => {
    const channelPromises = ALL_CHANNEL_KEYS.map((ch) => sendToChannel(alert, ch));
    const channelResults = await Promise.all(channelPromises);
    return channelResults.filter((r): r is NotificationResult => r !== null);
  });

  const nestedResults = await Promise.all(alertPromises);
  for (const batch of nestedResults) {
    results.push(...batch);
  }

  const sent = results.filter((r) => r.sent).length;
  if (sent > 0) {
    console.log("[Notifications] " + sent + " notification(s) sent");
  }

  return results;
}
