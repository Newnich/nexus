import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

// GET /api/items/[id]/collections — Fetch collections that contain this item
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const { data: membership, error } = await supabase
      .from("collection_items")
      .select("collection_id, collections!inner(id, name, icon, color, type)")
      .eq("item_id", id);

    if (error) throw error;

    const collections = (membership || []).map((m) => {
      const col = m.collections as unknown as { id: string; name: string; icon: string; color: string; type: string };
      return {
        id: col.id,
        name: col.name,
        icon: col.icon || "📁",
        color: col.color || "#6366f1",
        type: col.type,
      };
    });

    return NextResponse.json({ collections });
  } catch (error) {
    console.error("GET /api/items/[id]/collections error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
