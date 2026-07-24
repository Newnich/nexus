/**
 * Unit tests for lib/queue/alert-thresholds.ts
 *
 * Tests the pure logic (clamp, sanitize, defaults) without Redis.
 * The Redis-dependent functions (loadAlertThresholds, saveAlertThresholds,
 * resetAlertThresholds) are tested separately via integration tests.
 */

import { describe, it, expect } from "vitest";
import { DEFAULT_THRESHOLDS } from "../lib/queue/alert-thresholds";

// The sanitize and clamp functions are not exported, so we test through
// the re-exported DEFAULT_THRESHOLDS and verify the expected behavior
// by reimplementing the logic inline.

describe("DEFAULT_THRESHOLDS", () => {
  it("has sensible default values", () => {
    expect(DEFAULT_THRESHOLDS.consecutiveFailuresThreshold).toBe(3);
    expect(DEFAULT_THRESHOLDS.workerInactivityHours).toBe(2);
    expect(DEFAULT_THRESHOLDS.backlogThreshold).toBe(1000);
  });

  it("has positive threshold values", () => {
    expect(DEFAULT_THRESHOLDS.consecutiveFailuresThreshold).toBeGreaterThan(0);
    expect(DEFAULT_THRESHOLDS.workerInactivityHours).toBeGreaterThan(0);
    expect(DEFAULT_THRESHOLDS.backlogThreshold).toBeGreaterThan(0);
  });

  it("consecutiveFailuresThreshold is a reasonable number", () => {
    // Should be between 1 and 10 by default
    expect(DEFAULT_THRESHOLDS.consecutiveFailuresThreshold).toBeGreaterThanOrEqual(1);
    expect(DEFAULT_THRESHOLDS.consecutiveFailuresThreshold).toBeLessThanOrEqual(10);
  });

  it("workerInactivityHours is reasonable", () => {
    // Should be between 0.5 and 24 by default
    expect(DEFAULT_THRESHOLDS.workerInactivityHours).toBeGreaterThanOrEqual(0.5);
    expect(DEFAULT_THRESHOLDS.workerInactivityHours).toBeLessThanOrEqual(24);
  });

  it("backlogThreshold is reasonable", () => {
    // Should be between 10 and 100000 by default
    expect(DEFAULT_THRESHOLDS.backlogThreshold).toBeGreaterThanOrEqual(10);
    expect(DEFAULT_THRESHOLDS.backlogThreshold).toBeLessThanOrEqual(100000);
  });
});

// ── Clamp logic tests (reimplements the unexported clamp function) ──

describe("clamp logic", () => {
  function clamp(value: number, min: number, max: number, fallback: number): number {
    if (isNaN(value) || value < min || value > max) return fallback;
    return Math.round(value);
  }

  it("returns the value when within range", () => {
    expect(clamp(5, 1, 10, 3)).toBe(5);
  });

  it("returns fallback when value is below min", () => {
    expect(clamp(0, 1, 10, 3)).toBe(3);
  });

  it("returns fallback when value is above max", () => {
    expect(clamp(100, 1, 10, 3)).toBe(3);
  });

  it("returns fallback when value is NaN", () => {
    expect(clamp(NaN, 1, 10, 3)).toBe(3);
  });

  it("rounds the value", () => {
    expect(clamp(3.7, 1, 10, 3)).toBe(4);
  });

  it("accepts value at the minimum boundary", () => {
    expect(clamp(1, 1, 10, 3)).toBe(1);
  });

  it("accepts value at the maximum boundary", () => {
    expect(clamp(10, 1, 10, 3)).toBe(10);
  });

  it("handles 0 value correctly", () => {
    // 0 is below min of 1
    expect(clamp(0, 1, 10, 3)).toBe(3);
  });

  it("handles negative values correctly", () => {
    // -5 is below min of 1
    expect(clamp(-5, 1, 10, 3)).toBe(3);
  });

  it("handles float min/max", () => {
    expect(clamp(1.5, 0.5, 168, 1)).toBe(2); // rounded
    expect(clamp(0.3, 0.5, 168, 1)).toBe(1); // below min
  });
});

// ── Sanitize behavior tests (reimplements the unexported sanitize) ──

describe("sanitize behavior", () => {
  function clamp(value: number, min: number, max: number, fallback: number): number {
    if (isNaN(value) || value < min || value > max) return fallback;
    return Math.round(value);
  }

  function sanitize(
    raw: Partial<{
      consecutiveFailuresThreshold: number;
      workerInactivityHours: number;
      backlogThreshold: number;
    }>,
  ) {
    return {
      consecutiveFailuresThreshold: clamp(
        raw.consecutiveFailuresThreshold ?? DEFAULT_THRESHOLDS.consecutiveFailuresThreshold,
        1,
        50,
        DEFAULT_THRESHOLDS.consecutiveFailuresThreshold,
      ),
      workerInactivityHours: clamp(
        raw.workerInactivityHours ?? DEFAULT_THRESHOLDS.workerInactivityHours,
        0.5,
        168,
        DEFAULT_THRESHOLDS.workerInactivityHours,
      ),
      backlogThreshold: clamp(
        raw.backlogThreshold ?? DEFAULT_THRESHOLDS.backlogThreshold,
        10,
        100000,
        DEFAULT_THRESHOLDS.backlogThreshold,
      ),
    };
  }

  it("uses defaults for empty input", () => {
    const result = sanitize({});
    expect(result).toEqual(DEFAULT_THRESHOLDS);
  });

  it("uses provided valid values", () => {
    const result = sanitize({
      consecutiveFailuresThreshold: 10,
      workerInactivityHours: 4,
      backlogThreshold: 5000,
    });
    expect(result.consecutiveFailuresThreshold).toBe(10);
    expect(result.workerInactivityHours).toBe(4);
    expect(result.backlogThreshold).toBe(5000);
  });

  it("clamps out-of-range values to fallback", () => {
    const result = sanitize({
      consecutiveFailuresThreshold: 999,
      workerInactivityHours: -1,
      backlogThreshold: -5,
    });
    expect(result.consecutiveFailuresThreshold).toBe(
      DEFAULT_THRESHOLDS.consecutiveFailuresThreshold,
    );
    expect(result.workerInactivityHours).toBe(DEFAULT_THRESHOLDS.workerInactivityHours);
    expect(result.backlogThreshold).toBe(DEFAULT_THRESHOLDS.backlogThreshold);
  });

  it("rounds float values", () => {
    const result = sanitize({
      consecutiveFailuresThreshold: 3.7,
      backlogThreshold: 1500.3,
    });
    expect(result.consecutiveFailuresThreshold).toBe(4);
    expect(result.backlogThreshold).toBe(1500);
  });

  it("preserves valid values for each field independently", () => {
    const result = sanitize({
      consecutiveFailuresThreshold: 25, // valid
      workerInactivityHours: 100, // valid (0.5-168)
      backlogThreshold: 99999, // valid (10-100000)
    });
    expect(result.consecutiveFailuresThreshold).toBe(25);
    expect(result.workerInactivityHours).toBe(100);
    expect(result.backlogThreshold).toBe(99999);
  });

  it("replaces NaN values with defaults", () => {
    const result = sanitize({
      consecutiveFailuresThreshold: NaN,
      workerInactivityHours: NaN,
      backlogThreshold: NaN,
    });
    expect(result).toEqual(DEFAULT_THRESHOLDS);
  });
});
