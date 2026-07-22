import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchByVector } from "@/lib/vector/pgvector";
import { generateEmbedding } from "@/lib/ai/ollama";

export const dynamic = "force-dynamic";

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
    const query = searchParams.get("q");
    const mode = searchParams.get("mode") || "semantic";
    const type = searchParams.get("type");
    const limit = parseInt(searchParams.get("limit") || "20");

    if (!query) {
      return NextResponse.json({ error: "Query parameter is required" }, { status: 400 });
    }

    let items;

    if (mode === "semantic") {
      // Semantic search with embeddings + user-scoped vector search
      try {
        const embedding = await generateEmbedding(query);
        // Use pgvector for user-scoped semantic search (free, in-database)
        const vectorResults = await searchByVector(embedding, user.id, limit);

        if (vectorResults.length > 0) {
          const itemIds = vectorResults.map((r) => r.id);
          const { data: dbItems } = await supabase
            .from("items")
            .select("*")
            .in("id", itemIds)
            .eq("user_id", user.id);

          // Sort by vector search score
          const scoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));
          items = (dbItems || [])
            .map((item) => ({
              ...item,
              relevanceScore: scoreMap.get(item.id) || 0,
            }))
            .sort((a, b) => b.relevanceScore - a.relevanceScore);
        } else {
          items = [];
        }
      } catch {
        // Vector search unavailable - fallback to full-text
        console.warn("Vector search failed, falling back to full-text");
        const { data: ftItems } = await supabase
          .from("items")
          .select("*")
          .eq("user_id", user.id)
          .or(`title.ilike.%${query}%,extracted_text.ilike.%${query}%`)
          .limit(limit);
        items = ftItems || [];
      }
    } else {
      // Full-text search using ilike (compatible with all Postgres setups)
      let dbQuery = supabase
        .from("items")
        .select("*")
        .eq("user_id", user.id)
        .or(`title.ilike.%${query}%,extracted_text.ilike.%${query}%`);

      if (type && type !== "all") {
        dbQuery = dbQuery.eq("type", type);
      }

      const { data: ftItems } = await dbQuery.limit(limit);
      items = ftItems || [];
    }

    // Log the search activity
    await supabase.from("activity_log").insert({
      user_id: user.id,
      action: "search",
      entity_type: "search",
      metadata: { query, mode, resultCount: items?.length || 0 },
    });

    return NextResponse.json({ items, query, mode, count: items?.length || 0 });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
