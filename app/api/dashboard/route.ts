import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

// GET /api/dashboard — Returns aggregated stats for the dashboard
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Run all queries in parallel for speed
    const [
      itemsResult,
      collectionsResult,
      connectionsResult,
      recentItemsResult,
      activityResult,
    ] = await Promise.all([
      // Total items count
      supabase
        .from("items")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),

      // Total collections count
      supabase
        .from("collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),

      // Total connections count
      supabase
        .from("connections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),

      // Recent items (last 10)
      supabase
        .from("items")
        .select("id, title, type, ai_data, created_at, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),

      // Recent activity (last 10)
      supabase
        .from("activity_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    // Extract counts
    const totalItems = itemsResult.count || 0;
    const totalCollections = collectionsResult.count || 0;
    const totalConnections = connectionsResult.count || 0;

    // Map recent items
    const recentItems = (recentItemsResult.data || []).map((item) => ({
      id: item.id,
      title: item.title || "Untitled",
      type: item.type,
      createdAt: item.created_at,
      category: (item.ai_data as Record<string, unknown> | null)?.category as string | null,
    }));

    // Compute top categories from all items (single query, limited to avoid perf issues)
    const { data: allCategories } = await supabase
      .from("items")
      .select("ai_data")
      .eq("user_id", user.id)
      .not("ai_data", "is", null)
      .limit(1000);

    const categoryCount = new Map<string, number>();
    for (const item of allCategories || []) {
      const aiData = item.ai_data as Record<string, unknown> | null;
      const category = (aiData?.category as string) || "Uncategorized";
      categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
    }

    const topCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Map activity log
    const recentActivity = (activityResult.data || []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      entityType: entry.entity_type,
      entityId: entry.entity_id,
      metadata: entry.metadata,
      createdAt: entry.created_at,
    }));

    return NextResponse.json({
      totalItems,
      totalCollections,
      totalConnections,
      recentItems,
      topCategories,
      recentActivity,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
