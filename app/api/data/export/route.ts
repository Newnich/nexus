import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/data/export — Export all user data as JSON
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [itemsRes, collectionsRes, connectionsRes] = await Promise.all([
      supabase.from("items").select("*").eq("user_id", user.id),
      supabase.from("collections").select("*, collection_items(*)").eq("user_id", user.id),
      supabase.from("connections").select("*").eq("user_id", user.id),
    ]);

    if (itemsRes.error) throw itemsRes.error;
    if (collectionsRes.error) throw collectionsRes.error;
    if (connectionsRes.error) throw connectionsRes.error;

    const exportData = {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      user: { id: user.id, email: user.email },
      stats: {
        items: itemsRes.data?.length || 0,
        collections: collectionsRes.data?.length || 0,
        connections: connectionsRes.data?.length || 0,
      },
      items: itemsRes.data || [],
      collections: collectionsRes.data || [],
      connections: connectionsRes.data || [],
    };

    return NextResponse.json(exportData);
  } catch (error) {
    console.error("GET /api/data/export error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
