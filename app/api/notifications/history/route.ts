import { NextRequest, NextResponse } from "next/server";
import { getNotificationHistory } from "@/lib/notifications/history";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications/history
 *
 * Returns recent notification history, newest first.
 * Used by the settings page to show past test and alert notifications.
 *
 * Query params:
 *   limit - max entries to return (default: 50, max: 200)
 *
 * Response: { history: NotificationHistoryEntry[] }
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get("limit");
    const limit = Math.min(Math.max(parseInt(limitParam || "50", 10) || 50, 1), 200);

    const history = await getNotificationHistory(limit);

    return NextResponse.json({ history });
  } catch (error) {
    console.error("GET /api/notifications/history error:", error);
    return NextResponse.json(
      {
        history: [],
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
