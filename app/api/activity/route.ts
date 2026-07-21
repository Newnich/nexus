import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/activity — List activity log entries with pagination and filters
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = parseInt(searchParams.get("offset") || "0");
    const action = searchParams.get("action"); // optional filter by action type
    const entityType = searchParams.get("entityType");

    let query = supabase
      .from("activity_log")
      .select("*", { count: "estimated" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit);

    if (action) query = query.eq("action", action);
    if (entityType) query = query.eq("entity_type", entityType);

    const { data: entries, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      entries: entries || [],
      count: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("GET /api/activity error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
