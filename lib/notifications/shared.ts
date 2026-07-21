/**
 * Shared Utilities for Notification Channels
 *
 * Common functions used by both email and webhook notification modules.
 * Extracted here to avoid duplication between lib/email/templates.ts
 * and lib/notifications/webhook.ts.
 */

/**
 * Build the dashboard URL for the "View System Status" link.
 * Handles Vercel preview deployments and localhost fallback.
 */
export function getDashboardUrl(): string {
  return process.env.NEXUS_URL || process.env.VERCEL_URL
    ? "https://" + (process.env.NEXUS_URL || process.env.VERCEL_URL) + "/status"
    : "http://localhost:3000/status";
}

/**
 * Basic HTML escaping for email templates.
 * Escapes &, <, >, ", and ' characters.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
