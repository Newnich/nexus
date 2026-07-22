"use client";

import { useState, useCallback, useEffect } from "react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { useUndoRedo } from "@/lib/hooks/use-undo-redo";
import type { Item } from "@/types/item";

interface ItemEditorProps {
  item: Item;
  onSave: (updates: Record<string, unknown>) => Promise<void>;
  onCancel: () => void;
}

export function ItemEditor({ item, onSave, onCancel }: ItemEditorProps) {
  const { present, takeSnapshot, undo, redo, canUndo, canRedo, snapshotCount } = useUndoRedo({
    title: item.title,
    content: item.content || "",
    tags: item.aiData?.tags || [],
    visibility: item.visibility,
  });

  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState(item.title);
  const [content, setContent] = useState(item.content || "");
  const [tagsInput, setTagsInput] = useState((item.aiData?.tags || []).join(", "));
  const [visibility, setVisibility] = useState(item.visibility);

  // Keyboard shortcut: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  // Sync editor state when undo/redo occurs
  useEffect(() => {
    setTitle(present.title);
    setContent(present.content);
    setTagsInput(present.tags.join(", "));
    setVisibility(present.visibility);
  }, [present]);

  const handleFieldChange = useCallback(
    (field: string, value: string) => {
      // Take snapshot before changing
      takeSnapshot({
        title,
        content,
        tags: tagsInput
          .split(/[,\s]+/)
          .map((t) =>
            t
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9-\s]/g, ""),
          )
          .filter(Boolean),
        visibility,
      });
      // Update the specific field
      if (field === "title") setTitle(value);
      else if (field === "content") setContent(value);
      else if (field === "tags") setTagsInput(value);
      else if (field === "visibility") {
        // Safe: only ever called with one of the three valid values from the UI
        const vis: "private" | "team" | "public" = value as unknown as
          "private" | "team" | "public";
        setVisibility(vis);
      }
    },
    [title, content, tagsInput, visibility, takeSnapshot],
  );

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(/[,\s]+/)
        .map((t) =>
          t
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-\s]/g, ""),
        )
        .filter(Boolean);

      const updates: Record<string, unknown> = {
        title: title.trim(),
        content: content.trim(),
        visibility,
      };

      // Include tags if changed
      if (tags.length > 0 || (item.aiData?.tags?.length || 0) > 0) {
        const currentTags = item.aiData?.tags || [];
        const changed =
          tags.length !== currentTags.length || tags.some((t, i) => t !== currentTags[i]);
        if (changed) {
          updates.aiData = { ...item.aiData, tags };
        }
      }

      await onSave(updates);
      toast.success("Item updated");
    } catch {
      toast.error("Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [title, content, tagsInput, visibility, item, onSave]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-nexus-500/20 to-indigo-500/20" />
      <div className="p-6 space-y-5">
        {/* Undo/Redo Toolbar */}
        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
          <button
            onClick={undo}
            disabled={!canUndo}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            title="Undo (Ctrl+Z)"
          >
            ↩️
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-all text-sm disabled:opacity-30 disabled:cursor-not-allowed"
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪️
          </button>
          <span className="text-xs text-muted-foreground/50 mx-1">|</span>
          <span className="text-xs text-muted-foreground/60">
            {snapshotCount > 0
              ? `${snapshotCount} snapshot${snapshotCount !== 1 ? "s" : ""}`
              : "No history"}
          </span>
        </div>

        {/* Title */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => handleFieldChange("title", e.target.value)}
            placeholder="Item title..."
            className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-lg font-bold focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
            autoFocus
          />
        </div>

        {/* Content */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => handleFieldChange("content", e.target.value)}
            placeholder="Item content..."
            rows={6}
            className="w-full px-4 py-3 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all resize-none font-mono leading-relaxed"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Tags{" "}
            <span className="font-normal lowercase text-muted-foreground/60">
              (comma separated)
            </span>
          </label>
          <input
            type="text"
            value={tagsInput}
            onChange={(e) => handleFieldChange("tags", e.target.value)}
            placeholder="ai, machine-learning, research"
            className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
          />
          {tagsInput.trim() && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {tagsInput
                .split(/[,\s]+/)
                .filter(Boolean)
                .map((t) => (
                  <span
                    key={t}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-nexus-500/10 text-nexus-400"
                  >
                    #{t.toLowerCase().replace(/[^a-z0-9-_]/g, "")}
                  </span>
                ))}
            </div>
          )}
        </div>

        {/* Visibility */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
            Visibility
          </label>
          <div className="flex items-center gap-2">
            {["private", "team", "public"].map((v) => (
              <button
                key={v}
                onClick={() => handleFieldChange("visibility", v)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs transition-all",
                  visibility === v
                    ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                    : "glass-card text-muted-foreground hover:text-foreground",
                )}
              >
                {v === "private" ? "🔒 Private" : v === "team" ? "👥 Team" : "🌍 Public"}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2 border-t border-border/50">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 glass-card hover:bg-card/70 rounded-xl text-sm transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="flex-1 px-4 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
