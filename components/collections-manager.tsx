"use client";

import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import { useApiData } from "@/lib/hooks/use-api-data";
import { CollectionsResponseSchema, ItemCollectionsResponseSchema } from "@/lib/schemas";

interface CollectionManagerProps {
  itemId: string;
}

export function CollectionsManager({ itemId }: CollectionManagerProps) {
  const [open, setOpen] = useState(false);
  const [memberCollectionIds, setMemberCollectionIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Fetch collections when dropdown opens
  const {
    data: colData,
    loading: loadingCols,
    error: colError,
  } = useApiData(open ? "/api/collections?limit=100" : null, CollectionsResponseSchema);

  const { data: memData, loading: loadingMem } = useApiData(
    open ? `/api/items/${itemId}/collections` : null,
    ItemCollectionsResponseSchema,
  );

  // Sync member collections from server data
  useEffect(() => {
    if (memData) {
      setMemberCollectionIds(new Set(memData.collections.map((c) => c.id)));
    }
  }, [memData]);

  // Show error toast when fetch fails
  useEffect(() => {
    if (colError) toast.error("Failed to load collections");
  }, [colError]);

  const allCollections = colData?.collections ?? [];
  const loading = open && (loadingCols || loadingMem);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleCollection = async (collectionId: string, isCurrentlyMember: boolean) => {
    setToggling((prev) => new Set(prev).add(collectionId));
    try {
      if (isCurrentlyMember) {
        // Remove from collection
        const res = await fetch(`/api/collections/${collectionId}/items`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: [itemId] }),
        });
        if (!res.ok) throw new Error();
        setMemberCollectionIds((prev) => {
          const next = new Set(prev);
          next.delete(collectionId);
          return next;
        });
        toast.success("Removed from collection");
      } else {
        // Add to collection
        const res = await fetch(`/api/collections/${collectionId}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemIds: [itemId] }),
        });
        if (!res.ok) throw new Error();
        setMemberCollectionIds((prev) => new Set(prev).add(collectionId));
        toast.success("Added to collection");
      }
    } catch {
      toast.error("Failed to update collection");
    } finally {
      setToggling((prev) => {
        const next = new Set(prev);
        next.delete(collectionId);
        return next;
      });
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2.5 rounded-xl border border-border hover:border-nexus-500/30 text-muted-foreground hover:text-nexus-400 transition-all"
        title="Manage collections"
      >
        📁
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 glass-card rounded-2xl overflow-hidden shadow-xl border border-border/50">
          <div className="p-3 border-b border-border/50">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collections
            </p>
          </div>
          <div className="max-h-64 overflow-y-auto p-1.5">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-9 skeleton rounded-lg" />
                ))}
              </div>
            ) : allCollections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">No collections yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  Create collections from the Collections page
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {allCollections.map((col) => {
                  const isMember = memberCollectionIds.has(col.id);
                  const isToggling = toggling.has(col.id);
                  return (
                    <button
                      key={col.id}
                      onClick={() => toggleCollection(col.id, isMember)}
                      disabled={isToggling}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-50 ${
                        isMember
                          ? "bg-nexus-500/10 text-foreground"
                          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                          isMember ? "border-nexus-500 bg-nexus-500" : "border-muted-foreground/30"
                        }`}
                      >
                        {isMember && <span className="text-white text-[10px]">✓</span>}
                      </div>
                      {/* Icon */}
                      <span>{col.icon}</span>
                      {/* Name */}
                      <span className="flex-1 text-left truncate">{col.name}</span>
                      {/* Loading spinner */}
                      {isToggling && (
                        <span className="w-4 h-4 border-2 border-nexus-500/30 border-t-nexus-500 rounded-full animate-spin" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="p-2 border-t border-border/50 text-center">
            <a
              href="/collections"
              className="text-xs text-nexus-400 hover:text-nexus-300 transition-colors"
            >
              Manage collections →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
