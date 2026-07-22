import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Item } from "@/types/item";

export const dynamic = "force-dynamic";

// GET /api/items/[id] — Fetch a single item by ID
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const { data: item, error } = await supabase
      .from("items")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      throw error;
    }

    // Map snake_case DB fields to camelCase for the frontend
    const mappedItem: Item = {
      id: item.id,
      userId: item.user_id,
      type: item.type,
      title: item.title,
      content: item.content || "",
      extractedText: item.extracted_text || "",
      metadata: item.metadata || {},
      aiData: item.ai_data || undefined,
      collectionIds: [],
      visibility: item.visibility || "private",
      isFavorite: item.is_favorite || false,
      isArchived: item.is_archived || false,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      accessedAt: item.accessed_at,
    };

    // Update accessed_at
    await supabase.from("items").update({ accessed_at: new Date().toISOString() }).eq("id", id);

    // Fetch connections for this item
    const { data: connections } = await supabase
      .from("connections")
      .select("*, from_item:from_item_id(id, title, type), to_item:to_item_id(id, title, type)")
      .or(`from_item_id.eq.${id},to_item_id.eq.${id}`)
      .eq("user_id", user.id)
      .limit(20);

    return NextResponse.json({ item: mappedItem, connections: connections || [] });
  } catch (error) {
    console.error("GET /api/items/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/items/[id] — Update an item
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
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

    // Build update payload (only allow specific fields)
    const updates: Record<string, unknown> = {};
    if (body.title !== undefined) updates.title = body.title;
    if (body.content !== undefined) updates.content = body.content;
    if (body.isFavorite !== undefined) updates.is_favorite = body.isFavorite;
    if (body.isArchived !== undefined) updates.is_archived = body.isArchived;
    if (body.visibility !== undefined) updates.visibility = body.visibility;

    const { data: item, error } = await supabase
      .from("items")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ item });
  } catch (error) {
    console.error("PATCH /api/items/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/items/[id] — Delete an item
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

    const { error } = await supabase.from("items").delete().eq("id", id).eq("user_id", user.id);

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/items/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
