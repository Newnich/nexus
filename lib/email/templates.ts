/**
 * Email Templates for System Alerts
 *
 * Generates clean HTML emails for alert notifications.
 * Styled to match NEXUS's dark theme.
 */

import type { Alert } from "@/lib/queue/alerts";
import { getDashboardUrl, escapeHtml } from "@/lib/notifications/shared";

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  warning: "#eab308",
  info: "#3b82f6",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "#450a0a",
  warning: "#422006",
  info: "#0c1929",
};

/**
 * Build a full HTML email for a system alert.
 */
export function buildAlertEmailHtml(alert: Alert): string {
  const color = SEVERITY_COLORS[alert.severity] || "#6366f1";
  const bg = SEVERITY_BG[alert.severity] || "#1e1b4b";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0a0b1e;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0b1e;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Logo -->
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <span style="font-size:24px;color:#818cf8;font-weight:bold;">NEXUS</span>
            </td>
          </tr>

          <!-- Alert Card -->
          <tr>
            <td style="background:#0f1128;border:1px solid ${color}33;border-radius:12px;padding:32px;">
              <!-- Severity Badge -->
              <table cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
                <tr>
                  <td style="background:${bg};border:1px solid ${color}33;border-radius:6px;padding:4px 12px;">
                    <span style="color:${color};font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">
                      ${alert.severity} Alert
                    </span>
                  </td>
                </tr>
              </table>

              <!-- Title -->
              <h1 style="margin:0 0 8px 0;font-size:20px;font-weight:600;color:#f1f5f9;">
                ${escapeHtml(alert.title)}
              </h1>

              <!-- Timestamp -->
              <p style="margin:0 0 20px 0;font-size:13px;color:#64748b;">
                ${new Date(alert.lastSeen).toLocaleString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                  timeZoneName: "short",
                })}
              </p>

              <!-- Divider -->
              <div style="height:1px;background:#1e293b;margin-bottom:20px;"></div>

              <!-- Message -->
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#cbd5e1;">
                ${escapeHtml(alert.message)}
              </p>

              <!-- Action -->
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#6366f1;border-radius:8px;padding:0;">
                    <a href="${getDashboardUrl()}"
                       style="display:inline-block;padding:12px 24px;color:#ffffff;font-size:14px;font-weight:500;text-decoration:none;">
                      View System Status →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#475569;">
                This is an automated alert from your NEXUS knowledge system.<br>
                You can configure recipients via the ALERT_EMAIL_TO environment variable.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


