import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/collections — List all collections with item previews
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

    let query = supabase
      .from("collections")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (type && type !== "all") {
      query = query.eq("type", type);
    }

    const { data: collections, error } = await query;

    if (error) throw error;

    // For each collection, fetch up to 4 recent item previews
    const collectionsWithItems = await Promise.all(
      (collections || []).map(async (col) => {
        const { data: items } = await supabase
          .from("collection_items")
          .select("item_id, items!inner(id, title, type, ai_data, created_at)")
          .eq("collection_id", col.id)
          .order("added_at", { ascending: false })
          .limit(4);

        const previewItems = (items || []).map((ci: Record<string, unknown>) => {
          const item = ci.items as Record<string, unknown>;
          const aiData = item.ai_data as Record<string, unknown> | null;
          return {
            id: item.id,
            title: item.title,
            type: item.type,
            category: (aiData?.category as string) || null,
          };
        });

        return {
          id: col.id,
          name: col.name,
          description: col.description || "",
          type: col.type,
          icon: col.icon || "📁",
          color: col.color || "#6366f1",
          itemCount: col.item_count || previewItems.length,
          visibility: col.visibility || "private",
          parentId: col.parent_id,
          previewItems,
          createdAt: col.created_at,
          updatedAt: col.updated_at,
        };
      }),
    );

    return NextResponse.json({
      collections: collectionsWithItems,
      count: collectionsWithItems.length,
    });
  } catch (error) {
    console.error("GET /api/collections error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
