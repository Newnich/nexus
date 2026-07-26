/**
 * Unit tests for lib/queue/config.ts — BullMQ Queue Configuration
 *
 * Tests the pure functions and configuration values that don't
 * require an actual Redis connection.
 *
 * Covers:
 *   - QUEUES constants
 *   - aiProcessingJobId format
 *   - closeRedisConnection handles null connection gracefully
 *   - getRedisConnection TLS logic and defaults
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Helpers ──

// Since REDIS_OPTIONS is evaluated at module load time, we must
// reset the module cache before each env-dependent import so the
// module re-evaluates with the current env vars.
async function freshImport() {
  vi.resetModules();
  return import("../lib/queue/config");
}

// ── QUEUES ──

describe("QUEUES", () => {
  it("has correct queue names", async () => {
    const { QUEUES } = await freshImport();
    expect(QUEUES.AI_PROCESSING).toBe("nexus-ai-processing");
    expect(QUEUES.MAINTENANCE).toBe("nexus-maintenance");
  });
});

// ── aiProcessingJobId ──

describe("aiProcessingJobId", () => {
  it("returns consistent job IDs for the same item", async () => {
    const { aiProcessingJobId } = await freshImport();
    const id1 = aiProcessingJobId("item-123");
    const id2 = aiProcessingJobId("item-123");
    expect(id1).toBe(id2);
  });

  it("returns different job IDs for different items", async () => {
    const { aiProcessingJobId } = await freshImport();
    const id1 = aiProcessingJobId("item-123");
    const id2 = aiProcessingJobId("item-456");
    expect(id1).not.toBe(id2);
  });

  it("includes the item ID in the job ID", async () => {
    const { aiProcessingJobId } = await freshImport();
    const id = aiProcessingJobId("test-item-id");
    expect(id).toContain("test-item-id");
    expect(id).toMatch(/^ai-process-/);
  });
});

// ── closeRedisConnection ──

describe("closeRedisConnection", () => {
  it("handles null connection gracefully (resolves without error)", async () => {
    const { closeRedisConnection } = await freshImport();
    await expect(closeRedisConnection()).resolves.toBeUndefined();
  });
});

// ── getRedisConnection (env-dependent) ──

describe("getRedisConnection", () => {
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = {
      REDIS_HOST: process.env.REDIS_HOST,
      REDIS_PORT: process.env.REDIS_PORT,
      REDIS_PASSWORD: process.env.REDIS_PASSWORD,
      REDIS_DB: process.env.REDIS_DB,
      REDIS_TLS: process.env.REDIS_TLS,
    };
  });

  afterEach(async () => {
    // Restore env
    for (const [key, val] of Object.entries(envBackup)) {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    }
    // Close any connection created during the test
    const { closeRedisConnection } = await freshImport();
    await closeRedisConnection();
  });

  it("uses env vars for connection config", async () => {
    process.env.REDIS_HOST = "my-redis.example.com";
    process.env.REDIS_PORT = "6380";
    process.env.REDIS_PASSWORD = "secret123";
    process.env.REDIS_DB = "5";

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.host).toBe("my-redis.example.com");
    expect(conn.options.port).toBe(6380);
    // ioredis internally coerces undefined password to null
    expect(conn.options.password).toBe("secret123");
    expect(conn.options.db).toBe(5);
  });

  it("uses defaults when no env vars are set", async () => {
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
    delete process.env.REDIS_PASSWORD;
    delete process.env.REDIS_DB;

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.host).toBe("localhost");
    expect(conn.options.port).toBe(6379);
    // ioredis internally coerces undefined to null for password
    expect(conn.options.password).toBeNull();
    expect(conn.options.db).toBe(0);
  });

  it("returns singleton connection", async () => {
    const mod = await freshImport();
    const conn1 = mod.getRedisConnection();
    const conn2 = mod.getRedisConnection();
    expect(conn1).toBe(conn2);
    await mod.closeRedisConnection();
  });

  it("enables TLS when REDIS_TLS=true", async () => {
    process.env.REDIS_TLS = "true";
    process.env.REDIS_HOST = "my-redis.upstash.io";

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.tls).toEqual({});
  });

  it("enables TLS for remote hosts (not localhost/127.0.0.1/redis)", async () => {
    process.env.REDIS_HOST = "redis-cluster.upstash.io";
    delete process.env.REDIS_TLS;

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.tls).toEqual({});
  });

  it("does NOT enable TLS for localhost", async () => {
    process.env.REDIS_HOST = "localhost";
    delete process.env.REDIS_TLS;

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.tls).toBeUndefined();
  });

  it("does NOT enable TLS for 127.0.0.1", async () => {
    process.env.REDIS_HOST = "127.0.0.1";
    delete process.env.REDIS_TLS;

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.tls).toBeUndefined();
  });

  it("does NOT enable TLS for 'redis' hostname (Docker container name)", async () => {
    process.env.REDIS_HOST = "redis";
    delete process.env.REDIS_TLS;

    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.tls).toBeUndefined();
  });

  it("sets maxRetriesPerRequest to null for BullMQ compatibility", async () => {
    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.maxRetriesPerRequest).toBeNull();
  });

  it("disables ready check for BullMQ compatibility", async () => {
    const { getRedisConnection } = await freshImport();
    const conn = getRedisConnection();
    expect(conn.options.enableReadyCheck).toBe(false);
  });
});
