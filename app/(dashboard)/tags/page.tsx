"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { PageSkeleton } from "@/components/page-skeleton";

interface TagEntry {
  name: string;
  count: number;
}

type TagAction = "rename" | "merge" | "delete";

export default function TagsPage() {
  const [tags, setTags] = useState<TagEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<TagEntry | null>(null);
  const [action, setAction] = useState<TagAction>("rename");
  const [actionValue, setActionValue] = useState("");
  const [processing, setProcessing] = useState(false);

  const fetchTags = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tags");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in");
        throw new Error("Failed to load tags");
      }
      const data = await res.json();
      setTags(data.tags || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const filteredTags = searchQuery
    ? tags.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tags;

  const handleTagAction = async () => {
    if (!selectedTag || !actionValue.trim()) return;

    if (action === "rename" && actionValue === selectedTag.name) {
      toast.error("New name must be different");
      return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          tag: selectedTag.name,
          ...(action !== "delete"
            ? {
                newName: actionValue
                  .trim()
                  .toLowerCase()
                  .replace(/[^a-z0-9-_\s]/g, ""),
              }
            : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }

      const data = await res.json();

      const actionLabels: Record<TagAction, string> = {
        rename: `Tag renamed from "${selectedTag.name}" to "${actionValue}"`,
        merge: `Tag "${selectedTag.name}" merged into "${actionValue}"`,
        delete: `Tag "${selectedTag.name}" deleted from ${data.updatedCount} item${data.updatedCount !== 1 ? "s" : ""}`,
      };

      toast.success(actionLabels[action]);
      setSelectedTag(null);
      setActionValue("");
      setAction("rename");
      fetchTags();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setProcessing(false);
    }
  };

  const openAction = (tag: TagEntry, actionType: TagAction) => {
    setSelectedTag(tag);
    setAction(actionType);
    setActionValue(actionType === "delete" ? "" : tag.name);
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Tags</h1>
          <p className="text-muted-foreground mt-1">
            {loading
              ? "Loading tags..."
              : `${total} tag${total !== 1 ? "s" : ""} across your items`}
          </p>
        </div>
        <Link
          href="/items"
          className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm hover:shadow-lg hover:shadow-nexus-500/25"
        >
          ← Back to Items
        </Link>
      </div>

      {/* ── Search ── */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
          ⌕
        </span>
        <input
          type="text"
          placeholder="Filter tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Action Modal ── */}
      {selectedTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="glass-card rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {action === "rename" && "Rename Tag"}
                {action === "merge" && "Merge Tag"}
                {action === "delete" && "Delete Tag"}
              </h3>
              <button
                onClick={() => {
                  setSelectedTag(null);
                  setActionValue("");
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              {action === "rename" &&
                `Rename "${selectedTag.name}" (${selectedTag.count} item${selectedTag.count !== 1 ? "s" : ""}) to:`}
              {action === "merge" &&
                `Merge "${selectedTag.name}" (${selectedTag.count} item${selectedTag.count !== 1 ? "s" : ""}) into another tag:`}
              {action === "delete" &&
                `Delete "${selectedTag.name}" from ${selectedTag.count} item${selectedTag.count !== 1 ? "s" : ""}? This cannot be undone.`}
            </p>

            {action !== "delete" && (
              <input
                type="text"
                placeholder={action === "rename" ? "New tag name..." : "Target tag name..."}
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTagAction()}
                className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
                autoFocus
              />
            )}

            {action === "rename" && actionValue && actionValue !== selectedTag.name && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                <span className="text-nexus-400">{selectedTag.count}</span> item
                {selectedTag.count !== 1 ? "s" : ""} will be updated.
              </div>
            )}

            {action === "merge" && actionValue && actionValue !== selectedTag.name && (
              <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
                Tag "{selectedTag.name}" ({selectedTag.count}) will merge into "{actionValue}".
                {tags.find((t) => t.name === actionValue) &&
                  ` "${actionValue}" currently has ${tags.find((t) => t.name === actionValue)!.count} items.`}
              </div>
            )}

            <div className="flex items-center gap-3 justify-end pt-2">
              <button
                onClick={() => {
                  setSelectedTag(null);
                  setActionValue("");
                }}
                className="px-4 py-2 glass-card hover:bg-card/70 rounded-xl text-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleTagAction}
                disabled={processing || (action !== "delete" && !actionValue.trim())}
                className={cn(
                  "px-5 py-2 rounded-xl text-sm transition-all disabled:opacity-50",
                  action === "delete"
                    ? "bg-red-500 hover:bg-red-600 text-white"
                    : "bg-nexus-500 hover:bg-nexus-600 text-white",
                )}
              >
                {processing
                  ? "Processing..."
                  : action === "delete"
                    ? "Delete"
                    : action === "rename"
                      ? "Rename"
                      : "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <PageSkeleton titleWidth="w-24" subtitleWidth="w-56" actionWidths={["w-32"]} searchBar>
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 skeleton rounded-2xl" />
            ))}
          </div>
        </PageSkeleton>
      )}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="text-center py-16 glass-card rounded-2xl border-red-500/20">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load tags</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={fetchTags}
            className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && filteredTags.length === 0 && (
        <div className="text-center py-20">
          <div className="text-5xl mb-6">🏷️</div>
          <h2 className="text-xl font-semibold mb-2">
            {searchQuery ? `No tags matching "${searchQuery}"` : "No tags yet"}
          </h2>
          <p className="text-muted-foreground mb-8">
            {searchQuery
              ? "Try a different search term"
              : "Tags are automatically generated by AI when you save items."}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="px-6 py-3 glass-card hover:bg-card/70 rounded-xl transition-all"
            >
              Clear search
            </button>
          )}
        </div>
      )}

      {/* ── Tag List ── */}
      {!loading && !error && filteredTags.length > 0 && (
        <div className="space-y-2">
          {filteredTags.map((tag) => (
            <div
              key={tag.name}
              className="glass-card p-4 rounded-2xl hover:bg-card/80 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-lg shrink-0">
                  🏷️
                </div>
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/search?q=${encodeURIComponent(tag.name)}&mode=semantic`}
                    className="text-sm font-semibold hover:text-nexus-400 transition-colors"
                  >
                    #{tag.name}
                  </Link>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {tag.count} item{tag.count !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => openAction(tag, "rename")}
                    className="px-3 py-1.5 glass-card hover:bg-card/70 rounded-lg text-xs transition-all"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => openAction(tag, "merge")}
                    className="px-3 py-1.5 glass-card hover:bg-card/70 rounded-lg text-xs transition-all"
                    title="Merge"
                  >
                    🔀
                  </button>
                  <button
                    onClick={() => openAction(tag, "delete")}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-all"
                    title="Delete"
                  >
                    🗑
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
