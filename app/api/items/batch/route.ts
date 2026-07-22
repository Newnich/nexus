import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// PATCH /api/items/batch — Batch update items (tags, archive, favorite)
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { itemIds, addTags, removeTags } = body as {
      itemIds: string[];
      addTags?: string[];
      removeTags?: string[];
    };

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "itemIds array is required" }, { status: 400 });
    }

    if (!addTags && !removeTags) {
      return NextResponse.json(
        { error: "Provide addTags and/or removeTags arrays" },
        { status: 400 },
      );
    }

    // Sanitize tags
    const sanitizeTag = (tag: string) =>
      tag
        .toLowerCase()
        .replace(/[^a-z0-9-_\s]/g, "")
        .trim();
    const tagsToAdd = addTags?.map(sanitizeTag).filter(Boolean) || [];
    const tagsToRemove = removeTags?.map(sanitizeTag).filter(Boolean) || [];

    if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
      return NextResponse.json({ error: "No valid tags to add or remove" }, { status: 400 });
    }

    // Fetch current items
    const { data: items, error: fetchError } = await supabase
      .from("items")
      .select("id, ai_data")
      .eq("user_id", user.id)
      .in("id", itemIds);

    if (fetchError) throw fetchError;

    const serviceClient = await createServiceClient();
    let updatedCount = 0;

    for (const item of items || []) {
      const aiData = item.ai_data as { tags?: string[] } | null;
      const currentTags = aiData?.tags || [];

      let newTags = [...currentTags];

      // Remove tags
      if (tagsToRemove.length > 0) {
        newTags = newTags.filter((t) => !tagsToRemove.includes(t));
      }

      // Add tags
      if (tagsToAdd.length > 0) {
        for (const tag of tagsToAdd) {
          if (!newTags.includes(tag)) {
            newTags.push(tag);
          }
        }
      }

      // Only update if tags actually changed
      if (newTags.length !== currentTags.length || newTags.some((t, i) => t !== currentTags[i])) {
        const { error: updateError } = await serviceClient
          .from("items")
          .update({ ai_data: { ...aiData, tags: newTags } })
          .eq("id", item.id);

        if (!updateError) updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount,
      totalItems: itemIds.length,
      tagsAdded: tagsToAdd,
      tagsRemoved: tagsToRemove,
    });
  } catch (error) {
    console.error("PATCH /api/items/batch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
