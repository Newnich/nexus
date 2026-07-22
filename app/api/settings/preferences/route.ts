import { NextRequest, NextResponse } from "next/server";
import {
  loadPreferences,
  savePreferences,
  type NotificationPreferences,
} from "@/lib/notifications/preferences";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/preferences
 *
 * Returns current notification preferences.
 * Response: { preferences: NotificationPreferences }
 */
export async function GET() {
  try {
    const preferences = await loadPreferences();
    return NextResponse.json({ preferences });
  } catch (error) {
    console.error("GET /api/settings/preferences error:", error);
    return NextResponse.json(
      {
        preferences: null,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/settings/preferences
 *
 * Saves updated notification preferences.
 *
 * Body: { preferences: NotificationPreferences }
 *
 * Response: { success: boolean }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { preferences } = body as { preferences?: NotificationPreferences };

    if (!preferences || typeof preferences !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid preferences object" },
        { status: 400 },
      );
    }

    const saved = await savePreferences(preferences);

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Failed to save preferences" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/settings/preferences error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
