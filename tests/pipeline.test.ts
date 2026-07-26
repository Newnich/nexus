/**
 * Unit tests for lib/ai/pipeline.ts — AI processing pipeline
 *
 * Tests processNewItem and batchProcessItems by mocking the
 * ollama provider functions. Covers:
 *   - Successful full pipeline
 *   - Partial failures (some AI steps fail)
 *   - Connection discovery
 *   - Batch processing
 *   - Edge cases (empty content, missing fields)
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import type { ItemAIData } from "@/types/item";

// ── Mock ollama module ──

vi.mock("../lib/ai/ollama", () => ({
  generateSummary: vi.fn(),
  generateTags: vi.fn(),
  categorizeContent: vi.fn(),
  generateEmbedding: vi.fn(),
  extractKeyPoints: vi.fn(),
  analyzeSentiment: vi.fn(),
  findConnections: vi.fn(),
}));

// Helper: get the mocked module to configure per test
async function getMockedOllama() {
  const ollama = await import("../lib/ai/ollama");
  return {
    generateSummary: ollama.generateSummary as Mock,
    generateTags: ollama.generateTags as Mock,
    categorizeContent: ollama.categorizeContent as Mock,
    generateEmbedding: ollama.generateEmbedding as Mock,
    extractKeyPoints: ollama.extractKeyPoints as Mock,
    analyzeSentiment: ollama.analyzeSentiment as Mock,
    findConnections: ollama.findConnections as Mock,
  };
}

beforeEach(async () => {
  vi.clearAllMocks();

  const ollama = await getMockedOllama();
  ollama.generateSummary.mockResolvedValue("A summary of the content.");
  ollama.generateTags.mockResolvedValue(["tag1", "tag2", "tag3"]);
  ollama.categorizeContent.mockResolvedValue("Technology");
  ollama.generateEmbedding.mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);
  ollama.extractKeyPoints.mockResolvedValue(["Point one", "Point two", "Point three"]);
  ollama.analyzeSentiment.mockResolvedValue("neutral");
  ollama.findConnections.mockResolvedValue([
    { itemId: "existing-1", reason: "Related topic", strength: 0.8 },
  ]);
});

// ── processNewItem ──

describe("processNewItem", () => {
  it("processes an item successfully with all AI steps", async () => {
    const { processNewItem } = await import("../lib/ai/pipeline");

    const result = await processNewItem(
      {
        id: "item-1",
        title: "Test Item",
        content: "This is the content of the test item.",
      },
      [{ id: "existing-1", summary: "About AI", title: "AI Article" }],
    );

    expect(result.aiData.summary).toBe("A summary of the content.");
    expect(result.aiData.tags).toEqual(["tag1", "tag2", "tag3"]);
    expect(result.aiData.category).toBe("Technology");
    expect(result.aiData.embedding).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(result.aiData.keyPoints).toEqual(["Point one", "Point two", "Point three"]);
    expect(result.aiData.sentiment).toBe("neutral");
    expect(result.aiData.language).toBe("en");
    expect(result.aiData.processingVersion).toBe(1);
    expect(result.aiData.processedAt).toBeDefined();
    expect(result.partialFailures).toEqual([]);
    expect(result.connections).toHaveLength(1);
    expect(result.processingTime).toBeGreaterThan(0);
  });

  it("does not discover connections when no existingItems provided", async () => {
    const { processNewItem } = await import("../lib/ai/pipeline");

    const result = await processNewItem({
      id: "item-1",
      title: "Test Item",
      content: "Content",
    });

    expect(result.connections).toEqual([]);
  });

  it("uses extractedText when available", async () => {
    const ollama = await getMockedOllama();
    const { processNewItem } = await import("../lib/ai/pipeline");

    await processNewItem({
      id: "item-1",
      title: "Test",
      content: "Short content",
      extractedText: "Long extracted text that should be used instead of content",
    });

    // The extractedText should be passed to AI functions
    expect(ollama.generateSummary).toHaveBeenCalledWith(
      "Long extracted text that should be used instead of content",
      "medium",
    );
  });

  it("uses title when content and extractedText are empty", async () => {
    const ollama = await getMockedOllama();
    const { processNewItem } = await import("../lib/ai/pipeline");

    await processNewItem({
      id: "item-1",
      title: "Just a Title",
      content: "",
    });

    expect(ollama.generateSummary).toHaveBeenCalledWith("Just a Title", "medium");
  });

  it("handles partial failures gracefully", async () => {
    const ollama = await getMockedOllama();
    ollama.generateTags.mockRejectedValue(new Error("Tags failed"));
    ollama.generateEmbedding.mockRejectedValue(new Error("Embedding failed"));

    const { processNewItem } = await import("../lib/ai/pipeline");

    const result = await processNewItem({
      id: "item-1",
      title: "Test",
      content: "Content",
    });

    expect(result.aiData.tags).toEqual([]);
    expect(result.aiData.embedding).toEqual([]);
    expect(result.partialFailures).toContain("tags");
    expect(result.partialFailures).toContain("embedding");
    expect(result.aiData.summary).toBe("A summary of the content.");
    expect(result.aiData.category).toBe("Technology");
  });

  it("discovers connections when existingItems are provided", async () => {
    const ollama = await getMockedOllama();
    const { processNewItem } = await import("../lib/ai/pipeline");

    const result = await processNewItem({ id: "item-1", title: "Test", content: "Content" }, [
      { id: "existing-1", summary: "About AI", title: "AI Article" },
      { id: "existing-2", summary: "About ML", title: "ML Article" },
    ]);

    expect(result.connections).toHaveLength(1);
    expect(ollama.findConnections).toHaveBeenCalled();
  });

  it("skips connection discovery when no existingItems provided", async () => {
    const ollama = await getMockedOllama();
    const { processNewItem } = await import("../lib/ai/pipeline");

    await processNewItem({
      id: "item-1",
      title: "Test",
      content: "Content",
    });

    expect(ollama.findConnections).not.toHaveBeenCalled();
  });

  it("handles connection discovery failure as partial failure", async () => {
    const ollama = await getMockedOllama();
    ollama.findConnections.mockRejectedValue(new Error("Connection finding error"));

    const { processNewItem } = await import("../lib/ai/pipeline");

    const result = await processNewItem({ id: "item-1", title: "Test", content: "Content" }, [
      { id: "existing-1", summary: "S1", title: "T1" },
    ]);

    expect(result.partialFailures).toContain("connections");
    expect(result.connections).toEqual([]);
  });

  it("records partial failures for each failed AI step", async () => {
    const ollama = await getMockedOllama();
    ollama.generateSummary.mockRejectedValue(new Error("Summary failed"));
    ollama.generateTags.mockRejectedValue(new Error("Tags failed"));
    ollama.categorizeContent.mockRejectedValue(new Error("Category failed"));
    ollama.generateEmbedding.mockRejectedValue(new Error("Embedding failed"));
    ollama.extractKeyPoints.mockRejectedValue(new Error("KeyPoints failed"));
    ollama.analyzeSentiment.mockRejectedValue(new Error("Sentiment failed"));

    const { processNewItem } = await import("../lib/ai/pipeline");

    const result = await processNewItem({ id: "item-1", title: "Test", content: "Content" }, [
      { id: "existing-1", summary: "S1", title: "T1" },
    ]);

    expect(result.partialFailures).toContain("summary");
    expect(result.partialFailures).toContain("tags");
    expect(result.partialFailures).toContain("category");
    expect(result.partialFailures).toContain("embedding");
    expect(result.partialFailures).toContain("keyPoints");
    expect(result.partialFailures).toContain("sentiment");
  });
});

// ── batchProcessItems ──

describe("batchProcessItems", () => {
  it("processes a batch of items", async () => {
    process.env.AI_BATCH_SIZE = "2";

    const { batchProcessItems } = await import("../lib/ai/pipeline");

    const items = [
      { id: "item-1", title: "Item 1", content: "Content 1" },
      { id: "item-2", title: "Item 2", content: "Content 2" },
    ];

    const results = await batchProcessItems(items);

    expect(results.size).toBe(2);
    expect(results.has("item-1")).toBe(true);
    expect(results.has("item-2")).toBe(true);
  });

  it("returns empty map for empty input", async () => {
    const { batchProcessItems } = await import("../lib/ai/pipeline");

    const results = await batchProcessItems([]);
    expect(results.size).toBe(0);
  });

  it("handles items that fail processing without breaking the batch", async () => {
    const ollama = await getMockedOllama();
    ollama.generateSummary
      .mockResolvedValueOnce("Summary 1")
      .mockRejectedValueOnce(new Error("Failed"));

    process.env.AI_BATCH_SIZE = "2";

    const { batchProcessItems } = await import("../lib/ai/pipeline");

    const items = [
      { id: "item-1", title: "Item 1", content: "Content 1" },
      { id: "item-2", title: "Item 2", content: "Content 2" },
    ];

    const results = await batchProcessItems(items);
    // Item 1 should have been processed successfully
    expect(results.has("item-1")).toBe(true);
    const r1 = results.get("item-1")!;
    expect(r1.aiData.summary).toBe("Summary 1");
  });
});
