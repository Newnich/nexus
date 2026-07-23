import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { enqueueAIProcessing } from "@/lib/queue/ai-queue";
import type { CreateItemInput } from "@/types/item";

export const dynamic = "force-dynamic";

// GET /api/items — List items with optional filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sortBy = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";
    const includeArchived = searchParams.get("includeArchived") === "true";

    let query = supabase
      .from("items")
      .select("*", { count: "estimated" })
      .eq("user_id", user.id)
      .order(sortBy, { ascending: order === "asc" })
      .range(offset, offset + limit);

    if (!includeArchived) {
      query = query.eq("is_archived", false);
    }

    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    const { data: items, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({ items: items || [], count: count || 0 });
  } catch (error) {
    console.error("GET /api/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/items — Create a new item with AI processing
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as CreateItemInput;

    // Validate required fields
    if (!body.type || !body.title) {
      return NextResponse.json({ error: "Type and title are required" }, { status: 400 });
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

    // Enqueue AI processing directly (fire-and-forget)
    enqueueAIProcessing(item.id, user.id).catch((err) =>
      console.error("[Items API] Failed to enqueue AI processing:", err),
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
