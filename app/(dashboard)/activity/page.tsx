"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { formatDateRelative, cn, validatedFetcher } from "@/lib/utils";
import { ActivitySkeleton } from "@/components/activity-skeleton";
import { ActivityResponseSchema } from "@/lib/schemas";
import type { z } from "zod";

type ActivityEntry = z.infer<typeof ActivityResponseSchema>["entries"][number];

const ACTION_CONFIG: Record<string, { icon: string; label: string; gradient: string }> = {
  create: { icon: "➕", label: "Created", gradient: "from-emerald-500/20 to-green-500/20" },
  delete: { icon: "🗑", label: "Deleted", gradient: "from-red-500/20 to-rose-500/20" },
  ai_process: { icon: "✦", label: "AI Processed", gradient: "from-purple-500/20 to-pink-500/20" },
  search: { icon: "⌕", label: "Searched", gradient: "from-blue-500/20 to-indigo-500/20" },
  ai_backfill: { icon: "🔄", label: "Backfilled", gradient: "from-amber-500/20 to-orange-500/20" },
  archive: { icon: "🗃", label: "Archived", gradient: "from-amber-500/20 to-yellow-500/20" },
  restore: { icon: "📦", label: "Restored", gradient: "from-teal-500/20 to-cyan-500/20" },
};

const ACTION_FILTERS = [
  { value: "", label: "All Activity" },
  { value: "create", label: "➕ Created" },
  { value: "delete", label: "🗑 Deleted" },
  { value: "ai_process", label: "✦ AI Processed" },
  { value: "search", label: "⌕ Searches" },
  { value: "archive", label: "🗃 Archived" },
  { value: "restore", label: "📦 Restored" },
  { value: "ai_backfill", label: "🔄 Backfills" },
];

const ENTITY_FILTERS = [
  { value: "", label: "All Types" },
  { value: "item", label: "Items" },
  { value: "collection", label: "Collections" },
  { value: "note", label: "Notes" },
];

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 30;

  const fetchActivity = useCallback(
    async (action: string, entity: string, pageNum: number, append: boolean = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(pageNum * PAGE_SIZE),
        });
        if (action) params.set("action", action);
        if (entity) params.set("entityType", entity);

        const data = await validatedFetcher(`/api/activity?${params}`, ActivityResponseSchema);

        const activityEntries = data.entries ?? [];
        const activityCount = data.count ?? 0;

        if (append) {
          setEntries((prev) => [...prev, ...activityEntries]);
        } else {
          setEntries(activityEntries);
        }
        setCount(activityCount);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
        if (!append) setEntries([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    setPage(0);
    fetchActivity(actionFilter, entityFilter, 0);
  }, [actionFilter, entityFilter, fetchActivity]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivity(actionFilter, entityFilter, nextPage, true);
  };

  const hasMore = entries.length < count;

  // Group entries by date
  const grouped = entries.reduce<Record<string, ActivityEntry[]>>((acc, entry) => {
    const date = new Date(entry.created_at).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(entry);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Activity</h1>
          <p className="text-muted-foreground mt-1">
            {loading ? "Loading activity..." : `${count} event${count !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm hover:shadow-lg hover:shadow-nexus-500/25"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* ── Filters ── */}
      <div className="flex items-center gap-2 flex-wrap">
        {ACTION_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setActionFilter(f.value);
              setPage(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-all",
              actionFilter === f.value
                ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                : "glass-card text-muted-foreground hover:text-foreground border border-transparent",
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="w-px h-6 bg-border mx-1" />
        {ENTITY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setEntityFilter(f.value);
              setPage(0);
            }}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-all",
              entityFilter === f.value
                ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                : "glass-card text-muted-foreground hover:text-foreground border border-transparent",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Loading ── */}
      {loading && <ActivitySkeleton count={5} />}

      {/* ── Error ── */}
      {error && !loading && (
        <div className="text-center py-16 glass-card rounded-2xl border-red-500/20">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load activity</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => fetchActivity(actionFilter, entityFilter, 0)}
            className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
          >
            Try again
          </button>
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && !error && entries.length === 0 && (
        <div className="text-center py-16 glass-card rounded-2xl">
          <div className="text-5xl mb-6">⚡</div>
          <h2 className="text-xl font-semibold mb-2">No activity yet</h2>
          <p className="text-muted-foreground mb-4 max-w-md mx-auto">
            Activity is logged when you create, delete, or search items. Here&apos;s how to get
            started:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-lg mx-auto mb-8">
            <Link
              href="/items/new"
              className="p-4 glass-card hover:bg-card/70 rounded-xl text-sm text-left transition-all hover-lift"
            >
              <div className="text-2xl mb-2">➕</div>
              <p className="font-medium mb-1">Save an Item</p>
              <p className="text-xs text-muted-foreground">Links, notes, files, and more</p>
            </Link>
            <Link
              href="/search"
              className="p-4 glass-card hover:bg-card/70 rounded-xl text-sm text-left transition-all hover-lift"
            >
              <div className="text-2xl mb-2">⌕</div>
              <p className="font-medium mb-1">Search</p>
              <p className="text-xs text-muted-foreground">Find anything in your knowledge</p>
            </Link>
            <Link
              href="/dashboard"
              className="p-4 glass-card hover:bg-card/70 rounded-xl text-sm text-left transition-all hover-lift"
            >
              <div className="text-2xl mb-2">◈</div>
              <p className="font-medium mb-1">Dashboard</p>
              <p className="text-xs text-muted-foreground">See your stats at a glance</p>
            </Link>
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      {!loading && !error && entries.length > 0 && (
        <div className="space-y-8">
          {Object.entries(grouped).map(([date, dayEntries]) => (
            <div key={date}>
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border/50" />
                <span className="text-xs font-medium text-muted-foreground px-2">
                  {new Date(dayEntries[0].created_at).toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>

              <div className="space-y-2">
                {dayEntries.map((entry, i) => {
                  const config = ACTION_CONFIG[entry.action] || {
                    icon: "·",
                    label: entry.action,
                    gradient: "from-slate-500/20 to-zinc-500/20",
                  };
                  const isLast = i === dayEntries.length - 1;

                  return (
                    <div
                      key={entry.id}
                      className="relative flex items-start gap-4 p-4 glass-card rounded-2xl hover:bg-card/80 transition-all group stagger-item"
                    >
                      {/* Timeline dot + line */}
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-base`}
                        >
                          {config.icon}
                        </div>
                        {!isLast && <div className="w-px flex-1 min-h-[8px] bg-border/30 mt-1" />}
                      </div>

                      <div className="flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{config.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {entry.entity_type === "item" ? "item" : entry.entity_type}
                          </span>
                        </div>
                        {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {JSON.stringify(entry.metadata).slice(0, 120)}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {formatDateRelative(entry.created_at)}
                        </p>
                      </div>

                      {entry.entity_id && (
                        <Link
                          href={`/items/${entry.entity_id}`}
                          className="shrink-0 px-3 py-1.5 glass-card hover:bg-card/70 rounded-lg text-xs transition-all opacity-0 group-hover:opacity-100"
                        >
                          View →
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="text-center pt-4">
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
                  `Show more (${entries.length} of ${count})`
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
