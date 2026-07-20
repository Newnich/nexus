"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn, formatDate, formatDateRelative, extractDomain, ITEM_TYPE_CONFIG } from "@/lib/utils";
import type { Item } from "@/types/item";

interface Connection {
  id: string;
  from_item_id: string;
  to_item_id: string;
  type: string;
  strength: number;
  label?: string;
  description?: string;
  from_item?: { id: string; title: string; type: string };
  to_item?: { id: string; title: string; type: string };
}

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const [item, setItem] = useState<Item | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetchItem() {
      try {
        const res = await fetch(`/api/items/${itemId}`);
        if (!res.ok) {
          if (res.status === 404) throw new Error("Item not found");
          if (res.status === 401) throw new Error("Please sign in to view this item");
          throw new Error("Failed to load item");
        }
        const data = await res.json();
        setItem(data.item);
        setConnections(data.connections || []);
        setIsFavorite(data.item.isFavorite);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [itemId]);

  const handleToggleFavorite = async () => {
    if (!item) return;
    const newValue = !isFavorite;
    setIsFavorite(newValue);
    try {
      const res = await fetch(`/api/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: newValue }),
      });
      if (!res.ok) throw new Error("Failed to update");
    } catch {
      setIsFavorite(!newValue);
      toast.error("Failed to update favorite");
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this item permanently?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Item deleted");
      router.push("/dashboard");
    } catch {
      toast.error("Failed to delete item");
      setDeleting(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-64 skeleton rounded-lg" />
        <div className="h-5 w-96 skeleton rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-40 skeleton rounded-2xl" />
            <div className="h-32 skeleton rounded-2xl" />
            <div className="h-24 skeleton rounded-2xl" />
          </div>
          <div className="space-y-4">
            <div className="h-48 skeleton rounded-2xl" />
            <div className="h-32 skeleton rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error || !item) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <div className="text-5xl mb-6">🔍</div>
        <h2 className="text-xl font-semibold mb-2">{error || "Item not found"}</h2>
        <p className="text-muted-foreground mb-8">
          This item might have been deleted or you don&apos;t have access to it.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
        >
          ← Back to Dashboard
        </Link>
      </div>
    );
  }

  const typeConfig = ITEM_TYPE_CONFIG[item.type] || ITEM_TYPE_CONFIG.note;
  const domain = item.metadata?.sourceUrl ? extractDomain(item.metadata.sourceUrl) : null;
  const hasAiData = item.aiData && item.aiData.summary && item.aiData.summary !== "Summary unavailable.";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Back Button ── */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back
      </button>

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-2xl">{typeConfig.icon}</span>
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full uppercase bg-nexus-500/10", typeConfig.color)}>
              {typeConfig.label}
            </span>
            {item.visibility !== "private" && (
              <span className="text-xs text-muted-foreground">
                {item.visibility === "public" ? "🌍 Public" : "👥 Team"}
              </span>
            )}
          </div>
          <h1 className="text-3xl font-bold gradient-text break-words">
            {item.title || "Untitled"}
          </h1>
          {domain && (
            <a
              href={item.metadata?.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-nexus-400 hover:text-nexus-300 mt-2 transition-colors"
            >
              <span>↗</span>
              {domain}
            </a>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center gap-2 shrink-0">
          {item.metadata?.sourceUrl && (
            <a
              href={item.metadata.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all"
            >
              <span>↗</span>
              Open Original
            </a>
          )}
          <button
            onClick={handleToggleFavorite}
            className={cn(
              "p-2.5 rounded-xl border transition-all text-lg",
              isFavorite
                ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                : "border-border hover:border-yellow-500/30 text-muted-foreground"
            )}
            title={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            {isFavorite ? "★" : "☆"}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-2.5 rounded-xl border border-border hover:border-red-500/30 text-muted-foreground hover:text-red-400 transition-all"
            title="Delete item"
          >
            {deleting ? "⟳" : "✕"}
          </button>
        </div>
      </div>

      {/* ── Meta Bar ── */}
      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground glass-card p-4 rounded-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs">📅</span>
          <span>Saved {formatDateRelative(item.createdAt)}</span>
        </div>
        <span className="text-border">|</span>
        <div className="flex items-center gap-2">
          <span className="text-xs">✏️</span>
          <span>Updated {formatDateRelative(item.updatedAt)}</span>
        </div>
        {item.aiData?.category && (
          <>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xs">📂</span>
              <span className="text-nexus-400">{item.aiData.category}</span>
            </div>
          </>
        )}
        {item.aiData?.sentiment && (
          <>
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xs">
                {item.aiData.sentiment === "positive" ? "😊" : item.aiData.sentiment === "negative" ? "😟" : "😐"}
              </span>
              <span className="capitalize">{item.aiData.sentiment}</span>
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Content ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">✨</span>
              <h2 className="font-semibold">AI Summary</h2>
              {hasAiData && (
                <span className="text-xs text-muted-foreground ml-auto">
                  Processed {item.aiData?.processedAt ? formatDateRelative(item.aiData.processedAt) : ""}
                </span>
              )}
            </div>
            {hasAiData ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {item.aiData?.summary}
              </p>
            ) : (
              <div className="text-center py-8">
                <div className="text-2xl mb-3 animate-pulse">✦</div>
                <p className="text-sm text-muted-foreground">
                  AI processing in progress... Check back soon!
                </p>
              </div>
            )}
          </div>

          {/* Key Points */}
          {item.aiData?.keyPoints && item.aiData.keyPoints.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🎯</span>
                <h2 className="font-semibold">Key Points</h2>
              </div>
              <ul className="space-y-2.5">
                {item.aiData.keyPoints.map((point, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-nexus-500/10 text-nexus-400 flex items-center justify-center text-xs font-medium mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Content Preview */}
          {item.content && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">📄</span>
                <h2 className="font-semibold">Content</h2>
              </div>
              <pre className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                {item.content}
              </pre>
            </div>
          )}
        </div>

        {/* ── Sidebar ── */}
        <div className="space-y-6">
          {/* Tags */}
          {item.aiData?.tags && item.aiData.tags.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🏷️</span>
                <h2 className="font-semibold">Tags</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.aiData.tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/search?q=${encodeURIComponent(tag)}&mode=semantic`}
                    className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-nexus-500/20 hover:text-nexus-400 transition-all"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Entities */}
          {item.aiData?.entities && item.aiData.entities.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🎭</span>
                <h2 className="font-semibold">Entities</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.aiData.entities.map((entity: string) => (
                  <span
                    key={entity}
                    className="text-xs px-2.5 py-1 rounded-md bg-muted text-muted-foreground"
                  >
                    {entity}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="glass-card p-6 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">ℹ️</span>
              <h2 className="font-semibold">Details</h2>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span>{typeConfig.icon} {typeConfig.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span>{formatDate(item.updatedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Visibility</span>
                <span className="capitalize">{item.visibility}</span>
              </div>
              {item.aiData?.language && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Language</span>
                  <span className="uppercase">{item.aiData.language}</span>
                </div>
              )}
              {item.aiData?.processingVersion && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">AI Version</span>
                  <span>v{item.aiData.processingVersion}</span>
                </div>
              )}
            </div>
          </div>

          {/* Connections */}
          {connections.length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🔗</span>
                <h2 className="font-semibold">Connections ({connections.length})</h2>
              </div>
              <div className="space-y-3">
                {connections.map((conn) => {
                  const otherItem = conn.from_item_id === itemId ? conn.to_item : conn.from_item;
                  const otherType = otherItem?.type || "link";
                  const otherIcon = ITEM_TYPE_CONFIG[otherType as keyof typeof ITEM_TYPE_CONFIG]?.icon || "📄";
                  const otherId = conn.from_item_id === itemId ? conn.to_item_id : conn.from_item_id;
                  return (
                    <Link
                      key={conn.id}
                      href={`/items/${otherId}`}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-all group"
                    >
                      <span className="text-lg mt-0.5">{otherIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate group-hover:text-nexus-400 transition-colors">
                          {otherItem?.title || "Untitled"}
                        </p>
                        {conn.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {conn.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1 flex-1 rounded-full bg-muted-foreground/10 max-w-20">
                            <div
                              className="h-1 rounded-full bg-nexus-500"
                              style={{ width: `${Math.round(conn.strength * 100)}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {Math.round(conn.strength * 100)}%
                          </span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
