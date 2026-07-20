"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDate, formatDateRelative } from "@/lib/utils";

interface DashboardStats {
  totalItems: number;
  totalCollections: number;
  totalConnections: number;
  recentItems: Array<{
    id: string;
    title: string;
    type: string;
    createdAt: string;
    category: string | null;
  }>;
  topCategories: Array<{ category: string; count: number }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: Record<string, unknown>;
    createdAt: string;
  }>;
}

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

const ACTION_LABELS: Record<string, string> = {
  create: "Created",
  ai_process: "AI processed",
  search: "Searched",
  ai_backfill: "Backfilled",
  delete: "Deleted",
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    async function fetchDashboard() {
      try {
        const res = await fetch("/api/dashboard");
        if (!res.ok) {
          if (res.status === 401) throw new Error("Please sign in to view your dashboard");
          throw new Error("Failed to load dashboard");
        }
        const data = await res.json();
        setStats(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchDashboard();
  }, []);

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
            <div className="h-40 skeleton rounded-2xl" />
            <div className="h-32 skeleton rounded-2xl" />
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
          className="px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
        >
          Try again
        </button>
      </div>
    );
  }

  const hasItems = stats && stats.totalItems > 0;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Your Knowledge OS</h1>
          <p className="text-muted-foreground mt-1">
            {hasItems
              ? `You have ${stats!.totalItems} saved item${stats!.totalItems !== 1 ? "s" : ""} across ${stats!.topCategories.length} categories.`
              : "Welcome to NEXUS. Your knowledge, intelligently organized."}
          </p>
        </div>
        <Link
          href="/search"
          className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-card/70 rounded-lg text-sm transition-all"
        >
          <span>⌕</span>
          Search your knowledge
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/items"
          className="glass-card p-6 hover:border-nexus-500/30 transition-all duration-300 group block"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⊞</span>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full group-hover:bg-nexus-500/10 group-hover:text-nexus-400 transition-all">
              {hasItems ? "View all →" : "Total"}
            </span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats?.totalItems || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">Saved Items</p>
        </Link>

        <Link
          href="/collections"
          className="glass-card p-6 hover:border-nexus-500/30 transition-all duration-300 group block"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">▦</span>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">
              Collections
            </span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats?.totalCollections || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">Smart Folders</p>
        </Link>

        <div className="glass-card p-6 hover:border-nexus-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⬡</span>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">Connections</span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats?.totalConnections || 0}</p>
          <p className="text-sm text-muted-foreground mt-1">AI Discovered</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Items */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">
              {hasItems ? "Recent Items" : "Getting Started"}
            </h2>
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
              <div className="text-4xl mb-4">⟠</div>
              <p className="text-muted-foreground mb-2">Your knowledge base is empty</p>
              <p className="text-sm text-muted-foreground/60 mb-6">
                Save your first item to get started
              </p>
              <Link
                href="/items/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
              >
                <span>+</span>
                Save your first item
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {stats!.recentItems.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-all group"
                >
                  <span className="text-lg w-8 text-center shrink-0">
                    {TYPE_ICONS[item.type] || "📄"}
                  </span>
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
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Activity Feed */}
          {stats?.recentActivity && stats.recentActivity.length > 0 && (
            <div className="glass-card p-6">
              <h2 className="font-semibold mb-3">⚡ Recent Activity</h2>
              <div className="space-y-3">
                {stats.recentActivity.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-2 text-sm">
                    <span className="text-xs mt-0.5 text-muted-foreground">
                      {entry.action === "ai_process" ? "✦" : entry.action === "create" ? "+" : "·"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">
                        {ACTION_LABELS[entry.action] || entry.action}
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

          {/* Top Categories */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-3">📊 Categories</h2>
            {!hasItems || !stats?.topCategories.length ? (
              <p className="text-sm text-muted-foreground">
                Categories will auto-populate as you save items.
              </p>
            ) : (
              <div className="space-y-3">
                {stats!.topCategories.map((cat) => (
                  <Link
                    key={cat.category}
                    href={`/search?q=${encodeURIComponent(cat.category)}&mode=semantic`}
                    className="flex items-center justify-between text-sm group p-2 rounded-lg hover:bg-muted/50 transition-all"
                  >
                    <span className="group-hover:text-nexus-400 transition-colors">{cat.category}</span>
                    <span className="text-muted-foreground text-xs bg-muted px-2 py-0.5 rounded-full">
                      {cat.count}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick Tips */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-3">💡 Quick Tips</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-nexus-400 mt-0.5 font-mono text-xs bg-nexus-500/10 px-1.5 py-0.5 rounded">⌘K</span>
                <span>Quick search anything</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nexus-400 mt-0.5 font-mono text-xs bg-nexus-500/10 px-1.5 py-0.5 rounded">⌘⇧S</span>
                <span>Save from anywhere</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nexus-400 mt-0.5 font-mono text-xs bg-nexus-500/10 px-1.5 py-0.5 rounded">AI</span>
                <span>Auto-tags & summaries</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
