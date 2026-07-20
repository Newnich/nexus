"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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

const ITEM_TYPES = ["all", "link", "note", "pdf", "image", "file", "video", "voice_memo"] as const;

export default function ItemsPage() {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [items, setItems] = useState<ListItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 20;

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
  }, []);

  // Fetch on mount and when type filter changes
  useEffect(() => {
    setPage(0);
    fetchItems(selectedType, 0);
  }, [selectedType, fetchItems]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchItems(selectedType, nextPage, true);
  };

  const hasMore = items.length < count;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Items</h1>
          <p className="text-muted-foreground mt-1">
            {loading
              ? "Loading your knowledge..."
              : `${count} item${count !== 1 ? "s" : ""} saved`}
          </p>
        </div>
        <Link
          href="/items/new"
          className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
        >
          <span>+</span>
          Save Item
        </Link>
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {ITEM_TYPES.map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              selectedType === type
                ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
            }`}
          >
            {type === "all"
              ? "All Items"
              : type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-5 glass-card rounded-2xl">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 skeleton rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-5 w-3/4 rounded" />
                  <div className="skeleton h-4 w-full rounded" />
                  <div className="flex gap-2">
                    <div className="skeleton h-5 w-16 rounded-full" />
                    <div className="skeleton h-5 w-20 rounded-full" />
                    <div className="skeleton h-5 w-14 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
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

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-20">
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
              className="flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
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
        </div>
      )}

      {/* Items List */}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="space-y-3">
            {items.map((item) => {
              const config = ITEM_TYPE_CONFIG[item.type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.note;
              const aiData = item.ai_data as Record<string, unknown> | null;
              const summary = aiData?.summary as string | undefined;
              const tags = (aiData?.tags as string[]) || [];
              const category = aiData?.category as string | undefined;
              const domain = item.metadata?.sourceUrl
                ? extractDomain(item.metadata.sourceUrl as string)
                : null;

              return (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="block p-5 glass-card hover:bg-card/80 rounded-2xl transition-all group"
                >
                  <div className="flex items-start gap-4">
                    {/* Type Icon */}
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-lg shrink-0">
                      {config.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Top Row: Type badge + Category + Date */}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-medium text-nexus-400 bg-nexus-500/10 px-1.5 py-0.5 rounded uppercase">
                          {config.label}
                        </span>
                        {category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {category}
                          </span>
                        )}
                        {item.is_favorite && (
                          <span className="text-[10px]">★</span>
                        )}
                        <span className="text-[10px] text-muted-foreground ml-auto">
                          {formatDateRelative(item.created_at)}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-semibold truncate group-hover:text-nexus-400 transition-colors">
                        {item.title || "Untitled"}
                      </h3>

                      {/* AI Summary */}
                      {summary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {summary}
                        </p>
                      )}

                      {/* Bottom Row: Domain + Tags */}
                      <div className="flex items-center gap-3 mt-3">
                        {domain && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <span>↗</span>
                            {domain}
                          </span>
                        )}
                        {tags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {tags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                              >
                                #{tag}
                              </span>
                            ))}
                            {tags.length > 3 && (
                              <span className="text-[10px] text-muted-foreground">
                                +{tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-8 py-3 glass-card hover:bg-card/70 rounded-xl transition-all text-sm disabled:opacity-50"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⟳</span>
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
