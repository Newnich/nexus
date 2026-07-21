"use client";

import { useState, useCallback, useRef } from "react";

export interface Snapshot {
  title: string;
  content: string;
  tags: string[];
  visibility: "private" | "team" | "public";
}

const MAX_HISTORY = 50;

export function useUndoRedo(initial: Snapshot) {
  const [past, setPast] = useState<Snapshot[]>([]);
  const [present, setPresent] = useState<Snapshot>(initial);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const snapshotRef = useRef(initial);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;
  const snapshotCount = past.length;

  const takeSnapshot = useCallback((snap: Snapshot) => {
    setPast((prev) => {
      const updated = [...prev, snapshotRef.current];
      if (updated.length > MAX_HISTORY) updated.shift();
      return updated;
    });
    snapshotRef.current = snap;
    setPresent(snap);
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    if (past.length === 0) return;
    const previous = past[past.length - 1];
    setPast((prev) => prev.slice(0, -1));
    setFuture((prev) => [present, ...prev]);
    snapshotRef.current = previous;
    setPresent(previous);
  }, [past, present]);

  const redo = useCallback(() => {
    if (future.length === 0) return;
    const next = future[0];
    setFuture((prev) => prev.slice(1));
    setPast((prev) => [...prev, present]);
    snapshotRef.current = next;
    setPresent(next);
  }, [future, present]);

  return {
    present,
    takeSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    snapshotCount,
  } as const;
}
