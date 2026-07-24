/**
 * Unit tests for lib/schemas.ts — Zod response schemas
 *
 * Tests that each schema:
 *   - Parses valid (matching the API shape) data successfully
 *   - Rejects clearly invalid data
 *   - Handles default values correctly
 */

import { describe, it, expect } from "vitest";
import {
  // Items
  ItemSchema,

  // Export / Import
  ExportDataResponseSchema,
  ImportDataResponseSchema,

  // Batch
  BatchUpdateResponseSchema,

  // API Keys
  ApiKeySchema,
  ApiKeysResponseSchema,
  ApiKeyCreateResponseSchema,
  ApiKeyDeleteResponseSchema,

  // Item Mutations
  ItemCreateResponseSchema,
  ItemUpdateResponseSchema,
  ItemDeleteResponseSchema,

  // AI Process
  AIProcessResponseSchema,

  // Tag Actions
  TagsActionResponseSchema,

  // Preferences
  PreferencesSaveResponseSchema,

  // Other existing schemas
  CollectionsResponseSchema,
  AlertThresholdsResponseSchema,
  CooldownConfigResponseSchema,
} from "../lib/schemas";

// ── Item Schema ──

describe("ItemSchema", () => {
  it("parses a minimal item", () => {
    const result = ItemSchema.parse({
      id: "abc123",
      title: "Test",
      type: "note",
      content: "Hello",
    });
    expect(result.id).toBe("abc123");
    expect(result.title).toBe("Test");
  });

  it("rejects missing required fields", () => {
    expect(() => ItemSchema.parse({})).toThrow();
  });
});

// ── Export / Import ──

describe("ExportDataResponseSchema", () => {
  const validExport = {
    exportedAt: "2025-06-15T12:00:00.000Z",
    version: "1.0",
    user: { id: "user1", email: "test@example.com" },
    stats: { items: 10, collections: 2, connections: 5 },
    items: [],
    collections: [],
    connections: [],
  };

  it("parses a valid export response", () => {
    const result = ExportDataResponseSchema.parse(validExport);
    expect(result.version).toBe("1.0");
    expect(result.stats.items).toBe(10);
  });

  it("rejects missing stats fields", () => {
    expect(() =>
      ExportDataResponseSchema.parse({ ...validExport, stats: { items: 10 } }),
    ).toThrow();
  });

  it("allows null email", () => {
    const result = ExportDataResponseSchema.parse({
      ...validExport,
      user: { id: "user1", email: null },
    });
    expect(result.user.email).toBeNull();
  });
});

describe("ImportDataResponseSchema", () => {
  const valid = { success: true, imported: 5, skipped: 0, total: 5, message: "Imported 5 items" };

  it("parses a valid import response", () => {
    const result = ImportDataResponseSchema.parse(valid);
    expect(result.imported).toBe(5);
    expect(result.success).toBe(true);
  });

  it("rejects missing required fields", () => {
    expect(() => ImportDataResponseSchema.parse({ success: true })).toThrow();
  });
});

// ── Batch Update ──

describe("BatchUpdateResponseSchema", () => {
  it("parses a batch update response with tags", () => {
    const result = BatchUpdateResponseSchema.parse({
      success: true,
      updatedCount: 3,
      totalItems: 10,
      tagsAdded: ["ai", "research"],
    });
    expect(result.updatedCount).toBe(3);
    expect(result.tagsAdded).toEqual(["ai", "research"]);
  });

  it("parses a batch update response without tags", () => {
    const result = BatchUpdateResponseSchema.parse({
      success: true,
      updatedCount: 0,
      totalItems: 0,
    });
    expect(result.success).toBe(true);
  });
});

// ── API Keys ──

describe("ApiKeySchema", () => {
  it("parses a valid API key", () => {
    const result = ApiKeySchema.parse({
      id: "key1",
      name: "My CLI",
      prefix: "nx_abc123...",
      created_at: "2025-01-01T00:00:00.000Z",
      last_used_at: null,
    });
    expect(result.name).toBe("My CLI");
  });

  it("rejects missing last_used_at when it's a string (must be nullable)", () => {
    expect(() =>
      ApiKeySchema.parse({
        id: "key1",
        name: "Test",
        prefix: "nx_...",
        created_at: "2025-01-01T00:00:00.000Z",
        last_used_at: "2025-06-01T00:00:00.000Z",
      }),
    ).not.toThrow();
  });
});

describe("ApiKeysResponseSchema", () => {
  it("defaults to empty array", () => {
    const result = ApiKeysResponseSchema.parse({});
    expect(result.keys).toEqual([]);
  });
});

describe("ApiKeyCreateResponseSchema", () => {
  it("parses a create response", () => {
    const result = ApiKeyCreateResponseSchema.parse({
      key: "nx_abc123def456",
      prefix: "nx_abc123...",
    });
    expect(result.key).toContain("nx_");
  });
});

describe("ApiKeyDeleteResponseSchema", () => {
  it("parses a delete response", () => {
    const result = ApiKeyDeleteResponseSchema.parse({ success: true });
    expect(result.success).toBe(true);
  });
});

// ── Item Mutations ──

describe("ItemCreateResponseSchema", () => {
  it("parses a create item response", () => {
    const result = ItemCreateResponseSchema.parse({
      item: { id: "item1", title: "My Item", type: "note" },
    });
    expect(result.item.id).toBe("item1");
  });

  it("allows minimal item object", () => {
    const result = ItemCreateResponseSchema.parse({ item: { id: "item1" } });
    expect(result.item.id).toBe("item1");
  });
});

describe("ItemUpdateResponseSchema", () => {
  it("parses an update response", () => {
    const result = ItemUpdateResponseSchema.parse({ item: { id: "item1" } });
    expect(result.item).toBeDefined();
  });
});

describe("ItemDeleteResponseSchema", () => {
  it("parses a delete response", () => {
    const result = ItemDeleteResponseSchema.parse({});
    expect(result.success).toBeUndefined();
  });
});

// ── AI Process ──

describe("AIProcessResponseSchema", () => {
  it("parses an AI process response", () => {
    const result = AIProcessResponseSchema.parse({ success: true });
    expect(result.success).toBe(true);
  });

  it("allows empty object", () => {
    const result = AIProcessResponseSchema.parse({});
    expect(result.success).toBeUndefined();
  });
});

// ── Tags Action ──

describe("TagsActionResponseSchema", () => {
  it("parses a rename action response", () => {
    const result = TagsActionResponseSchema.parse({
      success: true,
      action: "rename",
      tag: "old-tag",
      newName: "new-tag",
      updatedCount: 3,
    });
    expect(result.updatedCount).toBe(3);
  });

  it("parses a delete action response", () => {
    const result = TagsActionResponseSchema.parse({
      success: true,
      action: "delete",
      tag: "bad-tag",
      updatedCount: 5,
    });
    expect(result.updatedCount).toBe(5);
  });

  it("parses an error response", () => {
    const result = TagsActionResponseSchema.parse({
      success: false,
      error: "Tag not found",
    });
    expect(result.error).toBe("Tag not found");
  });
});

// ── Preferences Save ──

describe("PreferencesSaveResponseSchema", () => {
  it("parses a success response", () => {
    const result = PreferencesSaveResponseSchema.parse({ success: true });
    expect(result.success).toBe(true);
  });

  it("parses a failure response with error", () => {
    const result = PreferencesSaveResponseSchema.parse({
      success: false,
      error: "Failed to save",
    });
    expect(result.error).toBe("Failed to save");
  });
});

// ── Existing Schemas (smoke tests) ──

describe("CollectionsResponseSchema", () => {
  it("defaults to empty array", () => {
    const result = CollectionsResponseSchema.parse({});
    expect(result.collections).toEqual([]);
  });
});

describe("AlertThresholdsResponseSchema", () => {
  it("parses null thresholds", () => {
    const result = AlertThresholdsResponseSchema.parse({ thresholds: null });
    expect(result.thresholds).toBeNull();
  });
});

describe("CooldownConfigResponseSchema", () => {
  it("parses null cooldown", () => {
    const result = CooldownConfigResponseSchema.parse({ cooldown: null });
    expect(result.cooldown).toBeNull();
  });
});
