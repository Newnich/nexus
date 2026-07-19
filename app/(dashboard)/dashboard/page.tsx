"use client";

import { useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

// Mock data for the dashboard
const MOCK_STATS = {
  totalItems: 0,
  totalCollections: 0,
  totalConnections: 0,
  recentItems: [] as Array<{ id: string; title: string; type: string; createdAt: string }>,
  topCategories: [] as Array<{ category: string; count: number }>,
};

type ViewMode = "grid" | "list";

export default function DashboardPage() {
  const [stats] = useState(MOCK_STATS);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Your Knowledge OS</h1>
          <p className="text-muted-foreground mt-1">
            Welcome to NEXUS. Your knowledge, intelligently organized.
          </p>
        </div>
        <div className="flex items-center gap-2 glass-card p-1 rounded-lg">
          <button
            onClick={() => setViewMode("grid")}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === "grid" ? "bg-nexus-500/20 text-nexus-400" : "text-muted-foreground"
            }`}
          >
            ⊞ Grid
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`px-3 py-1.5 rounded-md text-sm transition-all ${
              viewMode === "list" ? "bg-nexus-500/20 text-nexus-400" : "text-muted-foreground"
            }`}
          >
            ☰ List
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-6 hover:border-nexus-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⊞</span>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">Total</span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats.totalItems}</p>
          <p className="text-sm text-muted-foreground mt-1">Saved Items</p>
        </div>

        <div className="glass-card p-6 hover:border-nexus-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">▦</span>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">Collections</span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats.totalCollections}</p>
          <p className="text-sm text-muted-foreground mt-1">Smart Folders</p>
        </div>

        <div className="glass-card p-6 hover:border-nexus-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⬡</span>
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-full">Connections</span>
          </div>
          <p className="text-3xl font-bold gradient-text">{stats.totalConnections}</p>
          <p className="text-sm text-muted-foreground mt-1">AI Discovered</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Recent Activity</h2>
            <Link
              href="/items"
              className="text-sm text-nexus-400 hover:text-nexus-300 transition-colors"
            >
              View all →
            </Link>
          </div>

          {stats.recentItems.length === 0 ? (
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
            <div className="space-y-3">
              {stats.recentItems.slice(0, 10).map((item) => (
                <Link
                  key={item.id}
                  href={`/items/${item.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-lg">{getTypeIcon(item.type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(item.createdAt)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-4">
          {/* Daily Digest */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-3">🧠 Daily Digest</h2>
            <p className="text-sm text-muted-foreground">
              Your AI daily digest will appear here after you save some items.
              NEXUS will surface connections, suggest collections, and highlight
              patterns in your knowledge.
            </p>
          </div>

          {/* Top Categories */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-3">📊 Categories</h2>
            {stats.topCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Categories will auto-populate as you save items.
              </p>
            ) : (
              <div className="space-y-2">
                {stats.topCategories.map((cat) => (
                  <div key={cat.category} className="flex items-center justify-between text-sm">
                    <span>{cat.category}</span>
                    <span className="text-muted-foreground">{cat.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Tips */}
          <div className="glass-card p-6">
            <h2 className="font-semibold mb-3">💡 Quick Tips</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-nexus-400 mt-0.5">⌘K</span>
                <span>Quick search anything</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nexus-400 mt-0.5">⌘⇧S</span>
                <span>Save from anywhere</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-nexus-400 mt-0.5">AI</span>
                <span>Auto-tags & summaries</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    link: "🔗",
    note: "📝",
    file: "📄",
    image: "🖼",
    screenshot: "📸",
    voice_memo: "🎤",
    pdf: "📕",
    video: "🎬",
  };
  return icons[type] || "📄";
}
