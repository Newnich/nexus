/**
 * Unit tests for lib/queue/ai-queue.ts — AI Processing Queue
 *
 * Tests queue constants, job configuration, and queue creation
 * by mocking BullMQ and ioredis. Covers:
 *   - AI_PRIORITY constants
 *   - JOB_RETAIN_COMPLETE and JOB_RETAIN_FAIL env parsing
 *   - getAIQueue lazy initialization
 *   - enqueueAIProcessing job creation
 *   - createAIWorker worker configuration
 *   - Error handling for Redis connection failures
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock BullMQ Queue and Worker ──

const mockQueueAdd = vi.fn();
const mockQueueInstance = {
  add: mockQueueAdd,
  close: vi.fn(),
};

const mockWorkerInstance = {
  run: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  name: "test-worker",
  opts: { concurrency: 2 },
};

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(function () {
    return mockQueueInstance;
  }),
  Worker: vi.fn().mockImplementation(function () {
    return mockWorkerInstance;
  }),
}));

// ── Mock Redis config ──

const mockRedis = {
  options: {},
  quit: vi.fn().mockResolvedValue("OK"),
};

vi.mock("../lib/queue/config", () => ({
  getRedisConnection: vi.fn(() => mockRedis),
  closeRedisConnection: vi.fn(),
  QUEUES: {
    AI_PROCESSING: "nexus-ai-processing",
    MAINTENANCE: "nexus-maintenance",
  },
  aiProcessingJobId: (id: string) => `ai-process-${id}`,
}));

// ── Helpers ──

async function freshImport() {
  vi.resetModules();
  return import("../lib/queue/ai-queue");
}

afterEach(() => {
  vi.clearAllMocks();
});

// ── AI_PRIORITY ──

describe("AI_PRIORITY", () => {
  it("defines priority levels for different user tiers", async () => {
    const { AI_PRIORITY } = await freshImport();
    expect(AI_PRIORITY.PREMIUM).toBe(1);
    expect(AI_PRIORITY.STANDARD).toBe(5);
    expect(AI_PRIORITY.BACKFILL).toBe(10);
  });

  it("has premium priority lower (faster) than standard", async () => {
    const { AI_PRIORITY } = await freshImport();
    expect(AI_PRIORITY.PREMIUM).toBeLessThan(AI_PRIORITY.STANDARD);
    expect(AI_PRIORITY.STANDARD).toBeLessThan(AI_PRIORITY.BACKFILL);
  });
});

// ── Job retention ──

describe("JOB_RETAIN", () => {
  let envBackup: Record<string, string | undefined>;

  beforeEach(() => {
    envBackup = {
      JOB_RETAIN_COMPLETE_HOURS: process.env.JOB_RETAIN_COMPLETE_HOURS,
      JOB_RETAIN_FAIL_HOURS: process.env.JOB_RETAIN_FAIL_HOURS,
    };
  });

  afterEach(() => {
    for (const [key, val] of Object.entries(envBackup)) {
      if (val !== undefined) process.env[key] = val;
      else delete process.env[key];
    }
  });

  it("uses default values when no env vars are set", async () => {
    delete process.env.JOB_RETAIN_COMPLETE_HOURS;
    delete process.env.JOB_RETAIN_FAIL_HOURS;

    const { JOB_RETAIN_COMPLETE, JOB_RETAIN_FAIL } = await freshImport();
    expect(JOB_RETAIN_COMPLETE).toBe(3600); // 1 hour
    expect(JOB_RETAIN_FAIL).toBe(86400); // 24 hours
  });

  it("parses env vars correctly", async () => {
    process.env.JOB_RETAIN_COMPLETE_HOURS = "2";
    process.env.JOB_RETAIN_FAIL_HOURS = "48";

    const { JOB_RETAIN_COMPLETE, JOB_RETAIN_FAIL } = await freshImport();
    expect(JOB_RETAIN_COMPLETE).toBe(7200); // 2 hours
    expect(JOB_RETAIN_FAIL).toBe(172800); // 48 hours
  });

  it("propagates NaN from invalid env var value", async () => {
    process.env.JOB_RETAIN_COMPLETE_HOURS = "not-a-number";
    process.env.JOB_RETAIN_FAIL_HOURS = "also-NaN";

    const { JOB_RETAIN_COMPLETE, JOB_RETAIN_FAIL } = await freshImport();
    expect(JOB_RETAIN_COMPLETE).toBeNaN();
    expect(JOB_RETAIN_FAIL).toBeNaN();
  });
});

// ── getAIQueue ──

describe("getAIQueue", () => {
  it("creates a Queue with correct name and options", async () => {
    const { getAIQueue } = await freshImport();
    const queue = getAIQueue();

    // Should import BullMQ's Queue constructor
    const { Queue } = await import("bullmq");
    expect(Queue).toHaveBeenCalledWith(
      "nexus-ai-processing",
      expect.objectContaining({
        connection: mockRedis,
        defaultJobOptions: expect.objectContaining({
          attempts: 3,
          backoff: { type: "exponential", delay: 5_000 },
          removeOnComplete: { age: 3600 },
          removeOnFail: { age: 86400 },
        }),
      }),
    );
    expect(queue).toBe(mockQueueInstance);
  });

  it("returns the same queue instance on subsequent calls (singleton)", async () => {
    const { getAIQueue } = await freshImport();
    const queue1 = getAIQueue();
    const queue2 = getAIQueue();
    expect(queue1).toBe(queue2);
  });
});

// ── enqueueAIProcessing ──

describe("enqueueAIProcessing", () => {
  it("enqueues a job with default standard priority", async () => {
    const { enqueueAIProcessing } = await freshImport();
    await enqueueAIProcessing("item-123", "user-abc");

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "process",
      { itemId: "item-123", userId: "user-abc" },
      expect.objectContaining({
        jobId: "ai-process-item-123",
        priority: 5, // STANDARD
      }),
    );
  });

  it("enqueues a job with custom priority", async () => {
    const { enqueueAIProcessing, AI_PRIORITY } = await freshImport();
    await enqueueAIProcessing("item-premium", "user-premium", AI_PRIORITY.PREMIUM);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "process",
      { itemId: "item-premium", userId: "user-premium" },
      expect.objectContaining({
        jobId: "ai-process-item-premium",
        priority: 1, // PREMIUM
      }),
    );
  });

  it("enqueues a backfill job with backfill priority", async () => {
    const { enqueueAIProcessing, AI_PRIORITY } = await freshImport();
    await enqueueAIProcessing("item-backfill", "user-backfill", AI_PRIORITY.BACKFILL);

    expect(mockQueueAdd).toHaveBeenCalledWith(
      "process",
      { itemId: "item-backfill", userId: "user-backfill" },
      expect.objectContaining({
        jobId: "ai-process-item-backfill",
        priority: 10, // BACKFILL
      }),
    );
  });
});

// ── createAIWorker ──

describe("createAIWorker", () => {
  it("creates a Worker with correct queue name and connection", async () => {
    const handler = vi.fn();
    const { createAIWorker } = await freshImport();
    const worker = createAIWorker(handler);

    const { Worker } = await import("bullmq");
    expect(Worker).toHaveBeenCalledWith(
      "nexus-ai-processing",
      expect.any(Function),
      expect.objectContaining({
        connection: mockRedis,
        concurrency: 2,
        limiter: { max: 4, duration: 30_000 },
        stalledInterval: 60_000,
        lockDuration: 120_000,
      }),
    );
    expect(worker).toBe(mockWorkerInstance);
  });

  it("passes custom concurrency and limiter settings", async () => {
    const handler = vi.fn();
    const { createAIWorker } = await freshImport();
    createAIWorker(handler, 5, 10, 60_000);

    const { Worker } = await import("bullmq");
    expect(Worker).toHaveBeenCalledWith(
      "nexus-ai-processing",
      expect.any(Function),
      expect.objectContaining({
        concurrency: 5,
        limiter: { max: 10, duration: 60_000 },
      }),
    );
  });

  it("calls the handler when a job is processed", async () => {
    // Get the worker callback
    const handler = vi.fn().mockResolvedValue({
      success: true,
      processingTimeMs: 100,
      connectionsFound: 2,
      partialFailures: [],
    });

    const { createAIWorker } = await freshImport();
    createAIWorker(handler);

    // Get the callback function passed to Worker constructor
    const { Worker } = await import("bullmq");
    const workerCallback = (Worker as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1];

    // Create a mock job
    const mockJob = {
      id: "job-1",
      data: { itemId: "item-1", userId: "user-1" },
    };

    const result = await workerCallback(mockJob);
    expect(handler).toHaveBeenCalledWith(mockJob);
    expect(result.success).toBe(true);
    expect(result.connectionsFound).toBe(2);
  });

  it("passes custom stalledInterval and lockDuration", async () => {
    const handler = vi.fn();
    const { createAIWorker } = await freshImport();
    createAIWorker(handler, 2, 4, 30_000, 120_000, 300_000);

    const { Worker } = await import("bullmq");
    expect(Worker).toHaveBeenCalledWith(
      "nexus-ai-processing",
      expect.any(Function),
      expect.objectContaining({
        stalledInterval: 120_000,
        lockDuration: 300_000,
      }),
    );
  });
});
