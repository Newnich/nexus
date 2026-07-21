import { NextResponse } from "next/server";
import { getAIQueue } from "@/lib/queue/ai-queue";
import { backfillQueue } from "@/lib/queue/backfill";
import { getRedisConnection } from "@/lib/queue/config";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

const CURSOR_KEY = "nexus:backfill:cursor";

/**
 * Mask a webhook URL for safe display — shows host + first 16 chars of path, then ****
 */
function maskUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const path = parsed.pathname;
    if (path.length > 20) {
      return host + path.substring(0, 16) + "****";
    }
    return host + path;
  } catch {
    return url.substring(0, 30) + "****";
  }
}

/**
 * GET /api/queue/status
 *
 * Returns system health information for the status page.
 * Includes Redis connectivity, queue depths, backfill status,
 * cursor position, and unprocessed item count.
 */
export async function GET() {
  try {
    // Check Redis connectivity
    const redis = getRedisConnection();
    const redisStatus = redis.status === "ready" ? "connected" : redis.status;

    // Get queue job counts and backfill schedulers in parallel
    const [aiCounts, maintenanceCounts, backfillSchedulers, cursor] = await Promise.all([
      getAIQueue().getJobCounts(),
      backfillQueue.getJobCounts(),
      backfillQueue.getJobSchedulers(),
      redis.get(CURSOR_KEY).catch(() => null),
    ]);

    const nextBackfill = backfillSchedulers.length > 0
      ? backfillSchedulers[0].next
      : null;

    // Get unprocessed item count from database
    let unprocessedCount: number | null = null;
    try {
      const supabase = await createServiceClient();
      const { count } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .is("embedding", null);
      unprocessedCount = count;
    } catch {
      // Best-effort
    }

    // Get last backfill job result for stats
    let lastBackfillRun: {
      scanned: number;
      enqueued: number;
      skipped: number;
      errors: number;
      hasMore: boolean;
      completedAt: string | null;
    } | null = null;

    try {
      const completedJobs = await backfillQueue.getCompleted(0, 1);
      if (completedJobs.length > 0) {
        const job = completedJobs[0];
        const data = job.returnvalue as {
          scanned: number;
          enqueued: number;
          skipped: number;
          errors: number;
          hasMore: boolean;
        } | null;
        if (data) {
          lastBackfillRun = {
            scanned: data.scanned,
            enqueued: data.enqueued,
            skipped: data.skipped,
            errors: data.errors,
            hasMore: data.hasMore,
            completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
          };
        }
      }
    } catch {
      // Best-effort
    }

    return NextResponse.json({
      redis: redisStatus,
      queues: {
        ai_processing: {
          waiting: aiCounts.waiting || 0,
          active: aiCounts.active || 0,
          completed: aiCounts.completed || 0,
          failed: aiCounts.failed || 0,
          delayed: aiCounts.delayed || 0,
        },
        maintenance: {
          waiting: maintenanceCounts.waiting || 0,
          active: maintenanceCounts.active || 0,
          completed: maintenanceCounts.completed || 0,
          failed: maintenanceCounts.failed || 0,
          delayed: maintenanceCounts.delayed || 0,
        },
      },
      backfill: {
        cursor: cursor,
        schedule: process.env.BACKFILL_CRON || "*/15 * * * *",
        nextRun: nextBackfill,
        batchSize: parseInt(process.env.BACKFILL_BATCH || "200", 10),
        enabled: process.env.BACKFILL_ENABLED !== "false",
        lastRun: lastBackfillRun,
        hasMore: lastBackfillRun?.hasMore ?? false,
      },
      database: {
        unprocessedItems: unprocessedCount,
      },
      config: {
        redisHost: process.env.REDIS_HOST || "localhost",
        redisPort: process.env.REDIS_PORT || "6379",
        ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
        workerConcurrency: process.env.WORKER_CONCURRENCY || "2",
        backfillCron: process.env.BACKFILL_CRON || "*/15 * * * *",
        backfillBatch: process.env.BACKFILL_BATCH || "200",
        dbListener: !!process.env.DATABASE_URL,
        // Notification channel configuration (URLs are masked — no raw secrets exposed)
        slackWebhookUrl: maskUrl(process.env.SLACK_WEBHOOK_URL),
        discordWebhookUrl: maskUrl(process.env.DISCORD_WEBHOOK_URL),
        resendApiKey: !!process.env.RESEND_API_KEY,
        alertEmailTo: process.env.ALERT_EMAIL_TO || null,
        alertEmailFrom: process.env.ALERT_EMAIL_FROM || null,
      },
    });
  } catch (error) {
    console.error("GET /api/queue/status error:", error);
    return NextResponse.json(
      {
        redis: "error",
        queues: null,
        backfill: null,
        database: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
