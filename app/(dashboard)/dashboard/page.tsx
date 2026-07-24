"use client";

import Link from "next/link";
import { formatDateRelative } from "@/lib/utils";
import { DashboardStatsSchema } from "@/lib/schemas";
import { useApiData } from "@/lib/hooks/use-api-data";
import type { z } from "zod";

type DashboardStats = z.output<typeof DashboardStatsSchema>;

const TYPE_ICONS: Record<string, string> = {
  link: "🔗",
  note: "📝",
  file: "📄",
  image: "🖼",
  screenshot: "📸",
  voice_memo: "🎤",
  pdf: "📕",
  video: "🎬",
};

const TYPE_LABELS: Record<string, string> = {
  link: "Links",
  note: "Notes",
  file: "Files",
  image: "Images",
  screenshot: "Screenshots",
  voice_memo: "Voice Memos",
  pdf: "PDFs",
  video: "Videos",
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

const ACTION_ICONS: Record<string, string> = {
  create: "➕",
  ai_process: "✦",
  search: "⌕",
  ai_backfill: "🔄",
  delete: "🗑",
};

const CATEGORY_COLORS = [
  "from-blue-500 to-cyan-500",
  "from-purple-500 to-pink-500",
  "from-emerald-500 to-teal-500",
  "from-orange-500 to-amber-500",
  "from-red-500 to-rose-500",
  "from-nexus-500 to-indigo-500",
];

export default function DashboardPage() {
  const {
    data: stats,
    loading,
    error,
  } = useApiData<DashboardStats>("/api/dashboard", DashboardStatsSchema);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-64 skeleton rounded-lg" />
        <div className="h-5 w-96 skeleton rounded" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 skeleton rounded-2xl" />
          <div className="space-y-4">
            <div className="h-44 skeleton rounded-2xl" />
            <div className="h-36 skeleton rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="text-center py-20">
        <div className="text-5xl mb-6">⚠️</div>
        <h2 className="text-xl font-semibold mb-2">Could not load dashboard</h2>
        <p className="text-muted-foreground mb-8">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all hover:shadow-lg hover:shadow-nexus-500/25"
        >
          Try again
        </button>
      </div>
    );
  }

  const hasItems = stats && stats.totalItems > 0;
  const maxCategoryCount = stats?.topCategories.length
    ? Math.max(...stats.topCategories.map((c) => c.count), 1)
    : 1;

  return (
    <div className="space-y-8">
      {/* ── Welcome Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Your Knowledge OS</h1>
          <p className="text-muted-foreground mt-1">
            {hasItems
              ? `You have ${stats!.totalItems} saved item${stats!.totalItems !== 1 ? "s" : ""} across ${stats!.topCategories.length} categories.`
              : "Welcome to NEXUS. Your knowledge, intelligently organized."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/items/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-nexus-500/25"
          >
            <span>+</span>
            Save Item
          </Link>
          <Link
            href="/search"
            className="flex items-center gap-2 px-4 py-2.5 glass-card hover:bg-card/70 rounded-xl text-sm transition-all"
          >
            <span>⌕</span>
            Search
          </Link>
        </div>
      </div>

      {/* ── Stats Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/items"
          className="glass-card p-6 rounded-2xl hover:border-nexus-500/30 transition-all duration-300 group hover-lift"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-nexus-500/20 to-indigo-500/20 flex items-center justify-center text-xl">
              ⊞
            </div>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full group-hover:bg-nexus-500/10 group-hover:text-nexus-400 transition-all">
              {hasItems ? "View all →" : "Total"}
            </span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats?.totalItems || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">Saved Items</p>
        </Link>

        <Link
          href="/collections"
          className="glass-card p-6 rounded-2xl hover:border-nexus-500/30 transition-all duration-300 group hover-lift"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-xl">
              ▦
            </div>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
              Collections
            </span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats?.totalCollections || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">Smart Folders</p>
        </Link>

        <div className="glass-card p-6 rounded-2xl hover:border-nexus-500/30 transition-all duration-300 hover-lift">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-xl">
              ⬡
            </div>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
              Connections
            </span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats?.totalConnections || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">AI Discovered</p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Items (2/3) */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-500/20 to-indigo-500/20 flex items-center justify-center text-sm">
                ⊞
              </div>
              <h2 className="font-semibold">{hasItems ? "Recent Items" : "Getting Started"}</h2>
            </div>
            {hasItems && (
              <Link
                href="/items"
                className="text-sm text-nexus-400 hover:text-nexus-300 transition-colors"
              >
                View all →
              </Link>
            )}
          </div>

          {!hasItems ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">⟠</div>
              <p className="text-muted-foreground mb-2">Your knowledge base is empty</p>
              <p className="text-sm text-muted-foreground/60 mb-6">
                Save your first item to get started
              </p>
              <Link
                href="/items/new"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all text-sm"
              >
                <span>+</span>
                Save your first item
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {stats!.recentItems.slice(0, 8).map((item, i) => {
                const gradient = TYPE_GRADIENTS[item.type] || "from-nexus-500/20 to-indigo-500/20";
                return (
                  <Link
                    key={item.id}
                    href={`/items/${item.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all group stagger-item"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shrink-0`}
                    >
                      {TYPE_ICONS[item.type] || "📄"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate group-hover:text-nexus-400 transition-colors">
                          {item.title}
                        </p>
                        {item.category && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexus-500/10 text-nexus-400 shrink-0">
                            {item.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDateRelative(item.createdAt)}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                      →
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Activity Feed */}
          {stats?.recentActivity && stats.recentActivity.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-sm">
                  ⚡
                </div>
                <h2 className="font-semibold">Recent Activity</h2>
              </div>
              <div className="space-y-1">
                {stats.recentActivity.slice(0, 6).map((entry, i) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-all stagger-item"
                  >
                    <span className="text-xs mt-0.5 w-5 text-center">
                      {ACTION_ICONS[entry.action] || "·"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {entry.action === "ai_process"
                          ? "AI processed"
                          : entry.action === "create"
                            ? "Created"
                            : entry.action === "delete"
                              ? "Deleted"
                              : entry.action === "ai_backfill"
                                ? "Backfilled"
                                : entry.action}
                        {entry.entityType === "item" ? " item" : ` ${entry.entityType}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {formatDateRelative(entry.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Items by Type */}
          {stats?.itemsByType && stats.itemsByType.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-500/20 to-indigo-500/20 flex items-center justify-center text-sm">
                  ⊞
                </div>
                <h2 className="font-semibold">Items by Type</h2>
              </div>
              <div className="grid gap-2">
                {stats.itemsByType.map(({ type, count }) => {
                  const maxCount = Math.max(...stats.itemsByType.map((t) => t.count), 1);
                  const pct = (count / maxCount) * 100;
                  const gradient = TYPE_GRADIENTS[type] || "from-nexus-500/20 to-indigo-500/20";
                  const icon = TYPE_ICONS[type] || "📄";
                  const label = TYPE_LABELS[type] || type;
                  return (
                    <div key={type} className="group">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span className="text-xs">{icon}</span>
                          <span className="group-hover:text-nexus-400 transition-colors">
                            {label}
                          </span>
                        </span>
                        <span className="text-muted-foreground text-xs font-mono">{count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${gradient} transition-all duration-700`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Categories */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center text-sm">
                📊
              </div>
              <h2 className="font-semibold">Categories</h2>
            </div>
            {!hasItems || !stats?.topCategories.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Categories will auto-populate as you save items.
              </p>
            ) : (
              <div className="space-y-3">
                {stats.topCategories.slice(0, 5).map((cat, i) => {
                  const pct = (cat.count / maxCategoryCount) * 100;
                  const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                  return (
                    <Link
                      key={cat.category}
                      href={`/search?q=${encodeURIComponent(cat.category)}&mode=semantic`}
                      className="block group"
                    >
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="group-hover:text-nexus-400 transition-colors">
                          {cat.category}
                        </span>
                        <span className="text-muted-foreground text-xs">{cat.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-700 group-hover:opacity-80`}
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Tips */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-sm">
                💡
              </div>
              <h2 className="font-semibold">Quick Tips</h2>
            </div>
            <ul className="space-y-3">
              {[
                { shortcut: "⌘K", text: "Quick search anything" },
                { shortcut: "⌘⇧S", text: "Save from anywhere" },
                { shortcut: "A I", text: "Auto-tags & summaries" },
              ].map((tip, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-all stagger-item"
                >
                  <span className="text-xs font-mono text-nexus-400 bg-nexus-500/10 px-2 py-1 rounded font-bold">
                    {tip.shortcut}
                  </span>
                  <span className="text-xs text-muted-foreground">{tip.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
