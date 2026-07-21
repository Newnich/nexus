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
 */

import { createAIWorker, type AIProcessJobData, type AIProcessJobResult } from "@/lib/queue/ai-queue";
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
    await supabase.from("ai_queue").upsert({
      item_id: itemId,
      status: "processing",
      priority: 0,
      started_at: new Date().toISOString(),
    }, { onConflict: "item_id" });

    // ── Step 2: Fetch existing items for connection finding ──
    const { data: existingItems } = await supabase
      .from("items")
      .select("id, title, ai_data")
      .eq("user_id", userId)
      .neq("id", itemId)
      .not("ai_data", "is", null)
      .limit(20);

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
      existingSummaries.length > 0 ? existingSummaries : undefined
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

      const { error: connError } = await supabase
        .from("connections")
        .upsert(connectionRecords, {
          onConflict: "from_item_id, to_item_id, type",
          ignoreDuplicates: true,
        });

      if (connError) {
        partialFailures.push("connections");
        console.warn("[AI Worker] Failed to create connections:", connError.message);
      }
    }

    // Mark as completed in the DB queue (upsert - handles backfill path)
    await supabase.from("ai_queue").upsert({
      item_id: itemId,
      status: "completed",
      completed_at: new Date().toISOString(),
    }, { onConflict: "item_id" });

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
      await supabase.from("ai_queue").upsert({
        item_id: itemId,
        status: "failed",
        error: errorMessage,
        completed_at: new Date().toISOString(),
      }, { onConflict: "item_id" });
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

// ── Start the worker ──

async function main() {
  console.log("╔══════════════════════════════════════════════════════╗");
  console.log("║   NEXUS — AI Background Worker                       ║");
  console.log("╚══════════════════════════════════════════════════════╝");
  console.log();
  console.log(`🔧 Worker starting...`);

  const concurrency = parseInt(process.env.WORKER_CONCURRENCY || "2", 10);
  console.log(`   Concurrency: ${concurrency}`);
  console.log(`   Redis:       ${process.env.REDIS_HOST || "localhost"}:${process.env.REDIS_PORT || "6379"}`);
  console.log(`   Ollama:      ${process.env.OLLAMA_URL || "http://localhost:11434"}`);
  console.log();

  // Start the Postgres LISTEN/NOTIFY listener to auto-enqueue AI jobs
  // when items are created via the database trigger
  await startDbListener();

  // Register the repeatable backfill scan schedule
  await registerBackfillSchedule();

  // ── Create workers ──
  const aiWorker = createAIWorker(handleAIProcess);
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

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down workers...");
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
  console.log(`   Maintenance:    ${maintenanceWorker.name} (cron: ${process.env.BACKFILL_CRON || "*/15 * * * *"})`);
  console.log();
  console.log("   Press Ctrl+C to stop.");
}

main().catch((err) => {
  console.error("Fatal worker error:", err);
  process.exit(1);
});
