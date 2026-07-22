import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/collections/[id]/items — Add items to a collection
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const itemIds: string[] = body.itemIds || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds array is required" }, { status: 400 });
    }

    // Verify the collection exists and belongs to user
    const { data: collection } = await supabase
      .from("collections")
      .select("id, item_count")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Insert into junction table (skip duplicates with ON CONFLICT DO NOTHING)
    const rows = itemIds.map((itemId) => ({
      collection_id: id,
      item_id: itemId,
      added_by: user.id,
    }));

    const { error: insertError } = await supabase.from("collection_items").insert(rows);

    if (insertError) {
      // If duplicate key violation (23505), that's OK - item already in collection
      if (insertError.code !== "23505") {
        throw insertError;
      }
    }

    // Update the item_count on the collection
    const { count: totalCount } = await supabase
      .from("collection_items")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", id);

    await supabase
      .from("collections")
      .update({ item_count: totalCount || 0 })
      .eq("id", id);

    // Log activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action: "collection_add_items",
      entity_type: "collection",
      entity_id: id,
      metadata: { itemCount: itemIds.length, itemIds },
    });

    return NextResponse.json({
      success: true,
      added: itemIds.length,
      totalItems: totalCount || 0,
    });
  } catch (error) {
    console.error("POST /api/collections/[id]/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/collections/[id]/items — Remove items from a collection
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const itemIds: string[] = body.itemIds || [];

    if (itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds array is required" }, { status: 400 });
    }

    // Verify ownership via collection
    const { data: collection } = await supabase
      .from("collections")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (!collection) {
      return NextResponse.json({ error: "Collection not found" }, { status: 404 });
    }

    // Remove items
    const { error: deleteError } = await supabase
      .from("collection_items")
      .delete()
      .eq("collection_id", id)
      .in("item_id", itemIds);

    if (deleteError) throw deleteError;

    // Update item_count
    const { count } = await supabase
      .from("collection_items")
      .select("*", { count: "exact", head: true })
      .eq("collection_id", id);

    await supabase
      .from("collections")
      .update({ item_count: count || 0 })
      .eq("id", id);

    return NextResponse.json({
      success: true,
      removed: itemIds.length,
      totalItems: count || 0,
    });
  } catch (error) {
    console.error("DELETE /api/collections/[id]/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
