/**
 * Unit tests for lib/notifications/webhook.ts — Webhook notification logic
 *
 * Tests the public API with mocked fetch and Redis. Covers:
 *   - Unconfigured webhook URLs (returns null / error)
 *   - sendTestWebhookNotification error cases
 *   - sendAlertToSlack/Discord configuration checks
 *   - sendCriticalAlertToWebhooks channel routing
 *
 * IMPORTANT: The Redis module (@/lib/queue/config) is mocked at the
 * top level so that getRedisConnection() returns a mock instead of
 * attempting a real connection. Without this, tests would hang/timeout
 * because there's no Redis server in the test environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Alert } from "@/lib/queue/alerts";

// ── Mock Redis config to prevent connection attempts ──
// This must be at the top level (hoisted by vi.mock) so it applies
// before any import of the webhook module.

const mockMulti = {
  zadd: () => mockMulti,
  zremrangebyrank: () => mockMulti,
  exec: () => Promise.resolve([] as never[]),
};

const mockRedis = {
  set: () => Promise.resolve("OK" as const),
  get: () => Promise.resolve(null),
  del: () => Promise.resolve(1),
  multi: () => mockMulti,
  quit: () => Promise.resolve("OK" as const),
  options: {},
};

vi.mock("@/lib/queue/config", () => ({
  getRedisConnection: () => mockRedis,
  closeRedisConnection: () => Promise.resolve(undefined),
  QUEUES: { AI_PROCESSING: "nexus-ai-processing", MAINTENANCE: "nexus-maintenance" },
  aiProcessingJobId: (id: string) => `ai-process-${id}`,
}));

// ── Fixtures ──

const sampleAlert: Alert = {
  id: "redis_disconnected",
  severity: "critical",
  title: "Redis Disconnected",
  message: "Redis connection lost for 5 minutes",
  firstSeen: "2025-06-15T12:00:00.000Z",
  lastSeen: "2025-06-15T12:05:00.000Z",
  fresh: true,
};

// ── Mock fetch — save original so we can restore it ──

let originalFetch: typeof globalThis.fetch;

async function freshImport() {
  vi.resetModules();
  // Re-apply the config mock (vi.mock survives resetModules)
  // Set fetch mock for HTTP calls
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({}),
  });
  return import("../lib/notifications/webhook");
}

let envBackup: Record<string, string | undefined>;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  envBackup = {
    SLACK_WEBHOOK_URL: process.env.SLACK_WEBHOOK_URL,
    DISCORD_WEBHOOK_URL: process.env.DISCORD_WEBHOOK_URL,
  };
});

afterEach(() => {
  for (const [key, val] of Object.entries(envBackup)) {
    if (val !== undefined) process.env[key] = val;
    else delete process.env[key];
  }
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ── sendTestWebhookNotification ──

describe("sendTestWebhookNotification", () => {
  it("returns error when Slack is not configured", async () => {
    delete process.env.SLACK_WEBHOOK_URL;

    const { sendTestWebhookNotification } = await freshImport();
    const result = await sendTestWebhookNotification("slack");
    expect(result.sent).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("returns error when Discord is not configured", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    const { sendTestWebhookNotification } = await freshImport();
    const result = await sendTestWebhookNotification("discord");
    expect(result.sent).toBe(false);
    expect(result.error).toContain("not configured");
  });

  it("returns error for invalid webhook URL format (http not https)", async () => {
    process.env.SLACK_WEBHOOK_URL = "http://not-valid.com/hook";
    delete process.env.DISCORD_WEBHOOK_URL;

    const { sendTestWebhookNotification } = await freshImport();
    const result = await sendTestWebhookNotification("slack");
    expect(result.sent).toBe(false);
    expect(result.error).toContain("Invalid");
  });
});

// ── sendAlertToSlack / sendAlertToDiscord ──

describe("sendAlertToSlack / sendAlertToDiscord", () => {
  it("returns null when Slack webhook URL is not configured", async () => {
    delete process.env.SLACK_WEBHOOK_URL;

    const { sendAlertToSlack } = await freshImport();
    const result = await sendAlertToSlack(sampleAlert);
    expect(result).toBeNull();
  });

  it("returns null when Discord webhook URL is not configured", async () => {
    delete process.env.DISCORD_WEBHOOK_URL;

    const { sendAlertToDiscord } = await freshImport();
    const result = await sendAlertToDiscord(sampleAlert);
    expect(result).toBeNull();
  });

  it("attempts to send when Slack webhook URL is configured", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/test/test/test";

    const { sendAlertToSlack } = await freshImport();
    const result = await sendAlertToSlack(sampleAlert);
    expect(result).not.toBeNull();
    expect(result!.channel).toBe("slack");
    expect(result!.alertId).toBe("redis_disconnected");
  });

  it("includes alertId in the result for warning alerts", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";

    const { sendAlertToSlack } = await freshImport();
    const result = await sendAlertToSlack({
      id: "large_backlog",
      severity: "warning",
      title: "Large Backlog",
      message: "1000 items",
      firstSeen: "2025-06-15T10:00:00.000Z",
      lastSeen: "2025-06-15T12:00:00.000Z",
      fresh: false,
    });
    expect(result).not.toBeNull();
    expect(result!.alertId).toBe("large_backlog");
  });
});

// ── sendCriticalAlertToWebhooks ──

describe("sendCriticalAlertToWebhooks (legacy)", () => {
  it("sends to no channels when neither is configured", async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.DISCORD_WEBHOOK_URL;

    const { sendCriticalAlertToWebhooks } = await freshImport();
    const results = await sendCriticalAlertToWebhooks(sampleAlert);
    expect(results).toHaveLength(0);
  });

  it("sends to Slack only when only Slack is configured", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/test";
    delete process.env.DISCORD_WEBHOOK_URL;

    const { sendCriticalAlertToWebhooks } = await freshImport();
    const results = await sendCriticalAlertToWebhooks(sampleAlert);
    expect(results).toHaveLength(1);
    expect(results[0].channel).toBe("slack");
  });
});
