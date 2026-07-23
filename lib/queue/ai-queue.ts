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
        removeOnComplete: { age: 3600 },
        removeOnFail: { age: 86400 },
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
 */
export function createAIWorker(
  handler: AIProcessHandler,
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
      concurrency: 2,
      limiter: {
        max: 4,
        duration: 30_000,
      },
      stalledInterval: 60_000,
      lockDuration: 120_000,
    },
  );
}
