"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { renderHighlighted } from "@/lib/render-highlighted";
import toast from "react-hot-toast";
import type { Item } from "@/types/item";
import { useSavedSearches } from "@/lib/hooks/use-saved-searches";
import { ItemPreview } from "@/components/item-preview";
import { QuickViewModal } from "@/components/quick-view-modal";

interface SearchResult extends Item {
  relevanceScore?: number;
}

const ITEM_TYPES = ["all", "link", "note", "pdf", "image", "screenshot", "file", "video", "voice_memo"] as const;
const ITEM_TYPE_ICONS: Record<string, string> = {
  all: "⊞", link: "🔗", note: "📝", file: "📄", image: "🖼",
  screenshot: "📸", voice_memo: "🎤", pdf: "📕", video: "🎬",
};

const DATE_RANGES = [
  { label: "All time", value: "all" },
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
  { label: "This year", value: "year" },
] as const;

function ResultCard({ item, query, onQuickView }: { item: SearchResult; query: string; onQuickView?: (id: string) => void }) {
  const typeIcons: Record<string, string> = {
    link: "🔗", note: "📝", file: "📄", image: "🖼",
    screenshot: "📸", voice_memo: "🎤", pdf: "📕", video: "🎬",
  };

  return (
    <ItemPreview itemId={item.id}>
      <div className="relative group/card">
        <a
          href={`/items/${item.id}`}
          className="block p-5 glass-card hover:bg-card/80 rounded-2xl transition-all hover-lift"
        >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-lg">{typeIcons[item.type] || "📌"}</span>
            <span className="text-xs font-medium text-nexus-400 bg-nexus-500/10 px-2 py-0.5 rounded-full uppercase">
              {item.type}
            </span>
            {item.aiData?.category && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {item.aiData.category}
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold truncate group-hover:text-nexus-400 transition-colors">
            {renderHighlighted(item.title || "Untitled", query)}
          </h3>
          {item.aiData?.summary && (
            <p className="text-sm text-muted-foreground mt-1.5 line-clamp-3">
              {renderHighlighted(item.aiData.summary, query)}
            </p>
          )}
          {item.aiData?.tags && item.aiData.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {item.aiData.tags.slice(0, 5).map((tag) => {
                const isMatch = query.toLowerCase().split(/\s+/).some(
                  (q) => tag.toLowerCase().includes(q)
                );
                return (
                  <span
                    key={tag}
                    className={`text-xs px-2 py-0.5 rounded-full transition-all ${
                      isMatch ? "bg-nexus-500/20 text-nexus-400" : "bg-secondary text-secondary-foreground"
                    }`}
                  >
                    #{tag}
                  </span>
                );
              })}
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
    <button
      onClick={(e) => { e.preventDefault(); onQuickView?.(item.id); }}
      className="absolute top-3 right-3 px-2 py-1 rounded-lg glass-card hover:bg-card/70 text-[10px] transition-all opacity-0 group-hover/card:opacity-100"
      title="Quick view"
    >
      👁️
    </button>
    </div>
    </ItemPreview>
  );
}

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("q") || "";
  const initialType = searchParams.get("type") || "all";
  const initialRange = searchParams.get("range") || "all";

  const [query, setQuery] = useState(initialQuery);
  const [searchMode, setSearchMode] = useState<"semantic" | "fulltext">(
    (searchParams.get("mode") as "semantic" | "fulltext") || "semantic"
  );
  const [selectedType, setSelectedType] = useState(initialType);
  const [selectedRange, setSelectedRange] = useState(initialRange);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const { searches, addSearch, removeSearch } = useSavedSearches();

  const performSearch = useCallback(async (q: string, mode: string, typeFilter: string, rangeFilter: string) => {
    if (!q.trim()) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const params = new URLSearchParams({ q, mode });
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/search?${params}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Search failed");
      }
      const data = await res.json();

      // Client-side filtering (handles semantic mode + date range)
      let filtered = data.items || [];
      if (typeFilter !== "all") {
        filtered = filtered.filter((i: { type: string }) => i.type === typeFilter);
      }
      if (rangeFilter !== "all") {
        const now = Date.now();
        const ranges: Record<string, number> = {
          today: now - 86400000,
          "7d": now - 7 * 86400000,
          "30d": now - 30 * 86400000,
          "90d": now - 90 * 86400000,
          year: now - 365 * 86400000,
        };
        const cutoff = ranges[rangeFilter];
        if (cutoff) {
          filtered = filtered.filter(
            (item: { createdAt?: string; created_at?: string }) =>
              new Date(item.createdAt || item.created_at || "").getTime() > cutoff
          );
        }
      }

      setResults(filtered);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Run search on mount if initial query exists
  useEffect(() => {
    if (initialQuery) {
      performSearch(initialQuery, searchMode, initialType, initialRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run search when mode/type/range changes with active query
  useEffect(() => {
    if (query.trim() && searched) {
      performSearch(query, searchMode, selectedType, selectedRange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchMode, selectedType, selectedRange]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("mode", searchMode);
    if (selectedType !== "all") params.set("type", selectedType);
    if (selectedRange !== "all") params.set("range", selectedRange);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    performSearch(query, searchMode, selectedType, selectedRange);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    const params = new URLSearchParams();
    params.set("q", suggestion);
    params.set("mode", searchMode);
    router.replace(`/search?${params.toString()}`, { scroll: false });
    performSearch(suggestion, searchMode, selectedType, selectedRange);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Search</h1>
        <p className="text-muted-foreground mt-1">
          Search across your entire knowledge base
        </p>
      </div>

      {/* Saved Searches Bar */}
      {searches.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">Saved:</span>
          {searches.slice(0, 5).map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setQuery(s.query);
                setSearchMode(s.mode);
                setSelectedType(s.type || "all");
                setSelectedRange(s.range || "all");
                const params = new URLSearchParams();
                params.set("q", s.query);
                params.set("mode", s.mode);
                if (s.type) params.set("type", s.type);
                if (s.range) params.set("range", s.range);
                router.replace(`/search?${params.toString()}`, { scroll: false });
                performSearch(s.query, s.mode, s.type || "all", s.range || "all");
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-nexus-500/10 text-nexus-400 text-xs transition-all hover:bg-nexus-500/20"
            >
              <span>⌕</span>
              {s.label || s.query.length > 20 ? s.query.slice(0, 20) + "…" : s.query}
              <button
                onClick={(e) => { e.stopPropagation(); removeSearch(s.id); }}
                className="text-muted-foreground hover:text-foreground ml-0.5"
              >
                ✕
              </button>
            </button>
          ))}
          {searches.length > 5 && (
            <button
              onClick={() => setShowSaved(!showSaved)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              +{searches.length - 5} more
            </button>
          )}
        </div>
      )}

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

      {/* Filters Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search Mode Toggle */}
        <div className="flex items-center gap-1 p-0.5 glass-card rounded-lg">
          <button
            onClick={() => setSearchMode("semantic")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-all",
              searchMode === "semantic" ? "bg-nexus-500/20 text-nexus-400 font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            🧠 Semantic
          </button>
          <button
            onClick={() => setSearchMode("fulltext")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs transition-all",
              searchMode === "fulltext" ? "bg-nexus-500/20 text-nexus-400 font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            📖 Full Text
          </button>
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1 flex-wrap">
          {ITEM_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs transition-all flex items-center gap-1",
                selectedType === type
                  ? "bg-nexus-500/20 text-nexus-400 border border-nexus-500/30"
                  : "glass-card text-muted-foreground hover:text-foreground border border-transparent"
              )}
            >
              {type !== "all" && <span>{ITEM_TYPE_ICONS[type]}</span>}
              {type === "all" ? "All" : type.charAt(0).toUpperCase() + type.slice(1).replace("_", " ")}
            </button>
          ))}
        </div>

        {/* Date Range Filter */}
        <div className="flex items-center gap-1 p-0.5 glass-card rounded-lg">
          {DATE_RANGES.map((range) => (
            <button
              key={range.value}
              onClick={() => setSelectedRange(range.value)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-[10px] transition-all",
                selectedRange === range.value
                  ? "bg-nexus-500/20 text-nexus-400 font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State - No Query */}
      {!query && !searched && (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">⌕</div>
          <h2 className="text-xl font-semibold mb-2">Ask anything about your knowledge</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            NEXUS understands natural language. Try &ldquo;what did I save about neural networks last month?&rdquo;
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
                className="p-3 glass-card hover:bg-card/70 rounded-xl text-sm text-left transition-all hover-lift"
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
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Found {results.length} result{results.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
              {selectedType !== "all" && <span> in {selectedType}</span>}
              {selectedRange !== "all" && <span> from <strong>{DATE_RANGES.find((r) => r.value === selectedRange)?.label.toLowerCase()}</strong></span>}
            </p>
            <button
              onClick={() => {
                addSearch({
                  query: query,
                  mode: searchMode,
                  type: selectedType !== "all" ? selectedType : undefined,
                  range: selectedRange !== "all" ? selectedRange : undefined,
                  label: query.length > 24 ? query.slice(0, 24) + "…" : query,
                });
                toast.success("Search saved!");
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg glass-card hover:bg-card/70 text-xs transition-all"
              title="Save this search"
            >
              💾 Save
            </button>
          </div>
          <div className="space-y-3">
            {results.map((item) => (
              <ResultCard key={item.id} item={item} query={query} onQuickView={setQuickViewId} />
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
            Try a different search term, change the type filter, or switch to{" "}
            <button
              onClick={() => {
                setSearchMode("fulltext");
                performSearch(query, "fulltext", selectedType, selectedRange);
              }}
              className="text-nexus-400 hover:underline"
            >
              Full Text search
            </button>
            .
          </p>
        </div>
      )}

      {/* Quick View Modal */}
      {quickViewId && (
        <QuickViewModal
          itemId={quickViewId}
          onClose={() => setQuickViewId(null)}
        />
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
