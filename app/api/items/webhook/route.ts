import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { enqueueAIProcessing } from "@/lib/queue/ai-queue";
import type { CreateItemInput } from "@/types/item";

export const dynamic = "force-dynamic";

interface WebhookItemInput {
  type?: string;
  title?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

/**
 * POST /api/items/webhook
 *
 * Accepts external POST requests (e.g., from browser extension, Zapier, curl)
 * to create items in NEXUS.
 *
 * Authentication: Requires X-API-Key header with a valid NEXUS API key.
 * This is the same key system used by /api/external/* routes.
 *
 * Body:
 *   { type: "link" | "note" | ..., title: string, content?: string, metadata?: {...} }
 *
 * Response:
 *   { success: true, item: { id, title, type, ... } }
 *
 * Example usage:
 *   curl -X POST https://your-nexus.app/api/items/webhook \
 *     -H "X-API-Key: nx_YOUR_API_KEY" \
 *     -H "Content-Type: application/json" \
 *     -d '{"type":"link","title":"My Article","content":"https://example.com"}'
 */
export async function POST(request: NextRequest) {
  try {
    // ── API Key Authentication ──
    const apiKey = request.headers.get("X-API-Key") || "";

    if (!apiKey || !apiKey.startsWith("nx_")) {
      return NextResponse.json(
        { error: "Missing or invalid API key. Provide X-API-Key header with a valid nx_ key." },
        { status: 401 },
      );
    }

    // Validate the API key and get the associated user
    const supabase = await createServiceClient();
    const { data: keyData, error: keyError } = await supabase
      .from("api_keys")
      .select("user_id, is_active")
      .eq("key", apiKey)
      .single();

    if (keyError || !keyData) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (!keyData.is_active) {
      return NextResponse.json({ error: "API key is disabled" }, { status: 403 });
    }

    const userId = keyData.user_id;

    // ── Parse and validate body ──
    let body: WebhookItemInput;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (!body.title || typeof body.title !== "string") {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const itemType = body.type || "link";
    const validTypes = [
      "link",
      "note",
      "file",
      "image",
      "screenshot",
      "voice_memo",
      "pdf",
      "video",
    ];
    if (!validTypes.includes(itemType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 },
      );
    }

    // ── Create item in database ──
    const { data: item, error: insertError } = await supabase
      .from("items")
      .insert({
        user_id: userId,
        type: itemType,
        title: body.title,
        content: body.content || "",
        metadata: body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : {},
        visibility: "private",
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Webhook] Failed to create item:", insertError);
      return NextResponse.json({ error: "Failed to create item" }, { status: 500 });
    }

    // ── Enqueue AI processing (background) ──
    // Fire and forget — don't block the response
    enqueueAIProcessing(item.id, userId).catch((err) => {
      console.error("[Webhook] Failed to enqueue AI processing:", err);
    });

    return NextResponse.json(
      {
        success: true,
        item: {
          id: item.id,
          type: item.type,
          title: item.title,
          created_at: item.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[Webhook] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
