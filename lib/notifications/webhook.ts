/**
 * Webhook Notifications for System Alerts
 *
 * Sends alert notifications to Slack and/or Discord via webhook URLs.
 * Supports both platforms with appropriate message formatting.
 *
 * Slack format: https://api.slack.com/messaging/webhooks
 * Discord format: https://discord.com/developers/docs/resources/webhook
 *
 * Environment variables:
 *   SLACK_WEBHOOK_URL   - Slack incoming webhook URL (optional)
 *   DISCORD_WEBHOOK_URL - Discord webhook URL (optional)
 *
 * Cooldown:
 *   Uses a shared Redis cooldown (30 min per alert ID) to prevent spam.
 *   Separately namespaced from email cooldowns so both channels can fire independently.
 */

import { getRedisConnection } from "@/lib/queue/config";
import { getDashboardUrl } from "@/lib/notifications/shared";
import { recordNotification } from "@/lib/notifications/history";
import { getCooldownSeconds } from "@/lib/notifications/cooldown";
import type { Alert } from "@/lib/queue/alerts";

// ── Config ──

const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || "";
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || "";
const COOLDOWN_PREFIX = "nexus:webhook:cooldown:";

// ── Cooldown check (per-channel, configured via /settings/cooldown) ──

async function checkCooldown(alertId: string, channel: "slack" | "discord"): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const key = COOLDOWN_PREFIX + channel + ":" + alertId;
    const seconds = await getCooldownSeconds(channel);
    const result = await redis.set(key, "1", "EX", seconds, "NX");
    if (result !== "OK") return false;
    return true;
  } catch {
    return true;
  }
}

// ── Webhook payload builders ──

function buildSlackPayload(alert: Alert): Record<string, unknown> {
  const blockEmoji: Record<string, string> = {
    critical: "🔴",
    warning: "🟡",
    info: "🔵",
  };

  return {
    text: "[NEXUS] " + alert.severity.toUpperCase() + ": " + alert.title,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: blockEmoji[alert.severity] + " " + alert.title,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: alert.message,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text:
              "Severity: *" +
              alert.severity.toUpperCase() +
              "* | " +
              new Date(alert.lastSeen).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              }),
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "View System Status" },
            url: getDashboardUrl(),
            style: "primary",
          },
        ],
      },
    ],
  };
}

function buildDiscordPayload(alert: Alert): Record<string, unknown> {
  const colorMap: Record<string, number> = {
    critical: 0xef4444,
    warning: 0xeab308,
    info: 0x3b82f6,
  };

  return {
    content: "@here **NEXUS Alert:** " + alert.severity.toUpperCase() + " — " + alert.title,
    embeds: [
      {
        title: alert.title,
        description: alert.message,
        color: colorMap[alert.severity] || 0x6366f1,
        timestamp: alert.lastSeen,
        footer: {
          text: "NEXUS System Alerts",
        },
        fields: [
          {
            name: "Severity",
            value: alert.severity.toUpperCase(),
            inline: true,
          },
          {
            name: "Status Page",
            value: "[View System Status](" + getDashboardUrl() + ")",
            inline: true,
          },
        ],
      },
    ],
  };
}

// ── URL validation ──

function isValidWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// ── Send webhook ──

export interface WebhookResult {
  channel: "slack" | "discord";
  sent: boolean;
  alertId: string;
  error?: string;
}

async function sendToWebhook(
  url: string,
  payload: Record<string, unknown>,
  channel: "slack" | "discord",
  alertId: string,
): Promise<WebhookResult> {
  try {
    // Validate URL format
    if (!isValidWebhookUrl(url)) {
      console.error("[Webhook/" + channel + "] Invalid URL for channel (must use https):", url);
      return { channel, sent: false, alertId, error: "Invalid webhook URL — must be https" };
    }

    const canSend = await checkCooldown(alertId, channel);
    if (!canSend) {
      return { channel, sent: false, alertId, error: "cooldown" };
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      console.error("[Webhook/" + channel + "] HTTP " + res.status + ": " + text);
      return { channel, sent: false, alertId, error: "HTTP " + res.status + ": " + text };
    }

    // Record in history
    recordNotification({ channel, type: "alert", sent: true, alertId }).catch(() => {});

    console.log("[Webhook/" + channel + "] Sent alert: " + alertId);
    return { channel, sent: true, alertId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Webhook/" + channel + "] Error:", msg);
    recordNotification({ channel, type: "alert", sent: false, alertId, error: msg }).catch(
      () => {},
    );
    return { channel, sent: false, alertId, error: msg };
  }
}

// ── Individual channel senders (used by the dispatcher for per-channel preference filtering) ──

/**
 * Send an alert to Slack only.
 * Returns null if Slack is not configured.
 */
export async function sendAlertToSlack(alert: Alert): Promise<WebhookResult | null> {
  if (!SLACK_WEBHOOK_URL) return null;
  const payload = buildSlackPayload(alert);
  return await sendToWebhook(SLACK_WEBHOOK_URL, payload, "slack", alert.id);
}

/**
 * Send an alert to Discord only.
 * Returns null if Discord is not configured.
 */
export async function sendAlertToDiscord(alert: Alert): Promise<WebhookResult | null> {
  if (!DISCORD_WEBHOOK_URL) return null;
  const payload = buildDiscordPayload(alert);
  return await sendToWebhook(DISCORD_WEBHOOK_URL, payload, "discord", alert.id);
}

/**
 * Send a critical alert to both Slack and Discord (legacy — new dispatcher uses per-channel senders).
 */
export async function sendCriticalAlertToWebhooks(alert: Alert): Promise<WebhookResult[]> {
  const results: WebhookResult[] = [];

  if (SLACK_WEBHOOK_URL) {
    const payload = buildSlackPayload(alert);
    results.push(await sendToWebhook(SLACK_WEBHOOK_URL, payload, "slack", alert.id));
  }

  if (DISCORD_WEBHOOK_URL) {
    const payload = buildDiscordPayload(alert);
    results.push(await sendToWebhook(DISCORD_WEBHOOK_URL, payload, "discord", alert.id));
  }

  return results;
}

// ── Test notification ──

function buildTestPayload(channel: "slack" | "discord"): Record<string, unknown> {
  if (channel === "slack") {
    return {
      text: "🔧 *NEXUS Test Notification*",
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "🔧 NEXUS Test Notification",
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This is a test message from your NEXUS system to verify your Slack webhook configuration is working correctly.",
          },
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text:
                "Sent from *NEXUS* · " +
                new Date().toLocaleString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
            },
          ],
        },
        {
          type: "actions",
          elements: [
            {
              type: "button",
              text: { type: "plain_text", text: "View System Status" },
              url: getDashboardUrl(),
              style: "primary",
            },
          ],
        },
      ],
    };
  }

  return {
    content: "🔧 **NEXUS Test Notification**",
    embeds: [
      {
        title: "🔧 NEXUS Test Notification",
        description:
          "This is a test message from your NEXUS system to verify your Discord webhook configuration is working correctly.",
        color: 0x6366f1,
        timestamp: new Date().toISOString(),
        footer: {
          text: "NEXUS System Notifications",
        },
        fields: [
          {
            name: "Status Page",
            value: "[View System Status](" + getDashboardUrl() + ")",
            inline: true,
          },
        ],
      },
    ],
  };
}

/**
 * Send a test notification to a specific webhook channel.
 * Used from the settings page to verify configuration.
 */
export async function sendTestWebhookNotification(
  channel: "slack" | "discord",
): Promise<WebhookResult> {
  const url = channel === "slack" ? SLACK_WEBHOOK_URL : DISCORD_WEBHOOK_URL;

  if (!url) {
    const error =
      channel === "slack"
        ? "SLACK_WEBHOOK_URL not configured"
        : "DISCORD_WEBHOOK_URL not configured";
    return { channel, sent: false, alertId: "test", error };
  }

  const payload = buildTestPayload(channel);
  // Use a unique ID per test so cooldown doesn't block repeated tests
  const testId = "test-" + Date.now();
  const result = await sendToWebhook(url, payload, channel, testId);
  return result;
}
