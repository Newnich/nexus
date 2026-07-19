"use client";

import { useState } from "react";
import Link from "next/link";

const ITEM_TYPES = ["all", "link", "note", "pdf", "image", "file", "video", "voice_memo"] as const;

export default function ItemsPage() {
  const [selectedType, setSelectedType] = useState<string>("all");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Items</h1>
          <p className="text-muted-foreground mt-1">All your saved knowledge</p>
        </div>
        <Link
          href="/items/new"
          className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg transition-all text-sm"
        >
          <span>+</span>
          Save Item
        </Link>
      </div>

      {/* Filters */}
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
            {type === "all" ? "All Items" : type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Empty State */}
      <div className="text-center py-20">
        <div className="text-6xl mb-6">⟠</div>
        <h2 className="text-xl font-semibold mb-2">No items yet</h2>
        <p className="text-muted-foreground mb-8 max-w-md mx-auto">
          Start building your knowledge base. Save your first link, note, or file.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/items/new"
            className="flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
          >
            <span>+</span>
            Save your first item
          </Link>
          <button className="px-6 py-3 glass-card hover:bg-card/70 rounded-xl transition-all text-sm">
            Import bookmarks
          </button>
        </div>
      </div>
    </div>
  );
}
