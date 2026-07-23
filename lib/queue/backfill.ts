// Backfill Job - Find items missing AI processing and enqueue them
//
// BullMQ repeatable job that runs on a schedule (default: every 15 min).
// Uses cursor-based pagination across runs so ALL unprocessed items
// eventually get processed, not just the first batch.
//
// Cursor strategy:
//   - Stores the last created_at timestamp in Redis as a cursor
//   - Each run picks up from where the last run left off
//   - When the scan returns fewer items than batch size, cursor resets
//   - Items already in ai_queue (pending/processing/completed) are excluded
//
// Performance:
//   - Requires partial index: idx_items_unprocessed ON items(created_at) WHERE embedding IS NULL
//   - Subquery exclusion uses idx_ai_queue_status + idx_ai_queue_item_id_key
//
// Environment variables:
//   BACKFILL_CRON      - cron expression (default: "*/15 * * * *")
//   BACKFILL_BATCH     - max items to scan per run (default: 200)
//   BACKFILL_ENABLED   - set to "false" to disable (default: true)

import { Queue, Worker } from "bullmq";
import type { JobsOptions, Job } from "bullmq";
import { getRedisConnection, QUEUES } from "./config";
import { enqueueAIProcessing, AI_PRIORITY } from "./ai-queue";
import { createServiceClient } from "@/lib/supabase/server";
import { incrementBackfillFailures, resetBackfillFailures } from "./alerts";

// ── Cursor key in Redis ──

const CURSOR_KEY = "nexus:backfill:cursor";

async function getCursor(): Promise<string | null> {
  try {
    const redis = getRedisConnection();
    const val = await redis.get(CURSOR_KEY);
    return val || null;
  } catch (err) {
    console.warn("[Backfill] Failed to read cursor:", err);
    return null;
  }
}

async function setCursor(createdAt: string): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.set(CURSOR_KEY, createdAt);
  } catch (err) {
    console.warn("[Backfill] Failed to save cursor:", err);
  }
}

async function clearCursor(): Promise<void> {
  try {
    const redis = getRedisConnection();
    await redis.del(CURSOR_KEY);
  } catch (err) {
    console.warn("[Backfill] Failed to clear cursor:", err);
  }
}

// ── Job data & result types ──

export interface BackfillJobData {
  startedAt: string;
  batchSize: number;
}

export interface BackfillJobResult {
  scanned: number;
  enqueued: number;
  skipped: number; // already queued or already being processed
  errors: number;
  hasMore: boolean; // true if there are more items to scan
  cursor: string | null; // current cursor position for monitoring
}

// ── Config ──

const BACKFILL_CRON = process.env.BACKFILL_CRON || "*/15 * * * *";
const BACKFILL_BATCH = parseInt(process.env.BACKFILL_BATCH || "200", 10);
const BACKFILL_ENABLED = process.env.BACKFILL_ENABLED !== "false";
const BACKFILL_JOB_ID = "backfill:scan";

// ── Backfill queue ──

export const backfillQueue = new Queue<BackfillJobData, BackfillJobResult>(QUEUES.MAINTENANCE, {
  connection: getRedisConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 10_000 },
    removeOnComplete: { age: 7200 },
    removeOnFail: { age: 86400 },
  },
});

// ── Backfill scan logic ──

export async function runBackfillScan(
  batchSize: number = BACKFILL_BATCH,
): Promise<BackfillJobResult> {
  const result: BackfillJobResult = {
    scanned: 0,
    enqueued: 0,
    skipped: 0,
    errors: 0,
    hasMore: false,
    cursor: null,
  };

  const supabase = await createServiceClient();

  try {
    // 1. Get cursor — where we left off last run
    const cursor = await getCursor();
    console.log("[Backfill] Cursor: " + (cursor || "start"));

    // 2. Build query with cursor-based pagination and queue exclusion
    let query = supabase
      .from("items")
      .select("id, user_id, title, created_at")
      .is("embedding", null)
      .order("created_at", { ascending: true })
      .limit(batchSize);

    // Apply cursor if set — use gte to avoid skipping items with the same timestamp
    // (the embedding IS NULL filter and queue exclusion prevent reprocessing)
    if (cursor) {
      query = query.gte("created_at", cursor);
    }

    // Exclude items already in ai_queue (pending, queued, or processing)
    // Completed items already have embeddings so they're excluded by the IS NULL filter.
    // Limit to 5000 to prevent the subquery from ballooning.
    const { data: queuedItems } = await supabase
      .from("ai_queue")
      .select("item_id")
      .in("status", ["pending", "queued", "processing"])
      .limit(5000);

    const queuedIds = new Set((queuedItems || []).map((q: { item_id: string }) => q.item_id));

    // Fetch items
    const { data: items, error } = await query;

    if (error) {
      console.error("[Backfill] Query failed:", error.message);
      result.errors = 1;
      return result;
    }

    const rawItems = items || [];

    // Filter out items already in the queue
    const unprocessed = rawItems.filter((item: { id: string }) => !queuedIds.has(item.id));
    const skippedCount = rawItems.length - unprocessed.length;

    result.scanned = rawItems.length;
    result.skipped = skippedCount;

    console.log(
      "[Backfill] Found " +
        rawItems.length +
        " items (" +
        unprocessed.length +
        " new, " +
        skippedCount +
        " already queued)",
    );

    // 3. Enqueue each unprocessed item
    for (const item of unprocessed) {
      try {
        await enqueueAIProcessing(item.id, item.user_id, AI_PRIORITY.BACKFILL);
        result.enqueued++;
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes("duplicate") || err.message.includes("already exists"))
        ) {
          result.skipped++;
        } else {
          console.warn("[Backfill] Failed to enqueue " + item.id + ":", err);
          result.errors++;
        }
      }
    }

    // 4. Update cursor
    if (rawItems.length > 0) {
      const lastItem = rawItems[rawItems.length - 1] as { created_at: string };
      await setCursor(lastItem.created_at);
      result.cursor = lastItem.created_at;
      result.hasMore = rawItems.length >= batchSize;
      console.log("[Backfill] Cursor advanced to: " + lastItem.created_at);
    }

    // If we got fewer items than batch, we've caught up — reset cursor
    if (rawItems.length < batchSize) {
      await clearCursor();
      result.cursor = null;
      result.hasMore = false;
      console.log("[Backfill] All caught up — cursor reset");
    }
  } catch (err) {
    console.error("[Backfill] Scan error:", err);
    result.errors++;
  }

  return result;
}

// ── Repeatable schedule registration ──

export async function registerBackfillSchedule(): Promise<void> {
  if (!BACKFILL_ENABLED) {
    console.log("[Backfill] Disabled via BACKFILL_ENABLED=false");
    return;
  }

  try {
    await backfillQueue.upsertJobScheduler(
      BACKFILL_JOB_ID,
      { pattern: BACKFILL_CRON, tz: "UTC" },
      {
        name: "backfill",
        data: { startedAt: new Date().toISOString(), batchSize: BACKFILL_BATCH },
        opts: {
          jobId: BACKFILL_JOB_ID,
          removeOnComplete: { age: 7200 },
          removeOnFail: { age: 86400 },
        } as JobsOptions,
      },
    );

    console.log("[Backfill] Scheduled - cron: " + BACKFILL_CRON + ", batch: " + BACKFILL_BATCH);
  } catch (err) {
    console.error("[Backfill] Failed to register schedule:", err);
    console.log("[Backfill] Backfill scan will NOT run automatically.");
  }
}

export async function removeBackfillSchedule(): Promise<void> {
  try {
    await backfillQueue.removeJobScheduler(BACKFILL_JOB_ID);
    console.log("[Backfill] Schedule removed.");
  } catch (err) {
    console.error("[Backfill] Failed to remove schedule:", err);
  }
}

// ── Maintenance worker ──

export function createMaintenanceWorker(): Worker<BackfillJobData, BackfillJobResult> {
  const worker = new Worker<BackfillJobData, BackfillJobResult>(
    QUEUES.MAINTENANCE,
    async (job: Job<BackfillJobData, BackfillJobResult>) => {
      if (job.name === "backfill") {
        console.log("[Backfill] Starting scan (batch: " + job.data.batchSize + ")");
        const result = await runBackfillScan(job.data.batchSize);
        console.log(
          "[Backfill] Scan complete - scanned: " +
            result.scanned +
            ", enqueued: " +
            result.enqueued +
            ", skipped: " +
            result.skipped +
            ", errors: " +
            result.errors +
            ", hasMore: " +
            result.hasMore,
        );
        return result;
      }
      throw new Error("Unknown job type: " + job.name);
    },
    {
      connection: getRedisConnection(),
      concurrency: 1,
    },
  );

  worker.on("completed", (job: Job<BackfillJobData, BackfillJobResult>) => {
    const r = job.returnvalue;
    // Track success — resets consecutive failure counter in Redis
    resetBackfillFailures().catch(() => {});
    console.log(
      "[Backfill] " +
        r.enqueued +
        " items enqueued, " +
        r.errors +
        " errors" +
        (r.hasMore ? " (more items remain)" : " (all caught up)"),
    );
  });

  worker.on("failed", (job: Job<BackfillJobData, BackfillJobResult> | undefined, err: Error) => {
    // Track failure — increments consecutive failure counter in Redis
    incrementBackfillFailures().catch(() => {});
    console.error("[Backfill] Job failed: " + err.message);
  });

  return worker;
}
