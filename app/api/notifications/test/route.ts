import { NextRequest, NextResponse } from "next/server";
import { sendTestWebhookNotification } from "@/lib/notifications/webhook";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/test
 *
 * Sends a test notification to a configured webhook channel.
 * Used from the settings page to verify Slack/Discord configuration.
 *
 * Note: History recording happens inside sendToWebhook (called by
 * sendTestWebhookNotification), so no separate recordNotification
 * call is needed here.
 *
 * Body: { channel: "slack" | "discord" }
 *
 * Response: { success: boolean, result: { channel, sent, error?, alertId } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channel } = body as { channel?: string };

    if (!channel || (channel !== "slack" && channel !== "discord")) {
      return NextResponse.json(
        { success: false, error: "Invalid channel — must be 'slack' or 'discord'" },
        { status: 400 }
      );
    }

    const result = await sendTestWebhookNotification(channel);

    return NextResponse.json({
      success: result.sent,
      result,
    });
  } catch (error) {
    console.error("POST /api/notifications/test error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
