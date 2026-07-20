/**
 * pgvector — Zero-cost vector search using Supabase's built-in pgvector extension.
 *
 * Replaces Pinecone entirely. Embeddings are stored directly in the `items` table
 * and searched via a PostgreSQL function using cosine distance (<-> operator).
 *
 * Requires:
 *   1. pgvector extension enabled in Supabase
 *   2. `embedding vector(768)` column on the items table
 *   3. `search_items` PostgreSQL function (see schema.sql)
 */

import { createServiceClient } from "@/lib/supabase/server";

export interface VectorSearchResult {
  id: string;
  score: number;
}

/**
 * Store an embedding vector directly on an item row.
 * The embedding column is on the items table itself — no separate vector store needed.
 */
export async function storeEmbedding(
  itemId: string,
  embedding: number[],
  _userId: string
): Promise<void> {
  const client = await createServiceClient();
  const { error } = await client
    .from("items")
    .update({ embedding })
    .eq("id", itemId);

  if (error) {
    console.warn("Failed to store embedding:", error);
    throw error;
  }
}

/**
 * Search items by semantic similarity using pgvector's cosine distance.
 * Calls the `search_items` PostgreSQL function via RPC.
 */
export async function searchByVector(
  embedding: number[],
  userId: string,
  limit: number = 20
): Promise<VectorSearchResult[]> {
  const client = await createServiceClient();

  // Serialize embedding as Postgres vector literal: '[0.1,0.2,0.3]'::vector
  // Supabase RPC needs this format for vector type parameters
  const vectorStr = `[${embedding.join(",")}]`;

  const { data, error } = await client.rpc("search_items", {
    query_embedding: vectorStr,
    user_id_param: userId,
    match_count: limit,
  });

  if (error) {
    console.warn("pgvector search failed:", error.message, error);
    throw error;
  }

  console.log(`pgvector search: ${data?.length || 0} results`);

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    score: (row.similarity as number) || 0,
  }));
}

/**
 * Delete an embedding from an item (set to null).
 */
export async function deleteEmbedding(itemId: string): Promise<void> {
  const client = await createServiceClient();
  await client.from("items").update({ embedding: null }).eq("id", itemId);
}

/**
 * Batch delete embeddings.
 */
export async function deleteEmbeddings(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return;
  const client = await createServiceClient();
  await client.from("items").update({ embedding: null }).in("id", itemIds);
}

/**
 * Get stats about stored embeddings.
 */
export async function getEmbeddingStats(): Promise<{
  totalEmbeddings: number;
  dimension: number;
}> {
  const client = await createServiceClient();
  const { count } = await client
    .from("items")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);

  return {
    totalEmbeddings: count || 0,
    dimension: 768, // nomic-embed-text dimension
  };
}
