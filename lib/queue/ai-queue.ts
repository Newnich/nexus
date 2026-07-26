/**
 * AI Processing Queue
 *
 * Defines the BullMQ queue for asynchronous AI item processing.
 * Jobs run embeddings, summarization, tagging, categorization,
 * key-point extraction, and connection discovery.
 *
 * IMPORTANT: Queue initialization is lazy — the Redis connection is not
 * established until `getAIQueue()` or `enqueueAIProcessing()` is first
 * called. This prevents build-time ECONNREFUSED errors when Redis is
 * not available (e.g., during `next build`).
 *
 * Usage (producer — API route):
 *   import { enqueueAIProcessing } from "@/lib/queue/ai-queue";
 *   await enqueueAIProcessing(itemId, userId);
 *
 * Usage (consumer — worker):
 *   import { createAIWorker } from "@/lib/queue/ai-queue";
 *   createAIWorker(handler);
 */

import { Queue, Worker, type Job } from "bullmq";
import { getRedisConnection, QUEUES, aiProcessingJobId } from "./config";
import type { ItemAIData } from "@/types/item";

// ── Priority levels (lower = processed sooner) ──
// Premium users get priority ~1 (processed first)
// Free users get priority ~5 (standard)
// Backfill items get priority ~10 (lowest, batch background)
export const AI_PRIORITY = {
  PREMIUM: 1,
  STANDARD: 5,
  BACKFILL: 10,
} as const;

// ── Job data & result types ──

export interface AIProcessJobData {
  itemId: string;
  userId: string;
}

export interface AIProcessJobResult {
  success: boolean;
  processingTimeMs: number;
  connectionsFound: number;
  partialFailures: string[];
}

// ── Lazy queue singleton ──
// Created at module level but connection is deferred because getRedisConnection()
// only connects on first call. The Queue constructor doesn't eagerly connect
// — it waits for the first job. However, importing this module during build
// can still fail if Redis is unreachable. We use a lazy getter pattern.

/** Job retention in seconds — shared by AI queue and backfill queue. */
export const JOB_RETAIN_COMPLETE =
  parseInt(process.env.JOB_RETAIN_COMPLETE_HOURS || "1", 10) * 3600;
export const JOB_RETAIN_FAIL = parseInt(process.env.JOB_RETAIN_FAIL_HOURS || "24", 10) * 3600;

let _queue: Queue<AIProcessJobData, AIProcessJobResult, string> | null = null;

/**
 * Returns the AI processing queue, creating it lazily on first access.
 * This ensures that importing this module during `next build` does not
 * trigger an immediate Redis connection attempt.
 */
export function getAIQueue(): Queue<AIProcessJobData, AIProcessJobResult, string> {
  if (!_queue) {
    _queue = new Queue<AIProcessJobData, AIProcessJobResult, string>(QUEUES.AI_PROCESSING, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5_000,
        },
        removeOnComplete: { age: JOB_RETAIN_COMPLETE },
        removeOnFail: { age: JOB_RETAIN_FAIL },
      },
    });
  }
  return _queue;
}

/**
 * Convenience function to enqueue an item for AI processing.
 * Uses the item ID as the job ID for deduplication.
 * The queue is created lazily on first call.
 */
export async function enqueueAIProcessing(
  itemId: string,
  userId: string,
  priority: number = AI_PRIORITY.STANDARD,
): Promise<void> {
  const queue = getAIQueue();
  await queue.add(
    "process",
    { itemId, userId },
    {
      jobId: aiProcessingJobId(itemId),
      priority,
    },
  );
}

// ── Worker (consumer side) ──

export type AIProcessHandler = (job: Job<AIProcessJobData>) => Promise<AIProcessJobResult>;

/**
 * Create an AI processing worker.
 * The `handler` callback is where the actual pipeline logic runs
 * (imported from lib/ai/pipeline.ts).
 *
 * The worker is NOT started automatically — the standalone worker
 * script (workers/ai-worker.ts) calls `.run()` on it.
 *
 * @param handler - Job handler function
 * @param concurrency - Number of items to process simultaneously (default 2)
 * @param limiterMax - Max jobs per limiter window (default 4)
 * @param limiterDuration - Limiter window in ms (default 30000)
 * @param stalledInterval - How often to check for stalled jobs in ms (default 60000)
 * @param lockDuration - Max job processing time before being considered stalled in ms (default 120000)
 *
 * Rate limiting (env vars):
 *   WORKER_LIMITER_MAX           — Max jobs per limiter window (default 4)
 *   WORKER_LIMITER_DURATION      — Limiter window in ms (default 30000)
 *   WORKER_STALLED_INTERVAL      — Stalled job check interval in ms (default 60000)
 *   WORKER_LOCK_DURATION         — Max job processing time in ms (default 120000)
 *
 * Job retention (env vars — affects Redis memory):
 *   JOB_RETAIN_COMPLETE_HOURS    — Keep completed jobs for N hours (default 1)
 *   JOB_RETAIN_FAIL_HOURS        — Keep failed jobs for N hours (default 24)
 */
export function createAIWorker(
  handler: AIProcessHandler,
  concurrency: number = 2,
  limiterMax: number = 4,
  limiterDuration: number = 30_000,
  stalledInterval: number = 60_000,
  lockDuration: number = 120_000,
): Worker<AIProcessJobData, AIProcessJobResult> {
  return new Worker<AIProcessJobData, AIProcessJobResult>(
    QUEUES.AI_PROCESSING,
    async (job) => {
      console.log(`[AI Worker] Processing job ${job.id} — item ${job.data.itemId}`);
      const result = await handler(job);
      console.log(
        `[AI Worker] Completed job ${job.id} — ${result.processingTimeMs.toFixed(0)}ms, ${result.connectionsFound} connections`,
      );
      return result;
    },
    {
      connection: getRedisConnection(),
      concurrency,
      limiter: {
        max: limiterMax,
        duration: limiterDuration,
      },
      stalledInterval,
      lockDuration,
    },
  );
}
