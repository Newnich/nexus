/**
 * Unit tests for lib/vector/pgvector.ts — pgvector storage and search
 *
 * Tests storeEmbedding, searchByVector, deleteEmbedding, deleteEmbeddings,
 * and getEmbeddingStats by mocking the Supabase client.
 *
 * Covers:
 *   - storeEmbedding updates item with embedding
 *   - storeEmbedding throws on error
 *   - searchByVector calls RPC with correct params
 *   - searchByVector maps results correctly
 *   - searchByVector throws on error
 *   - deleteEmbedding sets embedding to null
 *   - deleteEmbeddings handles multiple IDs
 *   - deleteEmbeddings returns early on empty array
 *   - getEmbeddingStats returns count and dimension
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── Chainable mock query builder ──
// All methods return the shared mockChain object so that
// from().update().eq() and from().select().not() chains work.

const mockEq = vi.fn();
const mockIn = vi.fn();
const mockNot = vi.fn();
const mockRpc = vi.fn();

const mockChain = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  eq: mockEq,
  in: mockIn,
  not: mockNot,
  rpc: mockRpc,
};

vi.mock("../lib/supabase/server", () => ({
  createServiceClient: vi.fn().mockResolvedValue(mockChain),
}));

beforeEach(() => {
  vi.clearAllMocks();

  // Default: eq() returns success (no error)
  mockEq.mockResolvedValue({ error: null });
  mockIn.mockResolvedValue({ error: null });

  // Default: getEmbeddingStats success
  mockNot.mockReturnThis();

  // Default: searchByVector success
  mockRpc.mockResolvedValue({
    data: [
      { id: "item-1", similarity: 0.95 },
      { id: "item-2", similarity: 0.87 },
    ],
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── storeEmbedding ──

describe("storeEmbedding", () => {
  it("updates the item with the embedding vector", async () => {
    const { storeEmbedding } = await import("../lib/vector/pgvector");
    await storeEmbedding("item-123", [0.1, 0.2, 0.3], "user-abc");

    expect(mockChain.from).toHaveBeenCalledWith("items");
    expect(mockChain.update).toHaveBeenCalledWith({ embedding: [0.1, 0.2, 0.3] });
    expect(mockEq).toHaveBeenCalledWith("id", "item-123");
  });

  it("throws when the update fails", async () => {
    mockEq.mockResolvedValue({ error: new Error("Database error") });

    const { storeEmbedding } = await import("../lib/vector/pgvector");
    await expect(storeEmbedding("item-123", [0.1, 0.2, 0.3], "user-abc")).rejects.toThrow(
      "Database error",
    );
  });
});

// ── searchByVector ──

describe("searchByVector", () => {
  it("calls the search_items RPC with correct params", async () => {
    const { searchByVector } = await import("../lib/vector/pgvector");
    await searchByVector([0.1, 0.2, 0.3], "user-abc", 10);

    expect(mockRpc).toHaveBeenCalledWith("search_items", {
      query_embedding: "[0.1,0.2,0.3]",
      user_id_param: "user-abc",
      match_count: 10,
    });
  });

  it("uses default limit of 20", async () => {
    const { searchByVector } = await import("../lib/vector/pgvector");
    await searchByVector([0.5], "user-xyz");

    expect(mockRpc).toHaveBeenCalledWith("search_items", {
      query_embedding: "[0.5]",
      user_id_param: "user-xyz",
      match_count: 20,
    });
  });

  it("returns mapped results with id and score", async () => {
    const { searchByVector } = await import("../lib/vector/pgvector");
    const results = await searchByVector([0.1, 0.2], "user-abc");

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ id: "item-1", score: 0.95 });
    expect(results[1]).toEqual({ id: "item-2", score: 0.87 });
  });

  it("returns empty array when data is null", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const { searchByVector } = await import("../lib/vector/pgvector");
    const results = await searchByVector([0.1], "user-abc");
    expect(results).toEqual([]);
  });

  it("throws when RPC call fails", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error("RPC failed"),
    });

    const { searchByVector } = await import("../lib/vector/pgvector");
    await expect(searchByVector([0.1], "user-abc")).rejects.toThrow("RPC failed");
  });

  it("handles empty embedding gracefully", async () => {
    const { searchByVector } = await import("../lib/vector/pgvector");
    await searchByVector([], "user-abc", 5);

    expect(mockRpc).toHaveBeenCalledWith("search_items", {
      query_embedding: "[]",
      user_id_param: "user-abc",
      match_count: 5,
    });
  });
});

// ── deleteEmbedding ──

describe("deleteEmbedding", () => {
  it("sets embedding to null for the given item", async () => {
    const { deleteEmbedding } = await import("../lib/vector/pgvector");
    await deleteEmbedding("item-123");

    expect(mockChain.from).toHaveBeenCalledWith("items");
    expect(mockChain.update).toHaveBeenCalledWith({ embedding: null });
    expect(mockEq).toHaveBeenCalledWith("id", "item-123");
  });
});

// ── deleteEmbeddings ──

describe("deleteEmbeddings", () => {
  it("sets embedding to null for multiple items", async () => {
    const { deleteEmbeddings } = await import("../lib/vector/pgvector");
    await deleteEmbeddings(["item-1", "item-2", "item-3"]);

    expect(mockChain.from).toHaveBeenCalledWith("items");
    expect(mockChain.update).toHaveBeenCalledWith({ embedding: null });
    expect(mockIn).toHaveBeenCalledWith("id", ["item-1", "item-2", "item-3"]);
  });

  it("returns early when the array is empty", async () => {
    const { deleteEmbeddings } = await import("../lib/vector/pgvector");
    await deleteEmbeddings([]);

    expect(mockChain.from).not.toHaveBeenCalled();
  });
});

// ── getEmbeddingStats ──

describe("getEmbeddingStats", () => {
  beforeEach(() => {
    vi.stubEnv("VECTOR_DIMENSION", "768");
    // Set up chain: from().select().not() -> returns count
    mockNot.mockResolvedValue({ count: 42, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns count of items with non-null embeddings", async () => {
    const { getEmbeddingStats } = await import("../lib/vector/pgvector");
    const stats = await getEmbeddingStats();

    expect(stats.totalEmbeddings).toBe(42);
    expect(stats.dimension).toBe(768);

    expect(mockChain.from).toHaveBeenCalledWith("items");
    expect(mockChain.select).toHaveBeenCalledWith("*", {
      count: "exact",
      head: true,
    });
    expect(mockNot).toHaveBeenCalledWith("embedding", "is", null);
  });

  it("returns 0 when count is null", async () => {
    mockNot.mockResolvedValue({ count: null, error: null });

    const { getEmbeddingStats } = await import("../lib/vector/pgvector");
    const stats = await getEmbeddingStats();

    expect(stats.totalEmbeddings).toBe(0);
  });

  it("uses dimension from env var", async () => {
    vi.stubEnv("VECTOR_DIMENSION", "1536");
    mockNot.mockResolvedValue({ count: 10, error: null });

    const { getEmbeddingStats } = await import("../lib/vector/pgvector");
    const stats = await getEmbeddingStats();

    expect(stats.dimension).toBe(1536);
  });
});
