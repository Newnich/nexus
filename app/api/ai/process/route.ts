import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { processNewItem } from "@/lib/ai/pipeline";
import { upsertVector } from "@/lib/vector/pinecone";

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

    // Get item from database
    const { data: item, error: itemError } = await supabase
      .from("items")
      .select("*")
      .eq("id", itemId)
      .eq("user_id", user.id)
      .single();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Item not found" },
        { status: 404 }
      );
    }

    // Mark as processing
    await supabase
      .from("ai_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("item_id", itemId);

    // Get existing items for connection finding
    const { data: existingItems } = await supabase
      .from("items")
      .select("id, title, ai_data->>summary")
      .eq("user_id", user.id)
      .neq("id", itemId)
      .not("ai_data", "is", null)
      .limit(20);

    const existingSummaries = (existingItems || []).map((item) => ({
      id: item.id,
      title: item.title || "",
      summary: (item as Record<string, unknown>).summary as string || "",
    }));

    // Run AI processing pipeline
    const result = await processNewItem(
      {
        id: item.id,
        title: item.title,
        content: item.content || "",
        extractedText: item.extracted_text || "",
      },
      existingSummaries.length > 0 ? existingSummaries : undefined
    );

    // Update item with AI data
    const { error: updateError } = await supabase
      .from("items")
      .update({
        ai_data: result.aiData,
      })
      .eq("id", itemId);

    if (updateError) throw updateError;

    // Store embedding in Pinecone
    try {
      await upsertVector(
        item.id,
        result.aiData.embedding,
        {
          user_id: user.id,
          title: item.title,
          type: item.type,
          category: result.aiData.category,
          tags: result.aiData.tags.join(","),
        }
      );
    } catch (vectorError) {
      console.warn("Failed to store vector embedding:", vectorError);
    }

    // Create connections
    if (result.connections.length > 0) {
      const connectionRecords = result.connections.map((conn) => ({
        user_id: user.id,
        from_item_id: itemId,
        to_item_id: conn.itemId,
        type: "semantic" as const,
        strength: conn.strength,
        description: conn.reason,
      }));

      await supabase.from("connections").insert(connectionRecords);
    }

    // Mark as completed
    await supabase
      .from("ai_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("item_id", itemId);

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action: "ai_process",
      entity_type: "item",
      entity_id: itemId,
      metadata: {
        processingTime: result.processingTime,
        connectionsFound: result.connections.length,
        partialFailures: result.partialFailures,
      },
    });

    return NextResponse.json({
      success: true,
      processingTime: result.processingTime,
      connectionsFound: result.connections.length,
      partialFailures: result.partialFailures,
    });
  } catch (error) {
    console.error("POST /api/ai/process error:", error);
    return NextResponse.json(
      { error: "AI processing failed" },
      { status: 500 }
    );
  }
}
