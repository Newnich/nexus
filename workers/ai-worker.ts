#!/usr/bin/env tsx
/**
 * NEXUS AI Worker — Standalone background job processor
 *
 * Runs as an independent Node.js process, listening for AI processing jobs
 * on the BullMQ queue. It uses the existing AI pipeline to generate
 * embeddings, summaries, tags, categories, key points, sentiment, and
 * semantic connections for items.
 *
 * Usage:
 *   npx tsx workers/ai-worker.ts
 *
 * Requires:
 *   - Redis running on REDIS_HOST:REDIS_PORT (default localhost:6379)
 *   - Ollama running on OLLAMA_URL (default http://localhost:11434)
 *   - .env.local or environment variables for Supabase credentials
 *
 * Optional environment variables:
 *   WORKER_CONCURRENCY — how many items to process simultaneously (default 2)
 *   WORKER_POLL_INTERVAL — polling interval in ms (default: uses BullMQ default)
 *   WORKER_LIMITER_MAX — max jobs per limiter window (default 4)
 *   WORKER_LIMITER_DURATION — limiter window in ms (default 30000)
 *   WORKER_STALLED_INTERVAL — how often to check for stalled jobs in ms (default 60000)
 *   WORKER_LOCK_DURATION — max job processing time in ms before stalled (default 120000)
 *   WORKER_HEALTH_PORT — health check HTTP server port (default 9090)
 *   JOB_RETAIN_COMPLETE_HOURS — keep completed jobs for N hours (default 1)
 *   JOB_RETAIN_FAIL_HOURS — keep failed jobs for N hours (default 24)
 *   AI_CONNECTION_LIMIT — max existing items to fetch for connection discovery (default 20)
 */

import http from "http";
import {
  createAIWorker,
  type AIProcessJobData,
  type AIProcessJobResult,
} from "@/lib/queue/ai-queue";
import { processNewItem } from "@/lib/ai/pipeline";
import { storeEmbedding } from "@/lib/vector/pgvector";
import { createServiceClient } from "@/lib/supabase/server";
import { closeRedisConnection } from "@/lib/queue/config";
import { startDbListener, stopDbListener } from "@/lib/queue/listener";
import {
  registerBackfillSchedule,
  createMaintenanceWorker,
  removeBackfillSchedule,
} from "@/lib/queue/backfill";
import type { Job } from "bullmq";

// ── Config (module-level so both the handler and main() can access) ──

/** Max existing items to fetch for connection discovery (default 20). */
const AI_CONNECTION_LIMIT = parseInt(process.env.AI_CONNECTION_LIMIT || "20", 10);
const WORKER_HEALTH_PORT = parseInt(process.env.WORKER_HEALTH_PORT || "9090", 10);

// ── Job handler ──

async function handleAIProcess(job: Job<AIProcessJobData>): Promise<AIProcessJobResult> {
  const { itemId, userId } = job.data;
  const startTime = performance.now();
  const partialFailures: string[] = [];

  const supabase = await createServiceClient();

  try {
    // ── Step 1: Fetch the item ──
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !item) {
      throw new Error(`Item not found: ${fetchError?.message || "unknown"}`);
    }

    // Mark as processing in the DB queue (upsert - creates row if missing for backfill)
    await supabase.from("ai_queue").upsert(
      {
        item_id: itemId,
        status: "processing",
        priority: 0,
        started_at: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );

    // ── Step 2: Fetch existing items for connection finding ──
    const { data: existingItems } = await supabase
      .from("items")
      .select("id, title, ai_data")
      .eq("user_id", userId)
      .neq("id", itemId)
      .not("ai_data", "is", null)
      .limit(AI_CONNECTION_LIMIT);

    const existingSummaries = (existingItems || []).map((i) => ({
      id: i.id,
      title: i.title || "",
      summary: ((i.ai_data as Record<string, unknown> | null)?.summary as string) || "",
    }));

    // ── Step 3: Run the AI pipeline ──
    const result = await processNewItem(
      {
        id: item.id,
        title: item.title,
        content: item.content || "",
        extractedText: item.extracted_text || "",
      },
      existingSummaries.length > 0 ? existingSummaries : undefined,
    );

    // Collect partial failures
    partialFailures.push(...result.partialFailures);

    // ── Step 4: Persist results ──

    // Update item with AI data
    const { error: updateError } = await supabase
      .from("items")
      .update({ ai_data: result.aiData })
      .eq("id", itemId);

    if (updateError) {
      throw new Error(`Failed to update item AI data: ${updateError.message}`);
    }

    // Store embedding in pgvector
    if (result.aiData.embedding && result.aiData.embedding.length > 0) {
      try {
        await storeEmbedding(itemId, result.aiData.embedding, userId);
      } catch (vectorError) {
        partialFailures.push("vector_storage");
        console.warn("[AI Worker] Failed to store embedding:", vectorError);
      }
    } else {
      console.warn("[AI Worker] Skipping vector storage — embedding is empty");
    }

    // Create semantic connections
    if (result.connections.length > 0) {
      const connectionRecords = result.connections.map((conn) => ({
        user_id: userId,
        from_item_id: itemId,
        to_item_id: conn.itemId,
        type: "semantic" as const,
        strength: conn.strength,
        description: conn.reason,
      }));

      const { error: connError } = await supabase.from("connections").upsert(connectionRecords, {
        onConflict: "from_item_id, to_item_id, type",
        ignoreDuplicates: true,
      });

      if (connError) {
        partialFailures.push("connections");
        console.warn("[AI Worker] Failed to create connections:", connError.message);
      }
    }

    // Mark as completed in the DB queue (upsert - handles backfill path)
    await supabase.from("ai_queue").upsert(
      {
        item_id: itemId,
        status: "completed",
        completed_at: new Date().toISOString(),
      },
      { onConflict: "item_id" },
    );

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: userId,
      action: "ai_process",
      entity_type: "item",
      entity_id: itemId,
      metadata: {
        processingTime: result.processingTime,
        connectionsFound: result.connections.length,
        partialFailures,
      },
    });

    const processingTimeMs = performance.now() - startTime;

    return {
      success: true,
      processingTimeMs,
      connectionsFound: result.connections.length,
      partialFailures,
    };
  } catch (error) {
    const processingTimeMs = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Mark as failed in the DB queue (upsert - handles backfill path)
    try {
      await supabase.from("ai_queue").upsert(
        {
          item_id: itemId,
          status: "failed",
          error: errorMessage,
          completed_at: new Date().toISOString(),
        },
        { onConflict: "item_id" },
      );
    } catch {
      // Best-effort
    }

    console.error(`[AI Worker] Failed to process item ${itemId}:`, errorMessage);

    return {
      success: false,
      processingTimeMs,
      connectionsFound: 0,
      partialFailures,
    };
  }
}

// ── Helpers ──

/** Retry an async function with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    label: string;
    maxRetries?: number;
    baseDelayMs?: number;
    onRetry?: (attempt: number, error: Error) => void;
  },
): Promise<T | null> {
  const { label, maxRetries = 5, baseDelayMs = 1000, onRetry } = options;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (attempt === maxRetries) {
        console.warn(`⚠️ [Worker] ${label} failed after ${maxRetries} attempts: ${error.message}`);
        return null;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      console.warn(
        `⚠️ [Worker] ${label} attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`,
      );

      if (onRetry) onRetry(attempt, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return null;
}

// ── Health check HTTP server ──

let healthServer: http.Server | null = null;
let isHealthy = false;

/**
 * Start a minimal HTTP health check server for Docker HEALTHCHECK.
 * Responds 200 when the worker is connected and processing, 503 otherwise.
 */
function startHealthServer(): void {
  healthServer = http.createServer(async (req, res) => {
    if (req.url === "/health" || req.url === "/") {
      if (isHealthy) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "ok", service: "nexus-ai-worker" }));
      } else {
        res.writeHead(503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ status: "starting", service: "nexus-ai-worker" }));
      }
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  healthServer.listen(WORKER_HEALTH_PORT, "0.0.0.0", () => {
    console.log(`   Health check:  http://0.0.0.0:${WORKER_HEALTH_PORT}/health`);
  });

  healthServer.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`⚠️ [Health] Port ${WORKER_HEALTH_PORT} in use — health check unavailable`);
    } else {
      console.error("⚠️ [Health] Server error:", err.message);
    }
  });
}

function stopHealthServer(): void {
  if (healthServer) {
    healthServer.close();
    healthServer = null;
  }
}

// ── Start the worker ──

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   NEXUS — AI Background Worker                       ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log();
  console.log(`🔧 Worker starting...`);

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);
  const limiterMax = parseInt(process.env.WORKER_LIMITER_MAX || "4", 10);
  const limiterDuration = parseInt(process.env.WORKER_LIMITER_DURATION || "30000", 10);
  const stalledInterval = parseInt(process.env.WORKER_STALLED_INTERVAL || "60000", 10);
  const lockDuration = parseInt(process.env.WORKER_LOCK_DURATION || "120000", 10);
  console.log(`   Concurrency: ${concurrency}`);
  console.log(`   Connection limit: ${AI_CONNECTION_LIMIT}`);
  console.log(`   Worker limiter:   ${limiterMax} jobs / ${limiterDuration}ms`);
  console.log(`   Stalled check:    every ${stalledInterval}ms`);
  console.log(`   Lock duration:    ${lockDuration}ms`);
  console.log(
    `   Redis:       ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`,
  );
  console.log(`   Ollama:      ${process.env.OLLAMA_URL || "http://localhost:11434"}`);
  console.log(`   Health:      http://0.0.0.0:${WORKER_HEALTH_PORT}/health`);
  console.log();

  // Start the health check HTTP server (for Docker HEALTHCHECK)
  startHealthServer();

  // Start the Postgres LISTEN/NOTIFY listener to auto-enqueue AI jobs
  // when items are created via the database trigger.
  // Retry with exponential backoff in case Supabase isn't ready yet.
  await withRetry(() => startDbListener(), {
    label: "Database listener startup",
    maxRetries: 5,
    baseDelayMs: 2000,
  });

  // Register the repeatable backfill scan schedule.
  // If Redis isn't ready yet, retry with exponential backoff.
  await withRetry(() => registerBackfillSchedule(), {
    label: "Backfill schedule registration",
    maxRetries: 5,
    baseDelayMs: 2000,
  });

  // ── Create workers ──
  const aiWorker = createAIWorker(
    handleAIProcess,
    concurrency,
    limiterMax,
    limiterDuration,
    stalledInterval,
    lockDuration,
  );
  const maintenanceWorker = createMaintenanceWorker();

  // Event handlers for observability
  aiWorker.on("completed", (job) => {
    console.log(`✅ [${job.id}] Completed — ${job.returnvalue.processingTimeMs.toFixed(0)}ms`);
  });

  aiWorker.on("failed", (job, err) => {
    console.error(`❌ [${job?.id}] Failed — ${err.message}`);
  });

  aiWorker.on("error", (err) => {
    console.error("⚠️ [AI Worker] Error:", err.message);
  });

  aiWorker.on("stalled", (jobId) => {
    console.warn(`⚠️ [AI Worker] Stalled job detected: ${jobId}`);
  });

  // Worker is now fully initialized — mark as healthy for Docker HEALTHCHECK
  isHealthy = true;

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down workers...");
    isHealthy = false;
    stopHealthServer();
    await aiWorker.close();
    await maintenanceWorker.close();
    await removeBackfillSchedule();
    await stopDbListener();
    await closeRedisConnection();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log(`📡 Workers running:`);
  console.log(`   AI Processing:  ${aiWorker.name} (concurrency: ${aiWorker.opts.concurrency})`);
  console.log(
    `   Maintenance:    ${maintenanceWorker.name} (cron: ${process.env.BACKFILL_CRON || "*/15 * * * *"})`,
  );
  console.log();
  console.log("   Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
