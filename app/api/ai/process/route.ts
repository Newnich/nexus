import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enqueueAIProcessing } from "@/lib/queue/ai-queue";

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/process
 *
 * Enqueues an item for AI background processing via BullMQ.
 * Previously this route processed inline (which could time out);
 * now it returns immediately after queueing the job.
 *
 * Body: { itemId: string }
 * Response: { success: true, queued: true, itemId }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { itemId } = await request.json();
    if (!itemId) {
      return NextResponse.json(
        { error: "itemId is required" },
        { status: 400 }
      );
    }

    // Verify the item exists and belongs to the user
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("id")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Create a DB queue entry if one doesn't exist
    const { data: existingQueue } = await supabase
      .from("ai_queue")
      .select("id, status")
      .eq("item_id", itemId)
      .maybeSingle();

    if (!existingQueue) {
      await supabase.from("ai_queue").insert({
        item_id: itemId,
        status: "queued",
        priority: 1,
      });
    } else if (existingQueue.status === "completed") {
      // Already processed — reset to allow reprocessing
      await supabase
        .from("ai_queue")
        .update({ status: "queued", error: null, started_at: null, completed_at: null })
        .eq("item_id", itemId);
    }

    // Enqueue the processing job
    await enqueueAIProcessing(itemId, user.id, 1);

    return NextResponse.json({
      success: true,
      queued: true,
      itemId,
    });
  } catch (error) {
    console.error("POST /api/ai/process error:", error);
    return NextResponse.json(
      { error: "Failed to queue AI processing" },
      { status: 500 }
    );
  }
}
