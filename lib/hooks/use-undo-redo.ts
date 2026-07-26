"use client";

import { useReducer, useCallback } from "react";

export interface Snapshot {
  title: string;
  content: string;
  tags: string[];
  visibility: "private" | "team" | "public";
}

const MAX_HISTORY = 50;

// ── Reducer for atomic state transitions ──

interface UndoRedoState {
  past: Snapshot[];
  present: Snapshot;
  future: Snapshot[];
}

type UndoRedoAction =
  { type: "TAKE_SNAPSHOT"; snapshot: Snapshot } | { type: "UNDO" } | { type: "REDO" };

function undoRedoReducer(state: UndoRedoState, action: UndoRedoAction): UndoRedoState {
  switch (action.type) {
    case "TAKE_SNAPSHOT": {
      const past = [...state.past, state.present];
      if (past.length > MAX_HISTORY) past.shift();
      return { past, present: action.snapshot, future: [] };
    }
    case "UNDO": {
      if (state.past.length === 0) return state;
      const previous = state.past[state.past.length - 1];
      return {
        past: state.past.slice(0, -1),
        present: previous,
        future: [state.present, ...state.future],
      };
    }
    case "REDO": {
      if (state.future.length === 0) return state;
      const next = state.future[0];
      return {
        past: [...state.past, state.present],
        present: next,
        future: state.future.slice(1),
      };
    }
  }
}

// ── Hook ──

export function useUndoRedo(initial: Snapshot) {
  const [state, dispatch] = useReducer(undoRedoReducer, {
    past: [],
    present: initial,
    future: [],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;
  const snapshotCount = state.past.length;

  const takeSnapshot = useCallback((snap: Snapshot) => {
    dispatch({ type: "TAKE_SNAPSHOT", snapshot: snap });
  }, []);

  const undo = useCallback(() => {
    dispatch({ type: "UNDO" });
  }, []);

  const redo = useCallback(() => {
    dispatch({ type: "REDO" });
  }, []);

  return {
    present: state.present,
    takeSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    snapshotCount,
  } as const;
}
