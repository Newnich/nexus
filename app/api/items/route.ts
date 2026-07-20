import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { processNewItem } from "@/lib/ai/pipeline";
import { storeEmbedding } from "@/lib/vector/pgvector";
import type { CreateItemInput, Item } from "@/types/item";

export const dynamic = 'force-dynamic';

// GET /api/items — List items with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    let query = supabase
      .from("items")
      .select("*", { count: "estimated" })
      .eq("user_id", user.id)
      .order(sortBy, { ascending: order === "asc" })
      .range(offset, offset + limit);

    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    const { data: items, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ items: items || [], count: count || 0 });
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/items — Create a new item with AI processing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateItemInput;

    // Validate required fields
    if (!body.type || !body.title) {
      return NextResponse.json(
        { error: "Type and title are required" },
        { status: 400 }
      );
    }

    // Create item in database
    const { data: item, error } = await supabase
      .from("items")
      .insert({
        user_id: user.id,
        type: body.type,
        title: body.title,
        content: body.content || "",
        extracted_text: body.extractedText || "",
        metadata: body.metadata ? JSON.parse(JSON.stringify(body.metadata)) : {},
        visibility: body.visibility || "private",
      })
      .select()
      .single();

    if (error) throw error;

    // Trigger AI processing (fire-and-forget)
    processItemAsync(item.id, user.id, body.content || body.extractedText || "").catch(
      (err) => console.error("AI processing failed:", err)
    );

    // Add to collections if specified
    if (body.collectionIds?.length) {
      const collectionItems = body.collectionIds.map((collectionId) => ({
        collection_id: collectionId,
        item_id: item.id,
        added_by: user.id,
      }));
      await supabase.from("collection_items").insert(collectionItems);
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error("POST /api/items error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Fire-and-forget AI processing for a newly created item.
 * Runs asynchronously so the API response is not blocked.
 */
async function processItemAsync(
  itemId: string,
  userId: string,
  textToProcess: string
): Promise<void> {
  try {
    const serviceClient = await createServiceClient();

    // Mark as processing
    await serviceClient
      .from("ai_queue")
      .update({ status: "processing", started_at: new Date().toISOString() })
      .eq("item_id", itemId);

    // Get the full item
    const { data: item } = await serviceClient
      .from("items")
      .select("*")
      .eq("id", itemId)
      .single();

    if (!item) {
      console.error("Item not found for AI processing:", itemId);
      return;
    }

    // Get existing items for connection finding
    const { data: existingItems } = await serviceClient
      .from("items")
      .select("id, title, ai_data")
      .eq("user_id", userId)
      .neq("id", itemId)
      .not("ai_data", "is", null)
      .limit(20);

    const existingSummaries = (existingItems || []).map((i) => ({
      id: i.id,
      title: i.title || "",
      summary:
        (i.ai_data as Record<string, unknown> | null)?.summary as string || "",
    }));

    // Run the AI pipeline
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
    await serviceClient
      .from("items")
      .update({ ai_data: result.aiData })
      .eq("id", itemId);

    // Store embedding in pgvector (zero-cost, in Supabase Postgres)
    if (result.aiData.embedding && result.aiData.embedding.length > 0) {
      try {
        await storeEmbedding(itemId, result.aiData.embedding, userId);
      } catch (vectorError) {
        console.warn("Failed to store embedding:", vectorError);
      }
    } else {
      console.warn("Skipping vector storage — embedding is empty (AI may have failed)");
    }

    // Create connections
    if (result.connections.length > 0) {
      const connectionRecords = result.connections.map((conn) => ({
        user_id: userId,
        from_item_id: itemId,
        to_item_id: conn.itemId,
        type: "semantic" as const,
        strength: conn.strength,
        description: conn.reason,
      }));
      await serviceClient.from("connections").insert(connectionRecords);
    }

    // Mark as completed
    await serviceClient
      .from("ai_queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("item_id", itemId);

    // Log activity
    await serviceClient.from("activity_log").insert({
      user_id: userId,
      action: "ai_process",
      entity_type: "item",
      entity_id: itemId,
      metadata: {
        processingTime: result.processingTime,
        connectionsFound: result.connections.length,
        partialFailures: result.partialFailures,
      },
    });

    console.log(
      `AI processing complete for item ${itemId}: ${result.processingTime.toFixed(
        0
      )}ms, ${result.connections.length} connections`
    );
  } catch (err) {
    console.error(`AI processing failed for item ${itemId}:`, err);
    // Mark as failed so it doesn't stay stuck in "processing"
    try {
      const serviceClient = await createServiceClient();
      await serviceClient
        .from("ai_queue")
        .update({
          status: "failed",
          error: (err as Error).message,
          completed_at: new Date().toISOString(),
        })
        .eq("item_id", itemId);
    } catch {
      // Best-effort
    }
  }
}
