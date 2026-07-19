"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

function SearchContent() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<"semantic" | "fulltext">("semantic");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Searching:", query, "mode:", searchMode);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Search</h1>
        <p className="text-muted-foreground mt-1">
          Search across your entire knowledge base
        </p>
      </div>

      {/* Search Input */}
      <form onSubmit={handleSearch}>
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg text-muted-foreground">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search "find my notes about climate change"...'
            className="w-full pl-12 pr-4 py-4 bg-muted border border-border rounded-2xl text-lg focus:outline-none focus:ring-2 focus:ring-nexus-500/30 focus:border-nexus-500/50 transition-all"
            autoFocus
          />
        </div>
      </form>

      {/* Search Mode Toggle */}
      <div className="flex items-center gap-2 p-1 glass-card rounded-lg w-fit">
        <button
          onClick={() => setSearchMode("semantic")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm transition-all",
            searchMode === "semantic" ? "bg-nexus-500/20 text-nexus-400 font-medium" : "text-muted-foreground"
          )}
        >
          🧠 Semantic Search
        </button>
        <button
          onClick={() => setSearchMode("fulltext")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm transition-all",
            searchMode === "fulltext" ? "bg-nexus-500/20 text-nexus-400 font-medium" : "text-muted-foreground"
          )}
        >
          📖 Full Text
        </button>
      </div>

      {/* Empty State */}
      {!query && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">⌕</div>
          <h2 className="text-xl font-semibold mb-2">Ask anything about your knowledge</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            NEXUS understands natural language. Try "what did I save about neural networks last month?"
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 max-w-lg mx-auto">
            {[
              "AI and machine learning articles",
              "Notes from last week",
              "Design systems resources",
              "Everything about React",
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => setQuery(suggestion)}
                className="p-3 glass-card hover:bg-card/70 rounded-xl text-sm text-left transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results placeholder */}
      {query && (
        <div className="text-center py-12 glass-card rounded-2xl">
          <p className="text-muted-foreground">
            Search results will appear here once you save items.
          </p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="space-y-6">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="h-16 skeleton rounded-2xl" />
      </div>
    }>
      <SearchContent />
    </Suspense>
  );
}
