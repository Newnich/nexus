import {
  generateSummary,
  generateTags,
  categorizeContent,
  generateEmbedding,
  extractKeyPoints,
  analyzeSentiment,
  findConnections,
} from "./ollama";
import type { ItemAIData, Item } from "@/types/item";

export interface ProcessingResult {
  aiData: ItemAIData;
  connections: Array<{ itemId: string; reason: string; strength: number }>;
  processingTime: number;
  partialFailures: string[];
}

export async function processNewItem(
  item: {
    id: string;
    title: string;
    content: string;
    extractedText?: string;
  },
  existingItems?: Array<{ id: string; summary: string; title: string }>,
): Promise<ProcessingResult> {
  const startTime = performance.now();
  const textToProcess = item.extractedText || item.content || item.title;
  const partialFailures: string[] = [];

  // Use allSettled so one failure doesn't kill the entire pipeline
  const [
    summaryResult,
    tagsResult,
    categoryResult,
    embeddingResult,
    keyPointsResult,
    sentimentResult,
  ] = await Promise.allSettled([
    generateSummary(textToProcess, "medium"),
    generateTags(textToProcess),
    categorizeContent(textToProcess, item.title),
    generateEmbedding(textToProcess),
    extractKeyPoints(textToProcess),
    analyzeSentiment(textToProcess),
  ]);

  const summary =
    summaryResult.status === "fulfilled" ? summaryResult.value : "Summary unavailable.";
  const tags = tagsResult.status === "fulfilled" ? tagsResult.value : [];
  const category = categoryResult.status === "fulfilled" ? categoryResult.value : "Uncategorized";
  const embedding = embeddingResult.status === "fulfilled" ? embeddingResult.value : [];
  const keyPoints = keyPointsResult.status === "fulfilled" ? keyPointsResult.value : [];
  const sentiment = sentimentResult.status === "fulfilled" ? sentimentResult.value : "neutral";

  if (summaryResult.status === "rejected") partialFailures.push("summary");
  if (tagsResult.status === "rejected") partialFailures.push("tags");
  if (categoryResult.status === "rejected") partialFailures.push("category");
  if (embeddingResult.status === "rejected") partialFailures.push("embedding");
  if (keyPointsResult.status === "rejected") partialFailures.push("keyPoints");
  if (sentimentResult.status === "rejected") partialFailures.push("sentiment");

  const aiData: ItemAIData = {
    summary,
    tags,
    category,
    keyPoints,
    sentiment,
    language: "en",
    entities: [],
    embedding,
    processingVersion: 1,
    processedAt: new Date().toISOString(),
  };

  // Find connections to existing items
  let connections: Array<{ itemId: string; reason: string; strength: number }> = [];
  if (existingItems && existingItems.length > 0) {
    try {
      const connectionResult = await findConnections(textToProcess, existingItems);
      connections = Array.isArray(connectionResult) ? connectionResult : [];
    } catch (e) {
      partialFailures.push("connections");
      console.error("Connection finding failed:", e);
    }
  }

  const processingTime = performance.now() - startTime;

  return { aiData, connections, processingTime, partialFailures };
}

export async function batchProcessItems(
  items: Array<{ id: string; title: string; content: string; extractedText?: string }>,
): Promise<Map<string, ProcessingResult>> {
  const results = new Map<string, ProcessingResult>();
  const batchSize = 3; // Reduced from 5 to avoid rate limits

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map((item) => processNewItem(item)));
    batch.forEach((item, index) => {
      const result = batchResults[index];
      if (result.status === "fulfilled") {
        results.set(item.id, result.value);
      } else {
        console.error(`Failed to process item ${item.id}:`, result.reason);
      }
    });
  }
  return results;
}

export function calculateItemRelevance(item: Item, queryEmbedding: number[]): number {
  if (!item.aiData?.embedding || item.aiData.embedding.length === 0) return 0;

  const a = item.aiData.embedding;
  const b = queryEmbedding;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}
