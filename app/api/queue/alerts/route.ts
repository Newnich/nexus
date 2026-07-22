import { NextRequest, NextResponse } from "next/server";
import { backfillQueue } from "@/lib/queue/backfill";
import { getRedisConnection } from "@/lib/queue/config";
import { createServiceClient } from "@/lib/supabase/server";
import { evaluateAlerts, getConsecutiveFailures } from "@/lib/queue/alerts";
import { sendCriticalAlertNotifications } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/**
 * GET /api/queue/alerts
 *
 * Evaluates system health conditions and returns active alerts.
 * The status page polls this endpoint and shows toast notifications
 * for critical/warning alerts, and a persistent alert banner.
 *
 * The `previous` query parameter is a comma-separated list of alert IDs
 * that were active in the previous poll, used to determine if an alert
 * is newly triggered (fresh) vs recurring.
 *
 * Response: { alerts: Alert[], timestamp: string }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const previousParam = searchParams.get("previous") || "";
    const previousAlertIds = new Set(previousParam ? previousParam.split(",").filter(Boolean) : []);

    // Collect health status
    const redis = getRedisConnection();
    const redisStatus = redis.status === "ready" ? "connected" : redis.status;

    // Get last backfill result and consecutive failures
    let backfillErrors = 0;
    let lastBackfillRun: {
      completedAt: string | null;
      hasErrors: boolean;
    } | null = null;

    try {
      const completedJobs = await backfillQueue.getCompleted(0, 1);
      if (completedJobs.length > 0) {
        const job = completedJobs[0];
        const data = job.returnvalue as {
          errors?: number;
        } | null;
        if (data) {
          backfillErrors = data.errors || 0;
          lastBackfillRun = {
            completedAt: job.finishedOn ? new Date(job.finishedOn).toISOString() : null,
            hasErrors: (data.errors || 0) > 0,
          };
        }
      }
    } catch {
      // Best-effort
    }

    // Get consecutive failure count from Redis
    let consecutiveFailures = 0;
    try {
      consecutiveFailures = await getConsecutiveFailures();
    } catch {
      // Best-effort
    }

    // Get unprocessed item count
    let unprocessedItems: number | null = null;
    try {
      const supabase = await createServiceClient();
      const { count } = await supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .is("embedding", null);
      unprocessedItems = count;
    } catch {
      // Best-effort
    }

    // Evaluate alerts
    const alerts = await evaluateAlerts(
      {
        redis: redisStatus,
        backfillErrors,
        consecutiveFailures,
        unprocessedItems,
        lastBackfillRun,
        backfillEnabled: process.env.BACKFILL_ENABLED !== "false",
      },
      previousAlertIds,
    );

    // Send notifications for fresh critical alerts to all configured channels (fire-and-forget)
    sendCriticalAlertNotifications(alerts).catch((err) =>
      console.error("Failed to send alert notifications:", err),
    );

    return NextResponse.json({
      alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/queue/alerts error:", error);
    return NextResponse.json(
      {
        alerts: [],
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
