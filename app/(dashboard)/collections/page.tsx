"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type CollectionType = "all" | "manual" | "auto" | "query";

const SAMPLE_COLLECTION_TYPES = [
  { type: "all" as CollectionType, label: "All Collections", icon: "▦" },
  { type: "manual" as CollectionType, label: "Manual", icon: "📁" },
  { type: "auto" as CollectionType, label: "AI Auto", icon: "🤖" },
  { type: "query" as CollectionType, label: "Smart Queries", icon: "🔍" },
];

export default function CollectionsPage() {
  const [selectedFilter, setSelectedFilter] = useState<CollectionType>("all");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Collections</h1>
          <p className="text-muted-foreground mt-1">
            Smart folders that organize your knowledge
          </p>
        </div>
        <Link
          href="/items/new"
          className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
        >
          <span>+</span>
          New Collection
        </Link>
      </div>

      {/* Type Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {SAMPLE_COLLECTION_TYPES.map(({ type, label, icon }) => (
          <button
            key={type}
            onClick={() => setSelectedFilter(type)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all",
              selectedFilter === type
                ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
            )}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Collection Types Explanation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Manual Collections */}
        <div className="glass-card p-6 rounded-xl">
          <div className="text-3xl mb-3">📁</div>
          <h3 className="font-semibold mb-2">Manual Collections</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Classic folders. Drag and drop items to organize them your way.
            Nest collections for deep categorization.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded-full">Coming soon</span>
          </div>
        </div>

        {/* AI Auto Collections */}
        <div className="glass-card p-6 rounded-xl">
          <div className="text-3xl mb-3">🤖</div>
          <h3 className="font-semibold mb-2">AI Auto-Collections</h3>
          <p className="text-sm text-muted-foreground mb-4">
            AI-maintained collections that automatically update as you save
            new items matching their rules.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-nexus-500/20 text-nexus-400 rounded-full">AI Powered</span>
          </div>
        </div>

        {/* Query Collections */}
        <div className="glass-card p-6 rounded-xl">
          <div className="text-3xl mb-3">🔍</div>
          <h3 className="font-semibold mb-2">Query Collections</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Saved searches that live-update. "All PDFs about AI from 2024"
            becomes a living collection.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-muted rounded-full">Natural language</span>
          </div>
        </div>
      </div>

      {/* Empty State */}
      <div className="text-center py-16 glass-card rounded-2xl">
        <div className="text-5xl mb-4">▦</div>
        <h2 className="text-xl font-semibold mb-2">No collections yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          Collections help you organize related items. Create your first one
          after saving some items — or let AI create them automatically.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            disabled
            className="px-6 py-3 bg-nexus-500/50 text-white rounded-xl cursor-not-allowed opacity-60"
          >
            + Create Collection
          </button>
          <Link
            href="/items/new"
            className="px-6 py-3 glass-card hover:bg-card/70 rounded-xl transition-all text-sm"
          >
            Save items first →
          </Link>
        </div>
      </div>
    </div>
  );
}
