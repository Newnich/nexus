import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GET /api/tags — List all unique tags with item counts
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all items' ai_data to extract tags
    const { data: items, error } = await supabase
      .from("items")
      .select("ai_data")
      .eq("user_id", user.id);

    if (error) throw error;

    // Aggregate tags with counts
    const tagMap = new Map<string, number>();
    for (const item of items || []) {
      const aiData = item.ai_data as { tags?: string[] } | null;
      if (aiData?.tags) {
        for (const tag of aiData.tags) {
          tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
        }
      }
    }

    // Sort by count descending, then alphabetically
    const tags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    return NextResponse.json({ tags, total: tags.length });
  } catch (error) {
    console.error("GET /api/tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/tags — Rename, merge, or delete a tag
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, tag, newName } = body as {
      action: "rename" | "merge" | "delete";
      tag: string;
      newName?: string;
    };

    if (!tag || !action) {
      return NextResponse.json({ error: "Tag name and action are required" }, { status: 400 });
    }

    if (action === "rename" && !newName) {
      return NextResponse.json({ error: "New name is required for rename" }, { status: 400 });
    }

    // Fetch all items that have this tag in their ai_data
    const { data: items, error: fetchError } = await supabase
      .from("items")
      .select("id, ai_data")
      .eq("user_id", user.id);

    if (fetchError) throw fetchError;

    const serviceClient = await createServiceClient();
    let updatedCount = 0;

    for (const item of items || []) {
      const aiData = item.ai_data as { tags?: string[] } | null;
      if (!aiData?.tags) continue;

      const tagIndex = aiData.tags.indexOf(tag);
      if (tagIndex === -1) continue;

      let newTags: string[];

      switch (action) {
        case "delete":
          newTags = aiData.tags.filter((t) => t !== tag);
          break;
        case "rename":
          newTags = [...aiData.tags];
          newTags[tagIndex] = newName!;
          break;
        case "merge":
          newTags = aiData.tags.filter((t) => t !== tag);
          if (!newTags.includes(newName!)) {
            newTags.push(newName!);
          }
          break;
        default:
          return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      const { error: updateError } = await serviceClient
        .from("items")
        .update({ ai_data: { ...aiData, tags: newTags } })
        .eq("id", item.id);

      if (!updateError) updatedCount++;
    }

    return NextResponse.json({
      success: true,
      action,
      tag,
      newName,
      updatedCount,
    });
  } catch (error) {
    console.error("POST /api/tags error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
