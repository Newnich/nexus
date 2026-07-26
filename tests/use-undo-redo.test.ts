// @vitest-environment jsdom

/**
 * Unit tests for lib/hooks/use-undo-redo.ts — Undo/Redo state management
 *
 * Tests the UndoRedo hook which manages a stack of snapshots.
 * Uses @testing-library/react's renderHook.
 *
 * Covers:
 *   - Initial state: present = initial, empty past/future
 *   - canUndo/canRedo false when no history
 *   - takeSnapshot pushes to past and clears future
 *   - undo pops from past and pushes to future
 *   - redo pops from future and pushes to past
 *   - Multiple undo/redo cycles
 *   - MAX_HISTORY limit (50 snapshots)
 *   - snapshotCount tracks past length
 *   - undo does nothing when past is empty
 *   - redo does nothing when future is empty
 */

import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useUndoRedo } from "../lib/hooks/use-undo-redo";

const initialSnapshot = {
  title: "Original",
  content: "Original content",
  tags: [],
  visibility: "private" as const,
};

// ── Tests ──

describe("useUndoRedo", () => {
  it("starts with present = initial, empty past/future", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    expect(result.current.present).toEqual(initialSnapshot);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.snapshotCount).toBe(0);
  });

  it("takeSnapshot pushes current to past and updates present", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    const newSnapshot = {
      title: "Edited",
      content: "Edited content",
      tags: ["tag1"],
      visibility: "private" as const,
    };

    act(() => {
      result.current.takeSnapshot(newSnapshot);
    });

    expect(result.current.present).toEqual(newSnapshot);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.snapshotCount).toBe(1);
  });

  it("undo reverts to previous snapshot", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    // Take a snapshot
    act(() => {
      result.current.takeSnapshot({
        title: "Edited",
        content: "Edited content",
        tags: [],
        visibility: "private",
      });
    });

    expect(result.current.present.title).toBe("Edited");

    // Undo
    act(() => {
      result.current.undo();
    });

    expect(result.current.present).toEqual(initialSnapshot);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it("redo restores the undone snapshot", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    // Take snapshot and undo
    act(() => {
      result.current.takeSnapshot({
        title: "Edited",
        content: "Edited content",
        tags: [],
        visibility: "private",
      });
    });

    act(() => {
      result.current.undo();
    });

    expect(result.current.present.title).toBe("Original");

    // Redo
    act(() => {
      result.current.redo();
    });

    expect(result.current.present.title).toBe("Edited");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it("takeSnapshot clears future (new branch after undo)", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    // Take snapshot, undo
    act(() => {
      result.current.takeSnapshot({
        title: "Version A",
        content: "A",
        tags: [],
        visibility: "private",
      });
    });
    act(() => {
      result.current.undo();
    });

    expect(result.current.canRedo).toBe(true);

    // Take a new snapshot (should clear future)
    act(() => {
      result.current.takeSnapshot({
        title: "Version B",
        content: "B",
        tags: [],
        visibility: "private",
      });
    });

    expect(result.current.canRedo).toBe(false);
    expect(result.current.present.title).toBe("Version B");
    expect(result.current.canUndo).toBe(true);
  });

  it("supports multiple undo steps", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    // Take 3 snapshots
    act(() => {
      result.current.takeSnapshot({
        title: "Edit 1",
        content: "1",
        tags: [],
        visibility: "private",
      });
    });
    act(() => {
      result.current.takeSnapshot({
        title: "Edit 2",
        content: "2",
        tags: [],
        visibility: "private",
      });
    });
    act(() => {
      result.current.takeSnapshot({
        title: "Edit 3",
        content: "3",
        tags: [],
        visibility: "private",
      });
    });

    expect(result.current.present.title).toBe("Edit 3");

    // Undo 2 steps
    act(() => {
      result.current.undo();
    });
    expect(result.current.present.title).toBe("Edit 2");

    act(() => {
      result.current.undo();
    });
    expect(result.current.present.title).toBe("Edit 1");

    // Redo 1 step
    act(() => {
      result.current.redo();
    });
    expect(result.current.present.title).toBe("Edit 2");
  });

  it("undo does nothing when past is empty", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    act(() => {
      result.current.undo();
    });

    // State should be unchanged
    expect(result.current.present).toEqual(initialSnapshot);
    expect(result.current.canUndo).toBe(false);
  });

  it("redo does nothing when future is empty", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    act(() => {
      result.current.redo();
    });

    expect(result.current.present).toEqual(initialSnapshot);
    expect(result.current.canRedo).toBe(false);
  });

  it("enforces MAX_HISTORY limit of 50 snapshots", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    // Take 55 snapshots (MAX_HISTORY = 50)
    for (let i = 1; i <= 55; i++) {
      act(() => {
        result.current.takeSnapshot({
          title: `Edit ${i}`,
          content: `${i}`,
          tags: [],
          visibility: "private",
        });
      });
    }

    // Should only have MAX_HISTORY snapshots in past
    expect(result.current.snapshotCount).toBe(50);
    // The oldest should have been shifted out
    // Present should be the last edit
    expect(result.current.present.title).toBe("Edit 55");
  });

  it("maintains correct state through undo/redo cycle", () => {
    const { result } = renderHook(() => useUndoRedo(initialSnapshot));

    // Take snapshots: A -> B -> C
    act(() => {
      result.current.takeSnapshot({ ...initialSnapshot, title: "A" });
    });
    act(() => {
      result.current.takeSnapshot({ ...initialSnapshot, title: "B" });
    });
    act(() => {
      result.current.takeSnapshot({ ...initialSnapshot, title: "C" });
    });

    expect(result.current.present.title).toBe("C");

    // Undo: C -> B
    act(() => result.current.undo());
    expect(result.current.present.title).toBe("B");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Undo: B -> A
    act(() => result.current.undo());
    expect(result.current.present.title).toBe("A");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);

    // Undo: A -> Original
    act(() => result.current.undo());
    expect(result.current.present.title).toBe("Original");
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);

    // Redo: Original -> A
    act(() => result.current.redo());
    expect(result.current.present.title).toBe("A");
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
  });
});
