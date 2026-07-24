/**
 * Unit tests for lib/ai/
 *
 * Tests pure functions from:
 *   - pipeline.ts (calculateItemRelevance)
 */

import { describe, it, expect, beforeAll } from "vitest";
import type { Item } from "@/types/item";

describe("calculateItemRelevance", () => {
  let calculateItemRelevance: (item: Item, queryEmbedding: number[]) => number;

  beforeAll(async () => {
    const mod = await import("../lib/ai/pipeline");
    calculateItemRelevance = mod.calculateItemRelevance;
  });

  function makeItem(embedding?: number[]): Item {
    return {
      id: "test-id",
      title: "Test",
      type: "note",
      content: "",
      metadata: {},
      aiData: embedding ? { embedding } : null,
      createdAt: "",
      updatedAt: "",
      isFavorite: false,
      isArchived: false,
      userId: "",
    } as Item;
  }

  it("returns 1.0 for identical embeddings", () => {
    const embedding = [0.5, 0.3, -0.1, 0.8, 0.2];
    const item = makeItem(embedding);
    expect(calculateItemRelevance(item, embedding)).toBeCloseTo(1.0, 5);
  });

  it("returns 0 for orthogonal vectors", () => {
    const item = makeItem([1, 0]);
    expect(calculateItemRelevance(item, [0, 1])).toBeCloseTo(0, 5);
  });

  it("returns negative for opposite vectors", () => {
    const item = makeItem([1, 0]);
    expect(calculateItemRelevance(item, [-1, 0])).toBeCloseTo(-1, 5);
  });

  it("returns 0 when item has no embedding", () => {
    const item = makeItem();
    expect(calculateItemRelevance(item, [0.5, 0.5])).toBe(0);
  });

  it("returns 0 when item embedding is empty array", () => {
    const item = makeItem([]);
    expect(calculateItemRelevance(item, [0.5, 0.5])).toBe(0);
  });

  it("returns 0 when query embedding is empty", () => {
    const item = makeItem([0.5, 0.5]);
    expect(calculateItemRelevance(item, [])).toBe(0);
  });

  it("handles different vector lengths gracefully", () => {
    const item = makeItem([1, 0, 0.5]);
    // Only the first 2 dimensions match, the third is ignored
    const result = calculateItemRelevance(item, [0, 1]);
    // [1, 0] · [0, 1] / (|1,0| * |0,1|) = 0 / (1 * 1) = 0
    expect(result).toBeCloseTo(0, 5);
  });

  it("computes cosine similarity correctly", () => {
    // v1 = [1, 2, 3], v2 = [4, 5, 6]
    // dot = 4 + 10 + 18 = 32
    // |v1| = sqrt(1+4+9) = sqrt(14)
    // |v2| = sqrt(16+25+36) = sqrt(77)
    // cos = 32 / (sqrt(14) * sqrt(77)) = 32 / sqrt(1078) ≈ 32 / 32.83 ≈ 0.974
    const item = makeItem([1, 2, 3]);
    const result = calculateItemRelevance(item, [4, 5, 6]);
    const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
    expect(result).toBeCloseTo(expected, 5);
  });

  it("handles negative values correctly", () => {
    const item = makeItem([-1, -2]);
    const result = calculateItemRelevance(item, [1, 2]);
    // dot = -1 + -4 = -5
    // |v1| = sqrt(5), |v2| = sqrt(5)
    // cos = -5 / 5 = -1
    expect(result).toBeCloseTo(-1, 5);
  });
});
