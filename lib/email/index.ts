/**
 * Email Notifications for System Alerts
 *
 * Uses Resend to send transactional emails when critical system alerts fire.
 * Includes a Redis-based cooldown to prevent duplicate emails for the same alert.
 *
 * Environment variables:
 *   RESEND_API_KEY      - Resend API key (required for email sending)
 *   ALERT_EMAIL_TO      - Recipient email address (default: first admin user)
 *   ALERT_EMAIL_FROM    - Sender email address (default: alerts@nexus.app)
 *
 * Cooldown:
 *   Each alert ID has a 30-minute cooldown period in Redis. If the same
 *   critical alert is still active after 30 minutes, another email is sent.
 */

import { Resend } from "resend";
import { getRedisConnection } from "@/lib/queue/config";
import { buildAlertEmailHtml } from "./templates";
import { getCooldownSeconds } from "@/lib/notifications/cooldown";
import type { Alert } from "@/lib/queue/alerts";

// ── Config ──

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ALERT_EMAIL_TO = process.env.ALERT_EMAIL_TO || "";
const ALERT_EMAIL_FROM = process.env.ALERT_EMAIL_FROM || "NEXUS Alerts <alerts@nexus.app>";

const COOLDOWN_PREFIX = "nexus:email:cooldown:";

// ── Resend client (lazy init) ──

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    if (!RESEND_API_KEY) {
      throw new Error(
        "Missing RESEND_API_KEY environment variable. " +
        "Set it in .env.local to enable email alerts. " +
        "Get one at https://resend.com/api-keys"
      );
    }
    _resend = new Resend(RESEND_API_KEY);
  }
  return _resend;
}

// ── Cooldown check (configured via /settings/cooldown) ──

/**
 * Check if an alert has exceeded the cooldown period.
 * Returns true if the email should be sent (no cooldown or expired).
 */
async function checkCooldown(alertId: string): Promise<boolean> {
  try {
    const redis = getRedisConnection();
    const key = COOLDOWN_PREFIX + alertId;
    // Atomic SET if Not eXists — prevents race conditions between concurrent requests
    const seconds = await getCooldownSeconds("email");
    const result = await redis.set(key, "1", "EX", seconds, "NX");
    if (result !== "OK") return false; // Key already exists (still in cooldown)
    return true;
  } catch {
    // If Redis is down, send email anyway (fail-open)
    return true;
  }
}

// ── Send alert email ──

export interface AlertEmailResult {
  sent: boolean;
  alertId: string;
  error?: string;
}

/**
 * Send an email notification for a critical alert.
 * Respects a per-alert cooldown to prevent spam.
 *
 * Returns { sent: true } if email was sent, { sent: false } if skipped due to cooldown.
 */
export async function sendCriticalAlertEmail(alert: Alert): Promise<AlertEmailResult> {
  // Skip if Resend is not configured
  if (!RESEND_API_KEY) {
    return { sent: false, alertId: alert.id, error: "RESEND_API_KEY not configured" };
  }

  // Warn if using default from address (Resend requires domain verification)
  if (!process.env.ALERT_EMAIL_FROM) {
    console.warn(
      "[Email] Using default from address " + ALERT_EMAIL_FROM +
      " — set ALERT_EMAIL_FROM to a verified domain in Resend to ensure delivery"
    );
  }

  // Skip if no recipient configured
  if (!ALERT_EMAIL_TO) {
    console.log("[Email] Skipping alert email - ALERT_EMAIL_TO not set");
    return { sent: false, alertId: alert.id, error: "ALERT_EMAIL_TO not set" };
  }

  try {
    // Check cooldown
    const canSend = await checkCooldown(alert.id);
    if (!canSend) {
      console.log("[Email] Skipping " + alert.id + " - within cooldown period");
      return { sent: false, alertId: alert.id, error: "cooldown" };
    }

    // Build and send email
    const html = buildAlertEmailHtml(alert);
    const resend = getResendClient();

    const { error } = await resend.emails.send({
      from: ALERT_EMAIL_FROM,
      to: ALERT_EMAIL_TO,
      subject: "[NEXUS] " + alert.severity.toUpperCase() + ": " + alert.title,
      html,
    });

    if (error) {
      console.error("[Email] Failed to send:", error);
      return { sent: false, alertId: alert.id, error: error.message };
    }

    console.log("[Email] Sent alert: " + alert.id);
    return { sent: true, alertId: alert.id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[Email] Error sending alert:", msg);
    return { sent: false, alertId: alert.id, error: msg };
  }
}

/**
 * Send email notifications for all fresh critical alerts.
 * Called from the alerts API route after evaluating health conditions.
 */
export async function sendCriticalAlertEmails(alerts: Alert[]): Promise<AlertEmailResult[]> {
  const criticalAlerts = alerts.filter(
    (a) => a.severity === "critical" && a.fresh
  );

  if (criticalAlerts.length === 0) return [];

  console.log("[Email] Processing " + criticalAlerts.length + " critical alert(s)");
  const results = await Promise.all(
    criticalAlerts.map((alert) => sendCriticalAlertEmail(alert))
  );

  const sent = results.filter((r) => r.sent).length;
  if (sent > 0) {
    console.log("[Email] Sent " + sent + " alert email(s)");
  }

  return results;
}
