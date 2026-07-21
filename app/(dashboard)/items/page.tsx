"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { formatDateRelative, extractDomain, ITEM_TYPE_CONFIG } from "@/lib/utils";

interface ListItem {
  id: string;
  title: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  ai_data: Record<string, unknown> | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

const ITEM_TYPES = ["all", "link", "note", "pdf", "image", "screenshot", "file", "video", "voice_memo"] as const;

const TYPE_ICONS: Record<string, string> = {
  link: "🔗", note: "📝", file: "📄", image: "🖼",
  screenshot: "📸", voice_memo: "🎤", pdf: "📕", video: "🎬",
};

const TYPE_GRADIENTS: Record<string, string> = {
  link: "from-blue-500/20 to-indigo-500/20",
  note: "from-yellow-500/20 to-amber-500/20",
  file: "from-emerald-500/20 to-green-500/20",
  image: "from-purple-500/20 to-pink-500/20",
  screenshot: "from-pink-500/20 to-rose-500/20",
  voice_memo: "from-orange-500/20 to-red-500/20",
  pdf: "from-red-500/20 to-rose-500/20",
  video: "from-cyan-500/20 to-blue-500/20",
};

export default function ItemsPage() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [items, setItems] = useState<ListItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showTagEditor, setShowTagEditor] = useState(false);
  const [tagEditorInput, setTagEditorInput] = useState("");
  const [tagEditorMode, setTagEditorMode] = useState<"add" | "remove">("add");
  const [tagSaving, setTagSaving] = useState(false);
  const [favoriting, setFavoriting] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 24;

  const filteredItems = items.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const aiData = item.ai_data as Record<string, unknown> | null;
    const tags = (aiData?.tags as string[]) || [];
    return (
      item.title.toLowerCase().includes(q) ||
      tags.some((t) => t.toLowerCase().includes(q)) ||
      (item.content && item.content.toLowerCase().includes(q))
    );
  });

  const fetchItems = useCallback(async (type: string, pageNum: number, append: boolean = false) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(pageNum * PAGE_SIZE),
      });
      if (type !== "all") params.set("type", type);
      if (showArchived) params.set("includeArchived", "true");

      const res = await fetch(`/api/items?${params}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in to view your items");
        throw new Error("Failed to load items");
      }
      const data = await res.json();

      if (append) {
        setItems((prev) => [...prev, ...(data.items || [])]);
      } else {
        setItems(data.items || []);
      }
      setCount(data.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      if (!append) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [showArchived]);

  useEffect(() => {
    setPage(0);
    fetchItems(selectedType, 0);
  }, [selectedType, showArchived, fetchItems]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems(selectedType, nextPage, true);
  };

  const hasMore = items.length < count;
  const displayItems = searchQuery ? filteredItems : items;

  // Toggle select mode
  const toggleSelectMode = () => {
    if (selectMode) {
      setSelectedIds(new Set());
    }
    setSelectMode(!selectMode);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === displayItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayItems.map((i) => i.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Delete ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} permanently?`)) return;
    setDeleting(true);
    try {
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/items/${id}`, { method: "DELETE" })
        )
      );
      const succeeded = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;
      if (succeeded > 0) {
        toast.success(`Deleted ${succeeded} item${succeeded !== 1 ? "s" : ""}`);
        setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
        setSelectedIds(new Set());
        setSelectMode(false);
      }
      if (failed > 0) toast.error(`Failed to delete ${failed} item${failed !== 1 ? "s" : ""}`);
    } catch {
      toast.error("Batch delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const handleBatchAddToCollection = async () => {
    if (selectedIds.size === 0) return;
    // Prompt for collection ID — simplified: use first available
    const input = prompt("Enter collection name to add items to:");
    if (!input?.trim()) return;
    // Look up collection by name (fetch available collections)
    try {
      const res = await fetch("/api/collections?limit=50");
      if (!res.ok) return;
      const data = await res.json();
      const collection = (data.collections || []).find(
        (c: { name: string }) => c.name.toLowerCase() === input.trim().toLowerCase()
      );
      if (!collection) {
        toast.error(`Collection "${input}" not found`);
        return;
      }
      const addRes = await fetch(`/api/collections/${collection.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: Array.from(selectedIds) }),
      });
      if (!addRes.ok) throw new Error("Failed to add items");
      toast.success(`Added ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""} to "${collection.name}"`);
      setSelectedIds(new Set());
      setSelectMode(false);
    } catch {
      toast.error("Failed to add items to collection");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Items</h1>
          <p className="text-muted-foreground mt-1">
            {loading
              ? "Loading your knowledge..."
              : `${count} item${count !== 1 ? "s" : ""} saved`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center glass-card p-0.5 rounded-lg">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                viewMode === "grid"
                  ? "bg-nexus-500/20 text-nexus-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ⊞ Grid
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 rounded-md text-xs transition-all ${
                viewMode === "list"
                  ? "bg-nexus-500/20 text-nexus-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              ☰ List
            </button>
          </div>
          {!loading && !error && items.length > 0 && (
            <button
              onClick={toggleSelectMode}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${
                selectMode
                  ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                  : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              ☑ {selectMode ? "Done" : "Select"}
            </button>
          )}
          <Link
            href="/items/new"
            className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm hover:shadow-lg hover:shadow-nexus-500/25"
          >
            <span>+</span>
            Save Item
          </Link>
        </div>
      </div>

      {/* ── Search Bar ── */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">⌕</span>
        <input
          type="text"
          placeholder="Search items by title, tag, or content..."
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

      {/* ── Type Filters + Archive Toggle ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => { setShowArchived(!showArchived); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
            showArchived
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
          }`}
        >
          🗃 {showArchived ? "Archived" : "Active"}
        </button>

        {ITEM_TYPES.map((type) => {
          const isActive = selectedType === type;
          const gradient = TYPE_GRADIENTS[type] || "";
          return (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all ${
                isActive
                  ? `bg-gradient-to-br ${gradient} text-nexus-400 border border-nexus-500/30`
                  : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
              }`}
            >
              {type !== "all" && <span className="text-xs">{TYPE_ICONS[type] || "📄"}</span>}
              {type === "all"
                ? "All Items"
                : type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
            </button>
          );
        })}
      </div>

      {/* ── Loading State ── */}
      {loading && (
        <div className={viewMode === "grid"
          ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
          : "space-y-3"
        }>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className={`skeleton rounded-2xl ${viewMode === "grid" ? "h-44" : "h-20"}`} />
          ))}
        </div>
      )}

      {/* ── Error State ── */}
      {error && !loading && (
        <div className="text-center py-16 glass-card rounded-2xl border-red-500/20">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load items</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => fetchItems(selectedType, 0)}
            className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty State ── */}
      {!loading && !error && filteredItems.length === 0 && (
        <div className="text-center py-20">
          {searchQuery ? (
            <>
              <div className="text-5xl mb-6">🔍</div>
              <h2 className="text-xl font-semibold mb-2">No results for &ldquo;{searchQuery}&rdquo;</h2>
              <p className="text-muted-foreground mb-6">Try a different search term or clear the filter</p>
              <button
                onClick={() => setSearchQuery("")}
                className="px-6 py-3 glass-card hover:bg-card/70 rounded-xl transition-all"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <div className="text-6xl mb-6">⟠</div>
              <h2 className="text-xl font-semibold mb-2">No items yet</h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                {selectedType !== "all"
                  ? `No ${selectedType} items found. Try a different filter.`
                  : "Start building your knowledge base. Save your first link, note, or file."}
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/items/new"
                  className="flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all hover:shadow-lg hover:shadow-nexus-500/25"
                >
                  <span>+</span>
                  Save your first item
                </Link>
                {selectedType !== "all" && (
                  <button
                    onClick={() => setSelectedType("all")}
                    className="px-6 py-3 glass-card hover:bg-card/70 rounded-xl transition-all text-sm"
                  >
                    Show all types
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Items Grid / List ── */}
      {!loading && !error && filteredItems.length > 0 && (
        <>
          {/* Results info */}
          {searchQuery && (
            <p className="text-xs text-muted-foreground">
              Found {filteredItems.length} result{filteredItems.length !== 1 ? "s" : ""} for &ldquo;{searchQuery}&rdquo;
            </p>
          )}

          {/* ── Batch Tag Editor Modal ── */}
          {showTagEditor && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
              <div className="glass-card rounded-2xl p-6 max-w-md w-full space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    {tagEditorMode === "add" ? "Add Tags" : "Remove Tags"}
                    <span className="text-sm font-normal text-muted-foreground ml-2">
                      ({selectedIds.size} item{selectedIds.size !== 1 ? "s" : ""})
                    </span>
                  </h3>
                  <button
                    onClick={() => setShowTagEditor(false)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <p className="text-sm text-muted-foreground">
                  {tagEditorMode === "add"
                    ? "Enter tags to add to all selected items"
                    : "Enter tags to remove from all selected items"}
                </p>

                <input
                  type="text"
                  placeholder={tagEditorMode === "add" ? "e.g. important, ai, research" : "e.g. draft, temp"}
                  value={tagEditorInput}
                  onChange={(e) => setTagEditorInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && document.getElementById("save-tags-btn")?.click()}
                  className="w-full px-4 py-2.5 bg-muted/50 border border-border rounded-xl text-sm focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
                  autoFocus
                />

                {tagEditorInput.trim() && (
                  <div className="flex flex-wrap gap-1.5">
                    {tagEditorInput
                      .split(/[\s,]+/)
                      .filter((t) => t.trim())
                      .map((t) => (
                        <span key={t} className="text-xs px-2 py-1 rounded-full bg-nexus-500/10 text-nexus-400">
                          #{t.toLowerCase().replace(/[^a-z0-9-_]/g, "")}
                        </span>
                      ))}
                  </div>
                )}

                <div className="flex items-center gap-3 justify-end pt-2">
                  <button
                    onClick={() => setShowTagEditor(false)}
                    className="px-4 py-2 glass-card hover:bg-card/70 rounded-xl text-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-tags-btn"
                    onClick={async () => {
                      const tags = tagEditorInput
                        .split(/[\s,]+/)
                        .map((t) => t.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
                        .filter(Boolean);
                      if (tags.length === 0) {
                        toast.error("Enter at least one tag");
                        return;
                      }
                      setTagSaving(true);
                      try {
                        const body = {
                          itemIds: Array.from(selectedIds),
                          ...(tagEditorMode === "add" ? { addTags: tags } : { removeTags: tags }),
                        };
                        const res = await fetch("/api/items/batch", {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(body),
                        });
                        if (!res.ok) throw new Error();
                        const data = await res.json();
                        toast.success(
                          tagEditorMode === "add"
                            ? `Added tags to ${data.updatedCount} item${data.updatedCount !== 1 ? "s" : ""}`
                            : `Removed tags from ${data.updatedCount} item${data.updatedCount !== 1 ? "s" : ""}`
                        );
                        setShowTagEditor(false);
                        setTagEditorInput("");
                        setSelectedIds(new Set());
                        setSelectMode(false);
                        fetchItems(selectedType, 0);
                      } catch {
                        toast.error("Failed to update tags");
                      } finally {
                        setTagSaving(false);
                      }
                    }}
                    disabled={tagSaving || !tagEditorInput.trim()}
                    className="px-5 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all disabled:opacity-50"
                  >
                    {tagSaving
                      ? "Saving..."
                      : tagEditorMode === "add"
                      ? `Add Tags (${selectedIds.size})`
                      : `Remove Tags (${selectedIds.size})`}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Select All bar */}
          {selectMode && displayItems.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 glass-card rounded-xl">
              <button
                onClick={selectAll}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                  selectedIds.size === displayItems.length
                    ? "border-nexus-500 bg-nexus-500"
                    : selectedIds.size > 0
                    ? "border-nexus-500 bg-nexus-500/30"
                    : "border-muted-foreground/30"
                }`}
              >
                {selectedIds.size === displayItems.length && <span className="text-white text-[10px]">✓</span>}
              </button>
              <span className="text-xs text-muted-foreground">
                {selectedIds.size === 0
                  ? `Select items (${displayItems.length} visible)`
                  : `${selectedIds.size} of ${displayItems.length} selected`}
              </span>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => { setShowTagEditor(true); setTagEditorMode("add"); setTagEditorInput(""); }}
                    className="px-3 py-1 glass-card hover:bg-card/70 rounded-lg text-xs transition-all"
                  >
                    🏷️ Add Tags
                  </button>
                  <button
                    onClick={() => { setShowTagEditor(true); setTagEditorMode("remove"); setTagEditorInput(""); }}
                    className="px-3 py-1 glass-card hover:bg-card/70 rounded-lg text-xs transition-all"
                  >
                    🚫 Remove Tags
                  </button>
                  <button
                    onClick={async () => {
                      setFavoriting(true);
                      try {
                        const results = await Promise.allSettled(
                          Array.from(selectedIds).map((id) =>
                            fetch(`/api/items/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isFavorite: true }),
                            })
                          )
                        );
                        const succeeded = results.filter((r) => r.status === "fulfilled").length;
                        if (succeeded > 0) {
                          toast.success(`Favorited ${succeeded} item${succeeded !== 1 ? "s" : ""}`);
                          setItems((prev) => prev.map((i) =>
                            selectedIds.has(i.id) ? { ...i, is_favorite: true } : i
                          ));
                          setSelectedIds(new Set());
                          setSelectMode(false);
                        }
                      } catch {
                        toast.error("Batch favorite failed");
                      } finally {
                        setFavoriting(false);
                      }
                    }}
                    disabled={favoriting}
                    className="px-3 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    {favoriting ? "⟳" : `★ Favorite (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={async () => {
                      setFavoriting(true);
                      try {
                        const results = await Promise.allSettled(
                          Array.from(selectedIds).map((id) =>
                            fetch(`/api/items/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isFavorite: false }),
                            })
                          )
                        );
                        const succeeded = results.filter((r) => r.status === "fulfilled").length;
                        if (succeeded > 0) {
                          toast.success(`Unfavorited ${succeeded} item${succeeded !== 1 ? "s" : ""}`);
                          setItems((prev) => prev.map((i) =>
                            selectedIds.has(i.id) ? { ...i, is_favorite: false } : i
                          ));
                          setSelectedIds(new Set());
                          setSelectMode(false);
                        }
                      } catch {
                        toast.error("Batch unfavorite failed");
                      } finally {
                        setFavoriting(false);
                      }
                    }}
                    disabled={favoriting}
                    className="px-3 py-1 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    {favoriting ? "⟳" : `☆ Unfavorite (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={handleBatchAddToCollection}
                    className="px-3 py-1 glass-card hover:bg-card/70 rounded-lg text-xs transition-all"
                  >
                    📁 Add to Collection
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(`Archive ${selectedIds.size} item${selectedIds.size !== 1 ? "s" : ""}?`)) return;
                      setArchiving(true);
                      try {
                        const results = await Promise.allSettled(
                          Array.from(selectedIds).map((id) =>
                            fetch(`/api/items/${id}`, {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ isArchived: true }),
                            })
                          )
                        );
                        const succeeded = results.filter((r) => r.status === "fulfilled").length;
                        if (succeeded > 0) {
                          toast.success(`Archived ${succeeded} item${succeeded !== 1 ? "s" : ""}`);
                          setItems((prev) => prev.filter((i) => !selectedIds.has(i.id)));
                          setSelectedIds(new Set());
                          setSelectMode(false);
                        }
                      } catch {
                        toast.error("Batch archive failed");
                      } finally {
                        setArchiving(false);
                      }
                    }}
                    disabled={archiving}
                    className="px-3 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    {archiving ? "⟳" : `🗃 Archive (${selectedIds.size})`}
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    disabled={deleting}
                    className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs transition-all disabled:opacity-50"
                  >
                    {deleting ? "⟳" : `🗑 Delete (${selectedIds.size})`}
                  </button>
                </div>
              )}
            </div>
          )}

          <div
            ref={gridRef}
            className={viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
              : "space-y-2"
            }
          >
            {displayItems.map((item, index) => {
              const isSelected = selectedIds.has(item.id);
              const config = ITEM_TYPE_CONFIG[item.type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.note;
              const aiData = item.ai_data as Record<string, unknown> | null;
              const summary = aiData?.summary as string | undefined;
              const tags = (aiData?.tags as string[]) || [];
              const category = aiData?.category as string | undefined;
              const domain = item.metadata?.sourceUrl
                ? extractDomain(item.metadata.sourceUrl as string)
                : null;
              const gradient = TYPE_GRADIENTS[item.type] || "from-nexus-500/20 to-indigo-500/20";

              if (viewMode === "grid") {
                return (
                  <div
                    key={item.id}
                    className={`group glass-card rounded-2xl overflow-hidden transition-all duration-500 hover-lift stagger-item ${
                      selectMode && isSelected ? "border-nexus-500 ring-1 ring-nexus-500/30" : "hover:border-nexus-500/30"
                    }`}
                    style={{ animationDelay: `${(index % 12) * 60}ms` }}
                  >
                    {/* Color accent bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${gradient}`} />

                    <div className="p-5">
                      {/* Select checkbox */}
                      {selectMode && (
                        <button
                          onClick={(e) => { e.preventDefault(); toggleSelect(item.id); }}
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center mb-2 transition-all ${
                            isSelected
                              ? "border-nexus-500 bg-nexus-500"
                              : "border-muted-foreground/30 hover:border-nexus-500/50"
                          }`}
                        >
                          {isSelected && <span className="text-white text-[10px]">✓</span>}
                        </button>
                      )}
                      {/* Top row */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-base shrink-0">
                          {config.icon}
                        </div>
                        {item.is_favorite && (
                          <span className="text-yellow-400 text-xs">★</span>
                        )}
                      </div>

                      {/* Title */}
                      <Link href={`/items/${item.id}`}>
                        <h3 className="text-sm font-semibold line-clamp-2 group-hover:text-nexus-400 transition-colors mb-1.5 leading-snug">
                          {item.title || "Untitled"}
                        </h3>
                      </Link>

                      {/* Summary */}
                      {summary && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                          {summary}
                        </p>
                      )}

                      {/* Bottom row */}
                      <div className="flex items-center gap-2 flex-wrap mt-auto">
                        {domain && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            ↗ {domain.length > 20 ? domain.slice(0, 20) + "…" : domain}
                          </span>
                        )}
                        {tags.length > 0 && tags.slice(0, 2).map((tag: string) => (
                          <span
                            key={tag}
                            className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>

                      {/* Bottom actions */}
                      <div className="flex items-center justify-between mt-3">
                        <p className="text-[10px] text-muted-foreground/60">
                          {formatDateRelative(item.created_at)}
                        </p>
                        {!selectMode && (
                          <button
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              try {
                                const res = await fetch(`/api/items/${item.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ isArchived: true }),
                                });
                                if (!res.ok) throw new Error();
                                toast.success("Item archived");
                                setItems((prev) => prev.filter((i) => i.id !== item.id));
                              } catch {
                                toast.error("Failed to archive");
                              }
                            }}
                            className="text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all"
                            title="Archive item"
                          >
                            🗃
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              // List view
              return (
                <div
                  key={item.id}
                  className={`p-4 glass-card hover:bg-card/80 rounded-2xl transition-all group stagger-item ${
                    selectMode && isSelected ? "border-nexus-500 ring-1 ring-nexus-500/30" : ""
                  }`}
                  style={{ animationDelay: `${(index % 12) * 60}ms` }}
                >
                  <div className="flex items-start gap-4">
                    {selectMode && (
                      <button
                        onClick={(e) => { e.preventDefault(); toggleSelect(item.id); }}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1 transition-all ${
                          isSelected
                            ? "border-nexus-500 bg-nexus-500"
                            : "border-muted-foreground/30 hover:border-nexus-500/50"
                        }`}
                      >
                        {isSelected && <span className="text-white text-[10px]">✓</span>}
                      </button>
                    )}
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shrink-0`}>
                      {config.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <Link href={`/items/${item.id}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[10px] font-medium text-nexus-400 bg-nexus-500/10 px-1.5 py-0.5 rounded uppercase">
                            {config.label}
                          </span>
                          {category && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              {category}
                            </span>
                          )}
                          {item.is_favorite && (
                            <span className="text-[10px] text-yellow-400">★</span>
                          )}
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {formatDateRelative(item.created_at)}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold truncate group-hover:text-nexus-400 transition-colors">
                          {item.title || "Untitled"}
                        </h3>
                      </Link>

                      {summary && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {summary}
                        </p>
                      )}

                      <div className="flex items-center gap-3 mt-2">
                        {domain && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            ↗ {domain}
                          </span>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {tags.slice(0, 3).map((tag: string) => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                                #{tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Archive button (list view, non-select mode) */}
                      {!selectMode && (
                        <button
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                              const res = await fetch(`/api/items/${item.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ isArchived: true }),
                              });
                              if (!res.ok) throw new Error();
                              toast.success("Item archived");
                              setItems((prev) => prev.filter((i) => i.id !== item.id));
                            } catch {
                              toast.error("Failed to archive");
                            }
                          }}
                          className="shrink-0 text-xs px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 transition-all self-start mt-1"
                          title="Archive item"
                        >
                          🗃
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && !searchQuery && (
            <div className="text-center pt-6">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 glass-card hover:bg-card/70 rounded-xl transition-all text-sm disabled:opacity-50 hover:border-nexus-500/30"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-4 h-4 border-2 border-nexus-500/30 border-t-nexus-500 rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : (
                  `Show more (${items.length} of ${count})`
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
