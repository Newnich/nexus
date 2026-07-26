/**
 * Unit tests for lib/notifications/index.ts — Unified Notification Dispatcher
 *
 * Tests sendCriticalAlertNotifications by mocking the channel senders
 * (Slack, Discord, email) and preferences module.
 *
 * Covers:
 *   - Empty fresh alerts returns empty result
 *   - Sends to all channels when preferences allow
 *   - Respects per-channel preferences (disabled channels)
 *   - Handles individual channel failures gracefully
 *   - Unknown alerts default to allowed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Alert } from "@/lib/queue/alerts";

// ── Mock webhook senders ──

vi.mock("../lib/notifications/webhook", () => ({
  sendAlertToSlack: vi.fn(),
  sendAlertToDiscord: vi.fn(),
}));

// ── Mock email sender ──

vi.mock("../lib/email", () => ({
  sendCriticalAlertEmail: vi.fn(),
}));

// ── Mock preferences ──

vi.mock("../lib/notifications/preferences", () => ({
  loadPreferences: vi.fn(),
  shouldNotify: vi.fn(),
  ALL_CHANNEL_KEYS: ["slack", "discord", "email"] as const,
}));

// ── Fixtures ──

const freshAlert: Alert = {
  id: "redis_disconnected",
  severity: "critical",
  title: "Redis Disconnected",
  message: "Redis connection lost",
  firstSeen: "2025-06-15T12:00:00.000Z",
  lastSeen: "2025-06-15T12:05:00.000Z",
  fresh: true,
};

const staleAlert: Alert = {
  ...freshAlert,
  fresh: false,
};

// ── Mocks ──

let mockSendAlertToSlack: ReturnType<typeof vi.fn>;
let mockSendAlertToDiscord: ReturnType<typeof vi.fn>;
let mockSendCriticalAlertEmail: ReturnType<typeof vi.fn>;
let mockLoadPreferences: ReturnType<typeof vi.fn>;
let mockShouldNotify: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  // Import mocks after vi.mock has been set up
  const webhook = await import("../lib/notifications/webhook");
  const email = await import("../lib/email");
  const prefs = await import("../lib/notifications/preferences");

  mockSendAlertToSlack = webhook.sendAlertToSlack as ReturnType<typeof vi.fn>;
  mockSendAlertToDiscord = webhook.sendAlertToDiscord as ReturnType<typeof vi.fn>;
  mockSendCriticalAlertEmail = email.sendCriticalAlertEmail as ReturnType<typeof vi.fn>;
  mockLoadPreferences = prefs.loadPreferences as ReturnType<typeof vi.fn>;
  mockShouldNotify = prefs.shouldNotify as ReturnType<typeof vi.fn>;

  // Default mock behaviors
  mockLoadPreferences.mockResolvedValue({});
  mockShouldNotify.mockReturnValue(true); // All channels allowed by default
  mockSendAlertToSlack.mockResolvedValue({ channel: "slack", sent: true, alertId: "" });
  mockSendAlertToDiscord.mockResolvedValue({ channel: "discord", sent: true, alertId: "" });
  mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "" });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Tests ──

describe("sendCriticalAlertNotifications", () => {
  it("returns empty result when no fresh alerts", async () => {
    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([staleAlert]);

    expect(results).toEqual([]);
    expect(mockLoadPreferences).not.toHaveBeenCalled();
  });

  it("sends fresh alerts to all channels by default", async () => {
    mockSendAlertToSlack.mockResolvedValue({
      channel: "slack",
      sent: true,
      alertId: "redis_disconnected",
    });
    mockSendAlertToDiscord.mockResolvedValue({
      channel: "discord",
      sent: true,
      alertId: "redis_disconnected",
    });
    mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "redis_disconnected" });

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([freshAlert]);

    // Should have 3 results (one per channel)
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.sent)).toHaveLength(3);
  });

  it("respects per-channel preferences (skips disabled channels)", async () => {
    mockShouldNotify.mockImplementation((_prefs: unknown, _alertId: string, channel: string) => {
      return channel !== "discord"; // Disable Discord only
    });
    mockSendAlertToSlack.mockResolvedValue({
      channel: "slack",
      sent: true,
      alertId: "redis_disconnected",
    });
    mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "redis_disconnected" });

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([freshAlert]);

    // Only Slack and Email (not Discord)
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.channel === "discord")).toBeUndefined();
    expect(results.find((r) => r.channel === "slack")).toBeDefined();
    expect(results.find((r) => r.channel === "email")).toBeDefined();
  });

  it("handles channel failure without affecting other channels", async () => {
    mockSendAlertToSlack.mockResolvedValue({
      channel: "slack",
      sent: false,
      alertId: "redis_disconnected",
      error: "HTTP 429",
    });
    mockSendAlertToDiscord.mockResolvedValue({
      channel: "discord",
      sent: true,
      alertId: "redis_disconnected",
    });
    mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "redis_disconnected" });

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([freshAlert]);

    expect(results).toHaveLength(3);
    const slackResult = results.find((r) => r.channel === "slack")!;
    expect(slackResult.sent).toBe(false);
    expect(slackResult.error).toBeDefined();
    expect(results.filter((r) => r.sent)).toHaveLength(2);
  });

  it("sends to unknown alert types (default allow)", async () => {
    mockShouldNotify.mockReturnValue(true);
    mockSendAlertToSlack.mockResolvedValue({
      channel: "slack",
      sent: true,
      alertId: "unknown_alert",
    });
    mockSendAlertToDiscord.mockResolvedValue({
      channel: "discord",
      sent: true,
      alertId: "unknown_alert",
    });
    mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "unknown_alert" });

    const unknownAlert: Alert = {
      id: "unknown_alert",
      severity: "warning",
      title: "Something unusual",
      message: "An unrecognized condition occurred",
      firstSeen: "2025-06-15T12:00:00.000Z",
      lastSeen: "2025-06-15T12:00:00.000Z",
      fresh: true,
    };

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([unknownAlert]);

    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.sent)).toHaveLength(3);
  });

  it("loads preferences once for all alerts", async () => {
    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    await sendCriticalAlertNotifications([freshAlert]);

    expect(mockLoadPreferences).toHaveBeenCalledTimes(1);
  });

  it("processes multiple fresh alerts", async () => {
    mockSendAlertToSlack.mockResolvedValue({ channel: "slack", sent: true, alertId: "" });
    mockSendAlertToDiscord.mockResolvedValue({ channel: "discord", sent: true, alertId: "" });
    mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "" });

    const alert2: Alert = {
      id: "backfill_failures",
      severity: "warning",
      title: "Backfill Failures",
      message: "Multiple failures detected",
      firstSeen: "2025-06-15T11:00:00.000Z",
      lastSeen: "2025-06-15T12:00:00.000Z",
      fresh: true,
    };

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([freshAlert, alert2]);

    // 2 alerts × 3 channels = 6 results
    expect(results).toHaveLength(6);
  });

  it("handles sender throwing an error gracefully", async () => {
    mockSendAlertToSlack.mockRejectedValue(new Error("Network timeout"));

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([freshAlert]);

    const slackResult = results.find((r) => r.channel === "slack")!;
    expect(slackResult.sent).toBe(false);
    expect(slackResult.error).toContain("Network timeout");
  });

  it("handles Slack returning null (not configured) without error", async () => {
    mockSendAlertToSlack.mockResolvedValue(null); // Not configured
    mockSendAlertToDiscord.mockResolvedValue({
      channel: "discord",
      sent: true,
      alertId: "redis_disconnected",
    });
    mockSendCriticalAlertEmail.mockResolvedValue({ sent: true, alertId: "redis_disconnected" });

    const { sendCriticalAlertNotifications } = await import("../lib/notifications");
    const results = await sendCriticalAlertNotifications([freshAlert]);

    // Only Discord and Email (Slack is null/not configured)
    expect(results).toHaveLength(2);
    expect(results.find((r) => r.channel === "slack")).toBeUndefined();
  });
});
