/**
 * Unit tests for lib/utils.ts date formatting utilities.
 */

import { describe, it, expect } from "vitest";
import { formatDate, formatDateRelative } from "../lib/utils";

// The toValidDate helper is not exported, so we test through the public API.

describe("formatDateRelative", () => {
  it("returns 'Recently' for null", () => {
    expect(formatDateRelative(null)).toBe("Recently");
  });

  it("returns 'Recently' for undefined", () => {
    expect(formatDateRelative(undefined)).toBe("Recently");
  });

  it("returns 'Recently' for empty string", () => {
    expect(formatDateRelative("")).toBe("Recently");
  });

  it("returns 'Recently' for invalid date string", () => {
    expect(formatDateRelative("not-a-date")).toBe("Recently");
  });

  it("returns 'Recently' for garbage string", () => {
    expect(formatDateRelative("abc-123-xyz")).toBe("Recently");
  });

  it("handles valid ISO date string", () => {
    const result = formatDateRelative(new Date().toISOString());
    // Should NOT return "Recently" for a valid date
    expect(result).not.toBe("Recently");
    expect(result).toContain("ago");
  });

  it("handles a Date object", () => {
    const result = formatDateRelative(new Date());
    expect(result).not.toBe("Recently");
    expect(result).toContain("ago");
  });

  it("handles a date 5 minutes ago", () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const result = formatDateRelative(fiveMinAgo);
    expect(result).toContain("minute");
  });

  it("handles a date 2 hours ago", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const result = formatDateRelative(twoHoursAgo);
    expect(result).toContain("hour");
  });

  it("handles a date 3 days ago", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const result = formatDateRelative(threeDaysAgo);
    expect(result).toContain("day");
  });
});

describe("formatDate", () => {
  it("returns 'Unknown' for null", () => {
    expect(formatDate(null)).toBe("Unknown");
  });

  it("returns 'Unknown' for undefined", () => {
    expect(formatDate(undefined)).toBe("Unknown");
  });

  it("returns 'Unknown' for empty string", () => {
    expect(formatDate("")).toBe("Unknown");
  });

  it("returns 'Unknown' for invalid date string", () => {
    expect(formatDate("nope")).toBe("Unknown");
  });

  it("formats a valid date string", () => {
    const result = formatDate("2024-03-15T10:30:00Z");
    expect(result).toBe("Mar 15, 2024");
  });

  it("formats a Date object", () => {
    const result = formatDate(new Date("2024-07-04T12:00:00Z"));
    expect(result).toBe("Jul 4, 2024");
  });

  it("formats December date correctly", () => {
    const result = formatDate("2024-12-25T00:00:00Z");
    expect(result).toBe("Dec 25, 2024");
  });
});
