import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { searchByVector } from "@/lib/vector/pgvector";
import { generateEmbedding } from "@/lib/ai/ollama";

export const dynamic = "force-dynamic";

/**
 * Combine search results from multiple sources using Reciprocal Rank Fusion (RRF).
 * Gives each result a score based on its rank position in each result set.
 */
function rrfCombine(
  results: Array<{ id: string; score: number; source: string }>[],
  k: number = 60,
): Map<string, { totalScore: number; sources: string[] }> {
  const fused = new Map<string, { totalScore: number; sources: string[]; originalScore: number }>();

  for (const resultSet of results) {
    resultSet.forEach((item, rank) => {
      const existing = fused.get(item.id) || {
        totalScore: 0,
        sources: [] as string[],
        originalScore: item.score,
      };
      // RRF score contribution: 1 / (k + rank)
      existing.totalScore += 1 / (k + rank + 1);
      existing.sources.push(item.source);
      if (item.score > existing.originalScore) {
        existing.originalScore = item.score;
      }
      fused.set(item.id, existing);
    });
  }

  return fused;
}

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

    if (mode === "hybrid") {
      // Hybrid mode: run both semantic and full-text searches, combine with RRF
      try {
        const embedding = await generateEmbedding(query);
        const vectorResults = await searchByVector(embedding, user.id, limit * 2);

        const [semanticItems, ftItems] = await Promise.all([
          // Fetch semantic results
          (async () => {
            if (vectorResults.length === 0) return [];
            const itemIds = vectorResults.map((r) => r.id);
            const { data: dbItems } = await supabase
              .from("items")
              .select("*")
              .in("id", itemIds)
              .eq("user_id", user.id);
            const scoreMap = new Map(vectorResults.map((r) => [r.id, r.score]));
            return (dbItems || []).map((item) => ({
              ...item,
              id: item.id,
              score: scoreMap.get(item.id) || 0,
              source: "semantic",
            }));
          })(),
          // Fetch full-text results
          supabase
            .from("items")
            .select("*")
            .eq("user_id", user.id)
            .or(`title.ilike.%${query}%,extracted_text.ilike.%${query}%`)
            .limit(limit * 2)
            .then(({ data }) =>
              (data || []).map((item) => ({ ...item, score: 0.5, source: "fulltext" })),
            ),
        ]);

        // Combine using RRF
        const fused = rrfCombine(
          [
            semanticItems.map((i) => ({ id: i.id, score: i.score, source: i.source })),
            ftItems.map((i) => ({ id: i.id, score: i.score, source: i.source })),
          ],
          60,
        );

        // Build result list sorted by RRF score
        const allItems = [...semanticItems, ...ftItems];
        const itemMap = new Map(allItems.map((i) => [i.id, i]));

        items = Array.from(fused.entries())
          .sort((a, b) => b[1].totalScore - a[1].totalScore)
          .slice(0, limit)
          .map(([id, fusion]) => {
            const item = itemMap.get(id);
            return {
              ...(item || { id }),
              relevanceScore: fusion.totalScore,
            };
          });
      } catch {
        // Hybrid search unavailable — fallback to full-text
        console.warn("Hybrid search failed, falling back to full-text");
        let dbQuery = supabase
          .from("items")
          .select("*")
          .eq("user_id", user.id)
          .or(`title.ilike.%${query}%,extracted_text.ilike.%${query}%`);
        const { data: ftFallback } = await dbQuery.limit(limit);
        items = ftFallback || [];
      }
    } else if (mode === "semantic") {
      // Semantic search with embeddings + user-scoped vector search
      try {
        const embedding = await generateEmbedding(query);
        const vectorResults = await searchByVector(embedding, user.id, limit);

        if (vectorResults.length > 0) {
          const itemIds = vectorResults.map((r) => r.id);
          const { data: dbItems } = await supabase
            .from("items")
            .select("*")
            .in("id", itemIds)
            .eq("user_id", user.id);

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
      // Full-text search using ilike
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
