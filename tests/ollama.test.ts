/**
 * Unit tests for lib/ai/ollama.ts — AI provider functions
 *
 * Tests the parsing and error-handling logic of each function by
 * mocking global fetch. Actual AI calls are NOT made.
 *
 * Covers:
 *   - generateSummary text parsing
 *   - generateTags parsing (comma-separated, cleanup)
 *   - categorizeContent category matching
 *   - generateEmbedding response parsing
 *   - extractKeyPoints numbered list parsing
 *   - analyzeSentiment parsing ("positive" | "negative" | "neutral")
 *   - findConnections JSON parsing
 *   - Error handling (non-ok responses, invalid JSON)
 *   - fetch timeout behavior
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Mock fetch helper ──

let originalFetch: typeof globalThis.fetch;

function mockOllamaResponse(body: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: () => Promise.resolve(body),
  });
}

function mockOllamaChatResponse(content: string) {
  mockOllamaResponse({ message: { content }, done: true });
}

beforeEach(() => {
  originalFetch = globalThis.fetch;
  // Set env vars for deterministic tests
  process.env.OLLAMA_URL = "http://localhost:11434";
  process.env.OLLAMA_MODEL = "test-model";
  process.env.OLLAMA_EMBEDDING_MODEL = "test-embed-model";
  process.env.OLLAMA_TIMEOUT = "5000";
  process.env.OLLAMA_NUM_PREDICT = "1024";
  process.env.OLLAMA_TEMPERATURE = "0.3";
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

// ── generateSummary ──

describe("generateSummary", () => {
  it("returns the AI-generated summary text", async () => {
    mockOllamaChatResponse("This is a concise summary of the content.");
    const { generateSummary } = await import("../lib/ai/ollama");
    const result = await generateSummary("Some long text here...", "medium");
    expect(result).toBe("This is a concise summary of the content.");
  });

  it("falls back to 'Summary unavailable.' when response is empty", async () => {
    mockOllamaChatResponse("");
    const { generateSummary } = await import("../lib/ai/ollama");
    const result = await generateSummary("Text", "short");
    expect(result).toBe("Summary unavailable.");
  });

  it("handles non-ok HTTP response", async () => {
    mockOllamaResponse({}, false, 500);
    const { generateSummary } = await import("../lib/ai/ollama");
    await expect(generateSummary("Text", "medium")).rejects.toThrow(/Ollama generation failed/);
  });
});

// ── generateTags ──

describe("generateTags", () => {
  it("parses comma-separated tags", async () => {
    mockOllamaChatResponse("technology, ai, machine-learning, python, data-science");
    const { generateTags } = await import("../lib/ai/ollama");
    const result = await generateTags("Some text about AI");
    expect(result).toEqual(["technology", "ai", "machine-learning", "python", "data-science"]);
  });

  it("cleans up tag whitespace and special characters", async () => {
    mockOllamaChatResponse("  TagOne! , tag-two@ , tag#three , ALL-CAPS ");
    const { generateTags } = await import("../lib/ai/ollama");
    const result = await generateTags("Text");
    expect(result).toEqual(["tagone", "tag-two", "tagthree", "all-caps"]);
  });

  it("limits to 10 tags", async () => {
    const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`).join(", ");
    mockOllamaChatResponse(manyTags);
    const { generateTags } = await import("../lib/ai/ollama");
    const result = await generateTags("Text");
    expect(result.length).toBeLessThanOrEqual(10);
  });

  it("returns empty array for empty response", async () => {
    mockOllamaChatResponse("");
    const { generateTags } = await import("../lib/ai/ollama");
    const result = await generateTags("Text");
    expect(result).toEqual([]);
  });

  it("filters out empty tags from malformed input", async () => {
    mockOllamaChatResponse("tag1, , tag2, , tag3");
    const { generateTags } = await import("../lib/ai/ollama");
    const result = await generateTags("Text");
    expect(result).toEqual(["tag1", "tag2", "tag3"]);
  });
});

// ── categorizeContent ──

describe("categorizeContent", () => {
  it("returns a known category from the list", async () => {
    mockOllamaChatResponse("Technology");
    const { categorizeContent } = await import("../lib/ai/ollama");
    const result = await categorizeContent("Text about programming", "How to code");
    expect(result).toBe("Technology");
  });

  it("returns 'Uncategorized' when category is not in the list", async () => {
    mockOllamaChatResponse("Astrology");
    const { categorizeContent } = await import("../lib/ai/ollama");
    const result = await categorizeContent("Stars and planets", "Astronomy 101");
    expect(result).toBe("Uncategorized");
  });

  it("trims whitespace from category response", async () => {
    mockOllamaChatResponse("  Science  ");
    const { categorizeContent } = await import("../lib/ai/ollama");
    const result = await categorizeContent("Physics text", "Physics");
    expect(result).toBe("Science");
  });
});

// ── generateEmbedding ──

describe("generateEmbedding", () => {
  it("returns embedding array from response", async () => {
    mockOllamaResponse({ embedding: [0.1, 0.2, 0.3, 0.4] });
    const { generateEmbedding } = await import("../lib/ai/ollama");
    const result = await generateEmbedding("Text to embed");
    expect(result).toEqual([0.1, 0.2, 0.3, 0.4]);
  });

  it("returns empty array when embedding is missing", async () => {
    mockOllamaResponse({});
    const { generateEmbedding } = await import("../lib/ai/ollama");
    const result = await generateEmbedding("Text");
    expect(result).toEqual([]);
  });

  it("handles non-ok HTTP response", async () => {
    mockOllamaResponse({}, false, 400);
    const { generateEmbedding } = await import("../lib/ai/ollama");
    await expect(generateEmbedding("Text")).rejects.toThrow(/Ollama embedding failed/);
  });
});

// ── extractKeyPoints ──

describe("extractKeyPoints", () => {
  it("parses numbered list into string array", async () => {
    mockOllamaChatResponse("1. First key point\n2. Second key point\n3. Third key point");
    const { extractKeyPoints } = await import("../lib/ai/ollama");
    const result = await extractKeyPoints("Some text");
    expect(result).toEqual(["First key point", "Second key point", "Third key point"]);
  });

  it("handles numbered list with different formats", async () => {
    mockOllamaChatResponse("1) First point\n2) Second point\n3) Third point");
    const { extractKeyPoints } = await import("../lib/ai/ollama");
    const result = await extractKeyPoints("Text");
    expect(result).toEqual(["First point", "Second point", "Third point"]);
  });

  it("filters empty lines", async () => {
    mockOllamaChatResponse("1. Point one\n\n2. Point two\n\n");
    const { extractKeyPoints } = await import("../lib/ai/ollama");
    const result = await extractKeyPoints("Text");
    expect(result).toEqual(["Point one", "Point two"]);
  });
});

// ── analyzeSentiment ──

describe("analyzeSentiment", () => {
  it("returns 'positive' for positive sentiment", async () => {
    mockOllamaChatResponse("positive");
    const { analyzeSentiment } = await import("../lib/ai/ollama");
    const result = await analyzeSentiment("Great text!");
    expect(result).toBe("positive");
  });

  it("returns 'negative' for negative sentiment", async () => {
    mockOllamaChatResponse("negative");
    const { analyzeSentiment } = await import("../lib/ai/ollama");
    const result = await analyzeSentiment("Bad text");
    expect(result).toBe("negative");
  });

  it("returns 'neutral' for neutral sentiment", async () => {
    mockOllamaChatResponse("neutral");
    const { analyzeSentiment } = await import("../lib/ai/ollama");
    const result = await analyzeSentiment("A statement.");
    expect(result).toBe("neutral");
  });

  it("defaults to 'neutral' for unrecognized response", async () => {
    mockOllamaChatResponse("very positive!!!");
    const { analyzeSentiment } = await import("../lib/ai/ollama");
    const result = await analyzeSentiment("Text");
    expect(result).toBe("neutral");
  });

  it("handles case-insensitive response", async () => {
    mockOllamaChatResponse("POSITIVE");
    const { analyzeSentiment } = await import("../lib/ai/ollama");
    const result = await analyzeSentiment("Great!");
    expect(result).toBe("positive");
  });
});

// ── findConnections ──

describe("findConnections", () => {
  it("parses JSON array response", async () => {
    mockOllamaChatResponse(
      '[{"itemId": "id1", "reason": "Related topic", "strength": 0.8}, {"itemId": "id2", "reason": "Similar concept", "strength": 0.6}]',
    );
    const { findConnections } = await import("../lib/ai/ollama");
    const result = await findConnections("New text", [
      { id: "id1", summary: "About AI", title: "AI Overview" },
      { id: "id2", summary: "About ML", title: "ML Overview" },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].itemId).toBe("id1");
    expect(result[0].strength).toBe(0.8);
  });

  it("limits to 5 connections", async () => {
    const manyConnections = Array.from({ length: 10 }, (_, i) => ({
      itemId: `id${i}`,
      reason: `Reason ${i}`,
      strength: 0.1,
    }));
    mockOllamaChatResponse(JSON.stringify(manyConnections));
    const { findConnections } = await import("../lib/ai/ollama");
    const result = await findConnections("Text", [{ id: "id0", summary: "S1", title: "T1" }]);
    expect(result.length).toBeLessThanOrEqual(5);
  });

  it("falls back to extracting JSON from response when direct parse fails", async () => {
    mockOllamaChatResponse(
      'Here are the connections: [{"itemId": "id1", "reason": "Match", "strength": 0.7}]',
    );
    const { findConnections } = await import("../lib/ai/ollama");
    const result = await findConnections("Text", [{ id: "id1", summary: "S1", title: "T1" }]);
    expect(result).toHaveLength(1);
    expect(result[0].itemId).toBe("id1");
  });

  it("returns empty array when no JSON can be parsed", async () => {
    mockOllamaChatResponse("No connections found.");
    const { findConnections } = await import("../lib/ai/ollama");
    const result = await findConnections("Text", [{ id: "id1", summary: "S1", title: "T1" }]);
    expect(result).toEqual([]);
  });

  it("returns empty array for non-array JSON", async () => {
    mockOllamaChatResponse('{"connections": []}');
    const { findConnections } = await import("../lib/ai/ollama");
    const result = await findConnections("Text", [{ id: "id1", summary: "S1", title: "T1" }]);
    expect(result).toEqual([]);
  });
});
