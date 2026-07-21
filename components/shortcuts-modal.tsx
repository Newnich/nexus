"use client";

import { useState, useEffect, useRef } from "react";

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: "⌘K", desc: "Open command palette" },
      { keys: "?", desc: "Toggle shortcuts reference" },
      { keys: "Esc", desc: "Close modals / Go back" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: "⌘N", desc: "Create new item" },
      { keys: "⌘↵", desc: "Save current item" },
      { keys: "⌘F", desc: "Focus search bar" },
    ],
  },
  {
    title: "Command Palette",
    shortcuts: [
      { keys: "↑↓", desc: "Navigate commands" },
      { keys: "↵", desc: "Execute selected command" },
      { keys: "Esc", desc: "Close palette" },
      { keys: "Tab", desc: "Stay in palette" },
    ],
  },
  {
    title: "Knowledge Graph",
    shortcuts: [
      { keys: "Click", desc: "View item details" },
      { keys: "Drag", desc: "Move node position" },
      { keys: "Scroll", desc: "Zoom in / out" },
      { keys: "Drag canvas", desc: "Pan the graph" },
    ],
  },
  {
    title: "Search",
    shortcuts: [
      { keys: "↵", desc: "Execute search" },
      { keys: "Tab", desc: "Switch search mode" },
    ],
  },
];

export function ShortcutsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Toggle with "?" key (not when focused on input)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !(e.metaKey || e.ctrlKey) &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
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

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="relative w-full max-w-lg glass-card rounded-2xl overflow-hidden shadow-2xl border-nexus-500/20 animate-fade-in-up max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <span className="text-xl">⌨️</span>
            <div>
              <h2 className="font-semibold">Keyboard Shortcuts</h2>
              <p className="text-xs text-muted-foreground">
                Master NEXUS with these shortcuts
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            ✕
          </button>
        </div>

        {/* Shortcuts list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {group.title}
              </h3>
              <div className="space-y-1">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.keys}
                    className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-muted/40 transition-colors"
                  >
                    <span className="text-xs text-muted-foreground">{shortcut.desc}</span>
                    <kbd className="px-2 py-0.5 bg-muted border border-border rounded text-[10px] text-foreground font-mono">
                      {shortcut.keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border/50 text-center">
          <p className="text-[10px] text-muted-foreground">
            Press <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[8px] font-mono">?</kbd> to toggle this modal anytime
          </p>
        </div>
      </div>
    </div>
  );
}
