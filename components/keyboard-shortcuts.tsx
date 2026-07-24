"use client";

import { useEffect, useState } from "react";

interface ShortcutGroup {
  title: string;
  shortcuts: { keys: string[]; description: string }[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: ["⌘K", "Ctrl+K"], description: "Toggle command palette" },
      { keys: ["⌘S", "Ctrl+S"], description: "Save current item" },
      { keys: ["Esc"], description: "Close modal / cancel" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: ["⌘1"], description: "Go to Dashboard" },
      { keys: ["⌘2"], description: "Go to Items" },
      { keys: ["⌘3"], description: "Go to Collections" },
      { keys: ["⌘4"], description: "Go to Search" },
      { keys: ["⌘5"], description: "Go to Graph" },
      { keys: ["⌘6"], description: "Go to Settings" },
    ],
  },
  {
    title: "Items",
    shortcuts: [
      { keys: ["⌘N", "Ctrl+N"], description: "Create new item" },
      { keys: ["⌘⇧F"], description: "Toggle favorite" },
      { keys: ["⌘⇧A"], description: "Archive item" },
      { keys: ["⌘⇧Del"], description: "Delete item" },
    ],
  },
  {
    title: "Graph",
    shortcuts: [
      { keys: ["Scroll"], description: "Zoom in/out" },
      { keys: ["Drag canvas"], description: "Pan around" },
      { keys: ["Drag node"], description: "Move node" },
      { keys: ["Click node"], description: "View item" },
    ],
  },
  {
    title: "Search",
    shortcuts: [
      { keys: ["Enter"], description: "Execute search" },
      { keys: ["↑↓"], description: "Navigate results" },
      { keys: ["Esc"], description: "Clear search" },
    ],
  },
];

export function KeyboardShortcuts() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg max-h-[80vh] glass-card rounded-2xl overflow-hidden shadow-2xl border-nexus-500/20 animate-fade-in-up flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xl">⌨️</span>
            <div>
              <h2 className="font-semibold">Keyboard Shortcuts</h2>
              <p className="text-xs text-muted-foreground">
                Press {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"}+/ to toggle
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition-all text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        {/* Shortcuts */}
        <div className="overflow-y-auto p-4 space-y-6">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-muted/20 transition-colors"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, j) => (
                        <span key={j}>
                          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono text-muted-foreground">
                            {key}
                          </kbd>
                          {j < shortcut.keys.length - 1 && (
                            <span className="text-[10px] text-muted-foreground mx-0.5">or</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground">
            Press{" "}
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[8px] font-mono">
              Esc
            </kbd>{" "}
            to close
          </p>
        </div>
      </div>
    </div>
  );
}
