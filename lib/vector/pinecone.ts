import { Pinecone } from "@pinecone-database/pinecone";

let pinecone: Pinecone | null = null;

export function getPinecone(): Pinecone {
  if (!pinecone) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error("PINECONE_API_KEY is not set");
    }
    pinecone = new Pinecone({
      apiKey,
    });
  }
  return pinecone;
}

export function getIndex() {
  const client = getPinecone();
  const indexName = process.env.PINECONE_INDEX_NAME || "nexus-vectors";
  return client.index(indexName);
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export async function upsertVector(
  id: string,
  embedding: number[],
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const index = getIndex();
  await index.upsert([
    {
      id,
      values: embedding,
      metadata: {
        ...metadata,
        updatedAt: new Date().toISOString(),
      },
    },
  ]);
}

export async function upsertVectors(
  vectors: Array<{
    id: string;
    values: number[];
    metadata?: Record<string, unknown>;
  }>
): Promise<void> {
  const index = getIndex();
  
  // Batch in chunks of 100
  const batchSize = 100;
  for (let i = 0; i < vectors.length; i += batchSize) {
    const batch = vectors.slice(i, i + batchSize).map((v) => ({
      id: v.id,
      values: v.values,
      metadata: { ...v.metadata, updatedAt: new Date().toISOString() },
    }));
    await index.upsert(batch);
  }
}

export async function searchVectors(
  embedding: number[],
  topK: number = 20,
  filter?: Record<string, unknown>
): Promise<VectorSearchResult[]> {
  const index = getIndex();

  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter,
  });

  return results.matches.map((match) => ({
    id: match.id,
    score: match.score || 0,
    metadata: match.metadata as Record<string, unknown> | undefined,
  }));
}

export async function deleteVector(id: string): Promise<void> {
  const index = getIndex();
  await index.deleteOne(id);
}

export async function deleteVectors(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const index = getIndex();
  
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    await index.deleteMany(batch);
  }
}

export async function getIndexStats(): Promise<{
  totalVectorCount: number;
  dimension: number;
  indexFullness: number;
}> {
  const index = getIndex();
  const stats = await index.describeIndexStats();
  return {
    totalVectorCount: stats.totalRecordCount || 0,
    dimension: stats.dimension || 0,
    indexFullness: stats.indexFullness || 0,
  };
}
