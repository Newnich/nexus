import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/collections/[id] — Fetch a single collection with all its items
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

    // Fetch the collection
    const { data: collection, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      throw error;
    }

    // Fetch items in this collection via junction table
    const { data: collectionItems } = await supabase
      .from("collection_items")
      .select(
        "item_id, added_at, items!inner(id, title, type, content, ai_data, metadata, created_at)",
      )
      .eq("collection_id", id)
      .order("added_at", { ascending: false });

    const items = (collectionItems || []).map((ci: Record<string, unknown>) => {
      const item = ci.items as Record<string, unknown>;
      const aiData = item.ai_data as Record<string, unknown> | null;
      return {
        id: item.id,
        title: item.title,
        type: item.type,
        content: item.content || "",
        metadata: item.metadata || {},
        category: (aiData?.category as string) || null,
        tags: (aiData?.tags as string[]) || [],
        summary: (aiData?.summary as string) || null,
        addedAt: ci.added_at,
        createdAt: item.created_at,
      };
    });

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        description: collection.description || "",
        type: collection.type,
        icon: collection.icon || "📁",
        color: collection.color || "#6366f1",
        itemCount: collection.item_count || items.length,
        visibility: collection.visibility || "private",
        parentId: collection.parent_id,
        createdAt: collection.created_at,
        updatedAt: collection.updated_at,
      },
      items,
    });
  } catch (error) {
    console.error("GET /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/collections/[id] — Update collection name/description
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

    const updates: Record<string, unknown> = {};
    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.color !== undefined) updates.color = body.color;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { data: collection, error } = await supabase
      .from("collections")
      .update(updates)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ collection });
  } catch (error) {
    console.error("PATCH /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/collections/[id] — Delete a collection
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

    const { error } = await supabase
      .from("collections")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Collection not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/collections/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
