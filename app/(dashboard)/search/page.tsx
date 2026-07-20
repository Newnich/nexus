"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Item } from "@/types/item";

interface SearchResult extends Item {
  relevanceScore?: number;
}

function ResultCard({ item }: { item: SearchResult }) {
  const typeIcons: Record<string, string> = {
    link: "🔗",
    note: "📝",
    file: "📄",
    image: "🖼",
    screenshot: "📸",
    voice_memo: "🎤",
    pdf: "📕",
    video: "🎬",
  };

  return (
    <a
      href={`/items/${item.id}`}
      className="block p-5 glass-card hover:bg-card/80 rounded-2xl transition-all group"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">{typeIcons[item.type] || "📌"}</span>
            <span className="text-xs font-medium text-nexus-400 bg-nexus-500/10 px-2 py-0.5 rounded-full uppercase">
              {item.type}
            </span>
            {item.visibility && item.visibility !== "private" && (
              <span className="text-xs text-muted-foreground">
                {item.visibility === "public" ? "🌍" : "👥"} {item.visibility}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold truncate group-hover:text-nexus-400 transition-colors">
            {item.title || "Untitled"}
          </h3>
          {item.aiData?.summary && (
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
              {item.aiData.summary}
            </p>
          )}
          {item.aiData?.tags && item.aiData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {item.aiData.tags.slice(0, 5).map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {(item.relevanceScore !== undefined && item.relevanceScore > 0) && (
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-muted-foreground">Relevance</div>
            <div className="text-sm font-semibold text-nexus-400">
              {Math.round(item.relevanceScore * 100)}%
            </div>
          </div>
        )}
      </div>
      {item.metadata?.domain && (
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
          {item.metadata.favicon && (
            <img src={item.metadata.favicon} alt="" className="w-4 h-4 rounded" />
          )}
          <span>{item.metadata.domain}</span>
          <span>·</span>
          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
        </div>
      )}
    </a>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<"semantic" | "fulltext">(
    (searchParams.get("mode") as "semantic" | "fulltext") || "semantic"
  );
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const performSearch = useCallback(async (q: string, mode: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&mode=${mode}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Search failed");
      }
      const data = await res.json();
      setResults(data.items || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search on mount if initial query exists from URL params
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, searchMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run search when mode changes and there's an active query
  useEffect(() => {
    if (query.trim() && searched) {
      performSearch(query, searchMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Update URL with query param
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("mode", searchMode);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    performSearch(query, searchMode);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    const params = new URLSearchParams();
    params.set("q", suggestion);
    params.set("mode", searchMode);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    performSearch(suggestion, searchMode);
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

      {/* Empty State - No Query */}
      {!query && !searched && (
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
                onClick={() => handleSuggestionClick(suggestion)}
                className="p-3 glass-card hover:bg-card/70 rounded-xl text-sm text-left transition-all"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-5 glass-card rounded-2xl">
              <div className="skeleton h-4 w-16 rounded mb-3" />
              <div className="skeleton h-6 w-3/4 rounded mb-2" />
              <div className="skeleton h-4 w-full rounded mb-1" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12 glass-card rounded-2xl border-red-500/20">
          <div className="text-3xl mb-3">⚠️</div>
          <h3 className="text-lg font-semibold text-red-400 mb-1">Search Error</h3>
          <p className="text-muted-foreground">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && !error && searched && results.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Found {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>
          <div className="space-y-3">
            {results.map((item) => (
              <ResultCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* No Results */}
      {!loading && !error && searched && results.length === 0 && (
        <div className="text-center py-16 glass-card rounded-2xl">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold mb-1">No results found</h3>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Try a different search term or switch to{" "}
            <button
              onClick={() => {
                setSearchMode("fulltext");
                performSearch(query, "fulltext");
              }}
              className="text-nexus-400 hover:underline"
            >
              Full Text search
            </button>
            .
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
