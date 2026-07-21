import { NextRequest, NextResponse } from "next/server";
import {
  loadAlertThresholds,
  saveAlertThresholds,
  resetAlertThresholds,
  DEFAULT_THRESHOLDS,
  type AlertThresholds,
} from "@/lib/queue/alert-thresholds";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/alert-thresholds
 *
 * Returns current alert thresholds.
 * Response: { thresholds: AlertThresholds }
 */
export async function GET() {
  try {
    const thresholds = await loadAlertThresholds();
    return NextResponse.json({ thresholds });
  } catch (error) {
    console.error("GET /api/settings/alert-thresholds error:", error);
    return NextResponse.json(
      {
        thresholds: null,
        defaults: DEFAULT_THRESHOLDS,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/alert-thresholds
 *
 * Saves updated alert thresholds.
 * All values are sanitized to valid ranges server-side.
 *
 * Body: { thresholds: Partial<AlertThresholds> }
 *
 * Response: { success: boolean, thresholds: AlertThresholds }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { thresholds } = body as { thresholds?: Partial<AlertThresholds> };

    if (!thresholds || typeof thresholds !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid thresholds object" },
        { status: 400 }
      );
    }

    const saved = await saveAlertThresholds(thresholds);

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Failed to save thresholds" },
        { status: 500 }
      );
    }

    // Return the sanitized saved values
    const updated = await loadAlertThresholds();

    return NextResponse.json({ success: true, thresholds: updated });
  } catch (error) {
    console.error("PUT /api/settings/alert-thresholds error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/alert-thresholds
 *
 * Resets alert thresholds to factory defaults.
 *
 * Response: { success: boolean, thresholds: AlertThresholds }
 */
export async function DELETE() {
  try {
    await resetAlertThresholds();
    return NextResponse.json({
      success: true,
      thresholds: { ...DEFAULT_THRESHOLDS },
    });
  } catch (error) {
    console.error("DELETE /api/settings/alert-thresholds error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
