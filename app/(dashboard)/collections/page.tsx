"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatDateRelative } from "@/lib/utils";

interface CollectionItem {
  id: string;
  name: string;
  description: string;
  type: "manual" | "auto" | "query";
  icon: string;
  color: string;
  itemCount: number;
  visibility: string;
  parentId: string | null;
  previewItems: Array<{
    id: string;
    title: string;
    type: string;
    category: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

const TYPE_FILTERS = [
  { type: "all" as const, label: "All Collections", icon: "▦" },
  { type: "manual" as const, label: "Manual", icon: "📁" },
  { type: "auto" as const, label: "AI Auto", icon: "🤖" },
  { type: "query" as const, label: "Smart Queries", icon: "🔍" },
];

const ITEM_TYPE_ICONS: Record<string, string> = {
  link: "🔗",
  note: "📝",
  file: "📄",
  image: "🖼",
  screenshot: "📸",
  voice_memo: "🎤",
  pdf: "📕",
  video: "🎬",
};

export default function CollectionsPage() {
  const router = useRouter();
  const [selectedFilter, setSelectedFilter] = useState<string>("all");
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCollections = useCallback(async (type: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = type !== "all" ? `?type=${type}` : "";
      const res = await fetch(`/api/collections${params}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in");
        throw new Error("Failed to load collections");
      }
      const data = await res.json();
      setCollections(data.collections || []);
      setCount(data.count || 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setCollections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCollections(selectedFilter);
  }, [selectedFilter, fetchCollections]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-8 w-48 skeleton rounded-lg" />
            <div className="h-5 w-64 skeleton rounded mt-2" />
          </div>
          <div className="h-10 w-36 skeleton rounded-lg" />
        </div>
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-9 w-28 skeleton rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">Collections</h1>
            <p className="text-muted-foreground mt-1">Smart folders that organize your knowledge</p>
          </div>
        </div>
        <div className="text-center py-16 glass-card rounded-2xl border-red-500/20">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load collections</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => fetchCollections(selectedFilter)}
            className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Collections</h1>
          <p className="text-muted-foreground mt-1">
            {count > 0
              ? `${count} collection${count !== 1 ? "s" : ""} — smart folders that organize your knowledge`
              : "Smart folders that organize your knowledge"}
          </p>
        </div>
        {count > 0 && (
          <button
            disabled
            title="Collection creation coming soon"
            className="flex items-center gap-2 px-4 py-2 bg-nexus-500/50 text-white/60 rounded-lg text-sm cursor-not-allowed"
          >
            <span>+</span>
            New Collection
          </button>
        )}
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {TYPE_FILTERS.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => setSelectedFilter(type)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all",
              selectedFilter === type
                ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                : "glass-card text-muted-foreground hover:text-foreground border border-transparent",
            )}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {collections.length === 0 && (
        <div className="text-center py-16 glass-card rounded-2xl">
          <div className="text-5xl mb-4">▦</div>
          <h2 className="text-xl font-semibold mb-2">
            {selectedFilter === "all" ? "No collections yet" : `No ${selectedFilter} collections`}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {selectedFilter === "all"
              ? "Collections help you organize related items. Create your first one to group your knowledge."
              : `You don't have any ${selectedFilter} collections yet. They'll appear here when you create them.`}
          </p>
          {selectedFilter === "all" && (
            <button
              disabled
              title="Collection creation coming soon"
              className="inline-flex items-center gap-2 px-6 py-3 bg-nexus-500/50 text-white/60 rounded-xl cursor-not-allowed"
            >
              <span>+</span>
              Create Collection
            </button>
          )}
        </div>
      )}

      {/* Collection Cards */}
      {collections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {collections.map((collection) => (
            <div
              key={collection.id}
              onClick={() => router.push(`/collections/${collection.id}`)}
              className="glass-card p-6 rounded-2xl hover:border-nexus-500/30 transition-all group cursor-pointer"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${collection.color}15` }}
                  >
                    {collection.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold group-hover:text-nexus-400 transition-colors">
                      {collection.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {collection.type === "manual"
                        ? "📁 Manual"
                        : collection.type === "auto"
                          ? "🤖 Auto"
                          : "🔍 Query"}
                      {" · "}
                      {collection.itemCount} item{collection.itemCount !== 1 ? "s" : ""}
                      {collection.visibility !== "private" && (
                        <> · {collection.visibility === "public" ? "🌍" : "👥"}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Description */}
              {collection.description && (
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {collection.description}
                </p>
              )}

              {/* Item Previews */}
              {collection.previewItems.length > 0 && (
                <div className="space-y-1.5 mb-4">
                  {collection.previewItems.map((item) => (
                    <Link
                      key={item.id}
                      href={`/items/${item.id}`}
                      className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-all text-sm"
                    >
                      <span>{ITEM_TYPE_ICONS[item.type] || "📄"}</span>
                      <span className="flex-1 truncate">{item.title}</span>
                      {item.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-500/10 text-nexus-400 shrink-0">
                          {item.category}
                        </span>
                      )}
                    </Link>
                  ))}
                  {collection.itemCount > collection.previewItems.length && (
                    <p className="text-xs text-muted-foreground text-center pt-1">
                      +{collection.itemCount - collection.previewItems.length} more
                    </p>
                  )}
                </div>
              )}

              {/* Empty preview state */}
              {collection.previewItems.length === 0 && (
                <div className="py-6 text-center">
                  <p className="text-xs text-muted-foreground">No items yet</p>
                </div>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                <span>Created {formatDateRelative(collection.createdAt)}</span>
                <span className="text-nexus-400 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                  View →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
