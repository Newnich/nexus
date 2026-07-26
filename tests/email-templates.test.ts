/**
 * Unit tests for lib/email/templates.ts — Email HTML templates
 *
 * Tests the buildAlertEmailHtml function which generates HTML emails
 * for system alerts. Does NOT test the escapeHtml or getDashboardUrl
 * functions (they are tested in notifications.test.ts).
 *
 * Covers:
 *   - Critical alert HTML structure
 *   - Warning alert HTML structure
 *   - Info alert HTML structure
 *   - Alert message is escaped to prevent XSS
 *   - Severity badge shows correct color
 *   - View System Status link is included
 *   - Timestamp in human-readable format
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Alert } from "@/lib/queue/alerts";

// ── Fixtures ──

const criticalAlert: Alert = {
  id: "redis_disconnected",
  severity: "critical",
  title: "Redis Disconnected",
  message: "Redis connection lost for 5 minutes",
  firstSeen: "2025-06-15T12:00:00.000Z",
  lastSeen: "2025-06-15T12:05:00.000Z",
  fresh: true,
};

const warningAlert: Alert = {
  id: "backfill_failures",
  severity: "warning",
  title: "Backfill Failures",
  message: "5 consecutive failures detected",
  firstSeen: "2025-06-15T10:00:00.000Z",
  lastSeen: "2025-06-15T12:00:00.000Z",
  fresh: false,
};

const infoAlert: Alert = {
  id: "large_backlog",
  severity: "info",
  title: "Large Backlog",
  message: "1,000 items waiting for processing",
  firstSeen: "2025-06-15T09:00:00.000Z",
  lastSeen: "2025-06-15T12:00:00.000Z",
  fresh: true,
};

// ── Tests ──

describe("buildAlertEmailHtml", () => {
  let buildAlertEmailHtml: (alert: Alert) => string;

  beforeEach(async () => {
    const mod = await import("../lib/email/templates");
    buildAlertEmailHtml = mod.buildAlertEmailHtml;
  });

  it("generates a valid HTML document", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
    expect(html).toContain("</body>");
  });

  it("includes the alert title", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("Redis Disconnected");
  });

  it("includes the alert message", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("Redis connection lost for 5 minutes");
  });

  it("shows 'CRITICAL Alert' badge for critical severity", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("critical Alert");
    // Should be uppercase in the rendered badge
    expect(html.toLowerCase()).toContain("critical");
  });

  it("shows 'Warning Alert' badge for warning severity", () => {
    const html = buildAlertEmailHtml(warningAlert);

    expect(html.toLowerCase()).toContain("warning");
  });

  it("shows 'Info Alert' badge for info severity", () => {
    const html = buildAlertEmailHtml(infoAlert);

    expect(html.toLowerCase()).toContain("info");
  });

  it("includes the View System Status link", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("View System Status");
    expect(html).toContain("/status");
  });

  it("escapes HTML in alert title to prevent XSS", () => {
    const xssAlert: Alert = {
      ...criticalAlert,
      title: '<script>alert("xss")</script>',
    };

    const html = buildAlertEmailHtml(xssAlert);

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML in alert message to prevent XSS", () => {
    const xssAlert: Alert = {
      ...criticalAlert,
      message: '<img src=x onerror="alert(1)">',
    };

    const html = buildAlertEmailHtml(xssAlert);

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("includes NEXUS branding in the email", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("NEXUS");
  });

  it("has a dark theme background color", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("#0a0b1e");
  });

  it("includes footer text about automated alerts", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("automated alert");
    expect(html).toContain("ALERT_EMAIL_TO");
  });

  it("handles alerts with ampersands in the message", () => {
    const alertWithAmpersand: Alert = {
      ...criticalAlert,
      message: "Error: connection failed & retries exhausted",
    };

    const html = buildAlertEmailHtml(alertWithAmpersand);

    expect(html).toContain("connection failed");
    // Ampersand should be escaped
    expect(html).toContain("&amp;");
  });

  it("uses correct severity colors", () => {
    const criticalHtml = buildAlertEmailHtml(criticalAlert);
    const warningHtml = buildAlertEmailHtml(warningAlert);
    const infoHtml = buildAlertEmailHtml(infoAlert);

    // Critical red
    expect(criticalHtml).toContain("#ef4444");
    // Warning yellow
    expect(warningHtml).toContain("#eab308");
    // Info blue
    expect(infoHtml).toContain("#3b82f6");
  });

  it("includes the lastSeen timestamp in human-readable format", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    // Should contain parts of the formatted date
    expect(html).toContain("Jun");
    expect(html).toContain("15");
  });

  it("has an action button with indigo background", () => {
    const html = buildAlertEmailHtml(criticalAlert);

    expect(html).toContain("#6366f1");
    expect(html).toContain("View System Status");
  });
});
