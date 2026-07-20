import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = 'force-dynamic';

// GET /api/graph — Returns all items (nodes) and connections (edges) for graph visualization
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all items for the user
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id, title, type, ai_data, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (itemsError) throw itemsError;

    // Fetch all connections for the user
    const { data: connections, error: connError } = await supabase
      .from("connections")
      .select("id, from_item_id, to_item_id, strength, type, description")
      .eq("user_id", user.id)
      .order("strength", { ascending: false });

    if (connError) throw connError;

    // Map items to nodes
    const nodes = (items || []).map((item) => {
      const aiData = item.ai_data as Record<string, unknown> | null;
      return {
        id: item.id,
        title: item.title || "Untitled",
        type: item.type,
        category: (aiData?.category as string) || null,
        tags: (aiData?.tags as string[]) || [],
        createdAt: item.created_at,
        // Compute connection count for node sizing
        connectionCount: 0, // Will fill below
      };
    });

    // Create a lookup for connection counts
    const nodeConnectionCount = new Map<string, number>();
    for (const conn of connections || []) {
      nodeConnectionCount.set(
        conn.from_item_id,
        (nodeConnectionCount.get(conn.from_item_id) || 0) + 1
      );
      nodeConnectionCount.set(
        conn.to_item_id,
        (nodeConnectionCount.get(conn.to_item_id) || 0) + 1
      );
    }

    // Fill in connection counts
    for (const node of nodes) {
      node.connectionCount = nodeConnectionCount.get(node.id) || 0;
    }

    // Map connections to edges
    const edges = (connections || []).map((conn) => ({
      id: conn.id,
      source: conn.from_item_id,
      target: conn.to_item_id,
      strength: conn.strength,
      type: conn.type,
      description: conn.description || "",
    }));

    return NextResponse.json({
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        averageStrength:
          edges.length > 0
            ? edges.reduce((sum, e) => sum + e.strength, 0) / edges.length
            : 0,
      },
    });
  } catch (error) {
    console.error("GET /api/graph error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
