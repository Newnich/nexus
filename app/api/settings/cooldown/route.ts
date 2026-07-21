import { NextRequest, NextResponse } from "next/server";
import {
  loadCooldowns,
  saveCooldowns,
  resetCooldowns,
  DEFAULT_COOLDOWNS,
  type CooldownConfig,
} from "@/lib/notifications/cooldown";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/cooldown
 *
 * Returns current cooldown configuration (in minutes).
 * Response: { cooldown: CooldownConfig }
 */
export async function GET() {
  try {
    const cooldown = await loadCooldowns();
    return NextResponse.json({ cooldown });
  } catch (error) {
    console.error("GET /api/settings/cooldown error:", error);
    return NextResponse.json(
      {
        cooldown: null,
        defaults: DEFAULT_COOLDOWNS,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/settings/cooldown
 *
 * Saves updated cooldown configuration.
 * Values are sanitized to valid ranges (1 min – 1440 min / 24 hours).
 *
 * Body: { cooldown: Partial<CooldownConfig> }
 *
 * Response: { success: boolean, cooldown: CooldownConfig }
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { cooldown } = body as { cooldown?: Partial<CooldownConfig> };

    if (!cooldown || typeof cooldown !== "object") {
      return NextResponse.json(
        { success: false, error: "Invalid cooldown object" },
        { status: 400 }
      );
    }

    const saved = await saveCooldowns(cooldown);

    if (!saved) {
      return NextResponse.json(
        { success: false, error: "Failed to save cooldown config" },
        { status: 500 }
      );
    }

    const updated = await loadCooldowns();
    return NextResponse.json({ success: true, cooldown: updated });
  } catch (error) {
    console.error("PUT /api/settings/cooldown error:", error);
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
 * DELETE /api/settings/cooldown
 *
 * Resets cooldown configuration to factory defaults.
 *
 * Response: { success: boolean, cooldown: CooldownConfig }
 */
export async function DELETE() {
  try {
    await resetCooldowns();
    return NextResponse.json({
      success: true,
      cooldown: { ...DEFAULT_COOLDOWNS },
    });
  } catch (error) {
    console.error("DELETE /api/settings/cooldown error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
