"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn, formatDateRelative, ITEM_TYPE_CONFIG, validatedFetcher } from "@/lib/utils";
import { CollectionDetailResponseSchema, ItemsResponseSchema } from "@/lib/schemas";

interface DetailItem {
  id: string;
  title: string;
  type: string;
  content: string;
  metadata: Record<string, unknown>;
  category: string | null;
  tags: string[];
  summary: string | null;
  addedAt: string;
  createdAt: string;
}

interface CollectionDetail {
  id: string;
  name: string;
  description: string;
  type: string;
  icon: string;
  color: string;
  itemCount: number;
  visibility: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CollectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const collectionId = params.id as string;

  const [collection, setCollection] = useState<CollectionDetail | null>(null);
  const [items, setItems] = useState<DetailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<DetailItem[]>([]);
  const [selectedAddItems, setSelectedAddItems] = useState<Set<string>>(new Set());
  const [loadingAvailable, setLoadingAvailable] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");

  const filteredItems = items.filter((item) => {
    if (selectedType !== "all" && item.type !== selectedType) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.tags.some((t) => t.toLowerCase().includes(q)) ||
      item.category?.toLowerCase().includes(q) ||
      (item.summary && item.summary.toLowerCase().includes(q))
    );
  });

  const fetchCollection = useCallback(async () => {
    try {
      const data = await validatedFetcher(
        `/api/collections/${collectionId}`,
        CollectionDetailResponseSchema,
      );
      setCollection(data.collection as CollectionDetail);
      setItems(data.items as DetailItem[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [collectionId]);

  useEffect(() => {
    fetchCollection();
  }, [fetchCollection]);

  const handleStartEdit = () => {
    if (!collection) return;
    setEditName(collection.name);
    setEditDesc(collection.description);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!collection || !editName.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/collections/${collectionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() }),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast.success("Collection updated");
      setEditing(false);
      setCollection((prev) =>
        prev ? { ...prev, name: editName.trim(), description: editDesc.trim() } : prev,
      );
    } catch {
      toast.error("Failed to update collection");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveItems = async (itemIds: string[]) => {
    setRemoving((prev) => [...prev, ...itemIds]);
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      });
      if (!res.ok) throw new Error("Failed to remove items");
      setItems((prev) => prev.filter((i) => !itemIds.includes(i.id)));
      setCollection((prev) =>
        prev ? { ...prev, itemCount: prev.itemCount - itemIds.length } : prev,
      );
      toast.success(`Removed ${itemIds.length} item${itemIds.length > 1 ? "s" : ""}`);
    } catch {
      toast.error("Failed to remove items");
    } finally {
      setRemoving((prev) => prev.filter((id) => !itemIds.includes(id)));
    }
  };

  const handleDeleteCollection = async () => {
    if (!confirm("Delete this collection? Items inside will NOT be deleted.")) return;
    try {
      const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Collection deleted");
      router.push("/collections");
    } catch {
      toast.error("Failed to delete collection");
    }
  };

  const openAddModal = async () => {
    setShowAddModal(true);
    setSelectedAddItems(new Set());
    setLoadingAvailable(true);
    try {
      const data = await validatedFetcher("/api/items?limit=200", ItemsResponseSchema);
      const existingIds = new Set(items.map((i) => i.id));
      // Map API response (snake_case, ai_data JSONB) to DetailItem interface
      const mapped = (data.items ?? [])
        .filter((raw: Record<string, unknown>) => !existingIds.has(raw.id as string))
        .map((raw: Record<string, unknown>) => {
          const aiData = raw.ai_data as Record<string, unknown> | null;
          return {
            id: raw.id as string,
            title: (raw.title as string) || "Untitled",
            type: raw.type as string,
            content: (raw.content as string) || "",
            metadata: (raw.metadata as Record<string, unknown>) || {},
            category: (aiData?.category as string) || null,
            tags: (aiData?.tags as string[]) || [],
            summary: (aiData?.summary as string) || null,
            addedAt: raw.created_at as string,
            createdAt: raw.created_at as string,
          };
        });
      setAvailableItems(mapped);
    } catch {
      toast.error("Failed to load available items");
    } finally {
      setLoadingAvailable(false);
    }
  };

  const handleAddItems = async () => {
    const itemIds = Array.from(selectedAddItems);
    if (itemIds.length === 0) return;
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds }),
      });
      if (!res.ok) throw new Error("Failed to add items");
      toast.success(`Added ${itemIds.length} item${itemIds.length > 1 ? "s" : ""}`);
      setShowAddModal(false);
      fetchCollection(); // Refresh
    } catch {
      toast.error("Failed to add items");
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 skeleton rounded-lg" />
        <div className="h-5 w-48 skeleton rounded" />
        <div className="grid grid-cols-1 gap-3 mt-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-6">🔍</div>
        <h2 className="text-xl font-semibold mb-2">{error || "Collection not found"}</h2>
        <p className="text-muted-foreground mb-8">This collection may have been deleted.</p>
        <Link
          href="/collections"
          className="px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
        >
          ← Back to Collections
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/collections")}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Collections
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0"
            style={{ backgroundColor: `${collection.color}15` }}
          >
            {collection.icon}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-lg font-bold focus:outline-none focus:ring-2 focus:ring-nexus-500/50"
                  autoFocus
                />
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-nexus-500/50 resize-none"
                  placeholder="Description (optional)"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={saving || !editName.trim()}
                    className="px-4 py-1.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg text-sm transition-all disabled:opacity-50"
                  >
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-1.5 glass-card hover:bg-card/70 rounded-lg text-sm transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold gradient-text">{collection.name}</h1>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    {collection.type === "manual"
                      ? "📁 Manual"
                      : collection.type === "auto"
                        ? "🤖 Auto"
                        : "🔍 Query"}
                  </span>
                </div>
                {collection.description && (
                  <p className="text-sm text-muted-foreground mt-1">{collection.description}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {collection.itemCount} item{collection.itemCount !== 1 ? "s" : ""}
                  {" · Created "}
                  {formatDateRelative(collection.createdAt)}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all"
            >
              <span>+</span>
              Add Items
            </button>
            <button
              onClick={handleStartEdit}
              className="p-2.5 rounded-xl border border-border hover:border-nexus-500/30 text-muted-foreground hover:text-foreground transition-all"
              title="Edit collection"
            >
              ✏️
            </button>
            <button
              onClick={handleDeleteCollection}
              className="p-2.5 rounded-xl border border-border hover:border-red-500/30 text-muted-foreground hover:text-red-400 transition-all"
              title="Delete collection"
            >
              🗑️
            </button>
          </div>
        )}
      </div>

      {/* Search & Filter */}
      {items.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              ⌕
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search within collection..."
              className="w-full pl-8 pr-4 py-2 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nexus-500/30 transition-all"
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
          <div className="flex items-center gap-1 flex-wrap">
            {["all", "link", "note", "pdf", "file", "image", "video"].map((type) => {
              const count =
                type === "all" ? items.length : items.filter((i) => i.type === type).length;
              if (type !== "all" && count === 0) return null;
              return (
                <button
                  key={type}
                  onClick={() => setSelectedType(type)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                    selectedType === type
                      ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                      : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
                  }`}
                >
                  {type === "all"
                    ? `All (${items.length})`
                    : `${type === "link" ? "🔗" : type === "note" ? "📝" : type === "pdf" ? "📕" : type === "file" ? "📄" : type === "image" ? "🖼" : "🎬"} ${type}`}
                </button>
              );
            })}
          </div>
          {searchQuery && (
            <span className="text-xs text-muted-foreground">
              Found {filteredItems.length} of {items.length}
            </span>
          )}
        </div>
      )}

      {/* Items List */}
      {(searchQuery || selectedType !== "all" ? filteredItems.length === 0 : items.length === 0) ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <div className="text-4xl mb-4">{searchQuery ? "🔍" : "📂"}</div>
          <h3 className="font-semibold mb-1">
            {searchQuery ? "No results found" : "This collection is empty"}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {searchQuery ? "Try a different search term." : "Add items to organize your knowledge."}
          </p>
          {!searchQuery && (
            <button
              onClick={openAddModal}
              className="px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
            >
              + Add Items
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {searchQuery ? `${filteredItems.length} of ${items.length}` : items.length} item
              {items.length !== 1 ? "s" : ""}
            </p>
          </div>

          {filteredItems.map((item) => {
            const config =
              ITEM_TYPE_CONFIG[item.type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.note;
            const isRemoving = removing.includes(item.id);

            return (
              <div
                key={item.id}
                className={cn(
                  "glass-card p-4 rounded-xl transition-all flex items-center gap-4",
                  isRemoving ? "opacity-50" : "hover:bg-card/80",
                )}
              >
                <Link href={`/items/${item.id}`} className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-500/10 text-nexus-400 shrink-0 uppercase">
                        {item.type}
                      </span>
                      {item.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                          {item.category}
                        </span>
                      )}
                    </div>
                    {item.summary && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                        {item.summary}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Added {formatDateRelative(item.addedAt)}
                    </p>
                  </div>
                </Link>

                <button
                  onClick={() => handleRemoveItems([item.id])}
                  disabled={isRemoving}
                  className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all shrink-0"
                  title="Remove from collection"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Items Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col m-4">
            <div className="flex items-center justify-between p-5 border-b border-border/50">
              <h2 className="font-semibold">Add Items</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-all"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {loadingAvailable ? (
                <div className="text-center py-12">
                  <div className="animate-spin text-2xl mb-3">⟳</div>
                  <p className="text-sm text-muted-foreground">Loading items...</p>
                </div>
              ) : availableItems.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">📂</div>
                  <p className="text-sm text-muted-foreground">
                    All your items are already in this collection!
                  </p>
                  <Link
                    href="/items/new"
                    className="inline-block mt-4 text-sm text-nexus-400 hover:underline"
                  >
                    Save new items →
                  </Link>
                </div>
              ) : (
                availableItems.map((item) => {
                  const config =
                    ITEM_TYPE_CONFIG[item.type as keyof typeof ITEM_TYPE_CONFIG] ||
                    ITEM_TYPE_CONFIG.note;
                  const isSelected = selectedAddItems.has(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setSelectedAddItems((prev) => {
                          const next = new Set(prev);
                          if (next.has(item.id)) next.delete(item.id);
                          else next.add(item.id);
                          return next;
                        });
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all",
                        isSelected
                          ? "bg-nexus-500/15 border border-nexus-500/30"
                          : "bg-muted/30 hover:bg-muted/60 border border-transparent",
                      )}
                    >
                      <div
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all",
                          isSelected
                            ? "border-nexus-500 bg-nexus-500"
                            : "border-muted-foreground/30",
                        )}
                      >
                        {isSelected && <span className="text-white text-xs">✓</span>}
                      </div>
                      <span className="text-lg shrink-0">{config.icon}</span>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.type}
                          {item.category ? ` · ${item.category}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between p-5 border-t border-border/50">
              <span className="text-xs text-muted-foreground">
                {selectedAddItems.size} selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 glass-card hover:bg-card/70 rounded-lg text-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddItems}
                  disabled={selectedAddItems.size === 0}
                  className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg text-sm transition-all disabled:opacity-50"
                >
                  Add ({selectedAddItems.size})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
