/**
 * Unit tests for lib/tag-colors.ts — shared tag color utilities
 */

import { describe, it, expect } from "vitest";
import { TAG_COLOR_PALETTE, hashTagToColor } from "../lib/tag-colors";

describe("TAG_COLOR_PALETTE", () => {
  it("has 15 colors", () => {
    expect(TAG_COLOR_PALETTE).toHaveLength(15);
  });

  it("all colors are valid hex strings", () => {
    for (const color of TAG_COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("hashTagToColor", () => {
  it("returns a color from the palette", () => {
    const color = hashTagToColor("test-tag");
    expect(TAG_COLOR_PALETTE).toContain(color);
  });

  it("is consistent for the same tag", () => {
    expect(hashTagToColor("ai-machine-learning")).toBe(hashTagToColor("ai-machine-learning"));
  });

  it("produces variance across different tags", () => {
    const colors = [
      "ai",
      "ml",
      "design",
      "ux",
      "frontend",
      "backend",
      "devops",
      "security",
      "data",
      "mobile",
    ].map(hashTagToColor);
    expect(new Set(colors).size).toBeGreaterThan(1);
  });

  it("handles single-character tags", () => {
    expect(TAG_COLOR_PALETTE).toContain(hashTagToColor("a"));
  });

  it("handles long tag names", () => {
    expect(TAG_COLOR_PALETTE).toContain(
      hashTagToColor("a-very-long-tag-name-exceeding-normal-length"),
    );
  });

  it("handles tags with numbers and special chars", () => {
    expect(TAG_COLOR_PALETTE).toContain(hashTagToColor("c++-programming-v2"));
  });
});
