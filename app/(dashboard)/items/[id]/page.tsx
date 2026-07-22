"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn, formatDate, formatDateRelative, extractDomain, ITEM_TYPE_CONFIG } from "@/lib/utils";
import type { Item } from "@/types/item";
import { MiniGraph } from "@/components/mini-graph";
import { ItemEditor } from "@/components/item-editor";
import { ShareLink } from "@/components/share-link";
import { CollectionsManager } from "@/components/collections-manager";
import { useRecentlyViewed } from "@/lib/hooks/use-recently-viewed";

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

const SENTIMENT_ICONS: Record<string, string> = {
  positive: "😊",
  negative: "😟",
  neutral: "😐",
};

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
  const [isArchived, setIsArchived] = useState(false);
  const [editing, setEditing] = useState(false);
  const { trackView } = useRecentlyViewed();

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
        setIsArchived(data.item.isArchived);
        trackView(itemId, data.item.title, data.item.type);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [itemId, trackView]);

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

  const handleSaveEdit = async (updates: Record<string, unknown>) => {
    const res = await fetch(`/api/items/${itemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error("Failed to update");
    const data = await res.json();
    setItem(data.item);
    setEditing(false);
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="h-6 w-24 skeleton rounded-lg" />
        <div className="h-12 w-3/4 skeleton rounded-lg" />
        <div className="h-5 w-1/2 skeleton rounded" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
          <div className="lg:col-span-2 space-y-4">
            <div className="h-44 skeleton rounded-2xl" />
            <div className="h-36 skeleton rounded-2xl" />
            <div className="h-28 skeleton rounded-2xl" />
          </div>
          <div className="space-y-4">
            <div className="h-52 skeleton rounded-2xl" />
            <div className="h-36 skeleton rounded-2xl" />
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
  const hasAiData =
    item.aiData && item.aiData.summary && item.aiData.summary !== "Summary unavailable.";
  const gradient = TYPE_GRADIENTS[item.type] || "from-nexus-500/20 to-indigo-500/20";

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* ── Back Button ── */}
      <button
        onClick={() => router.back()}
        className="group flex items-center gap-2 text-sm text-muted-foreground hover:text-nexus-400 transition-colors"
      >
        <span className="group-hover:-translate-x-1 transition-transform">←</span>
        Back
      </button>
      {/* ── Inline Editor ── */}
      {editing && item && (
        <ItemEditor item={item} onSave={handleSaveEdit} onCancel={() => setEditing(false)} />
      )}
      {/* ── Hero Section ── */}
      {!editing && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Color accent bar */}
          <div className={`h-2 bg-gradient-to-r ${gradient}`} />

          <div className="p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                {/* Badge row */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-2xl`}
                  >
                    {typeConfig.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-[11px] font-semibold px-2.5 py-1 rounded-full uppercase bg-nexus-500/10",
                          typeConfig.color,
                        )}
                      >
                        {typeConfig.label}
                      </span>
                      {item.visibility !== "private" && (
                        <span className="text-[11px] text-muted-foreground">
                          {item.visibility === "public" ? "🌍 Public" : "👥 Team"}
                        </span>
                      )}
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-bold gradient-text mt-1 break-words">
                      {item.title || "Untitled"}
                    </h1>
                  </div>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    📅 Saved {formatDateRelative(item.createdAt)}
                  </span>
                  <span className="text-border">·</span>
                  <span className="flex items-center gap-1">
                    ✏️ Updated {formatDateRelative(item.updatedAt)}
                  </span>
                  {item.aiData?.category && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1">
                        📂 <span className="text-nexus-400">{item.aiData.category}</span>
                      </span>
                    </>
                  )}
                  {item.aiData?.sentiment && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-1">
                        {SENTIMENT_ICONS[item.aiData.sentiment] || "😐"}
                        <span className="capitalize">{item.aiData.sentiment}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Domain link */}
                {domain && item.metadata?.sourceUrl && (
                  <a
                    href={item.metadata.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-nexus-400 hover:text-nexus-300 mt-3 transition-colors"
                  >
                    ↗ {domain}
                  </a>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {item.metadata?.sourceUrl && (
                  <a
                    href={item.metadata.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all hover:shadow-lg hover:shadow-nexus-500/25"
                  >
                    ↗ Open Original
                  </a>
                )}
                {/* Edit button */}
                <button
                  onClick={() => setEditing(true)}
                  className="p-2.5 rounded-xl border border-border hover:border-nexus-500/30 text-muted-foreground hover:text-nexus-400 transition-all"
                  title="Edit item"
                >
                  ✏️
                </button>
                <ShareLink itemId={itemId} itemTitle={item.title} />
                <CollectionsManager itemId={itemId} />
                <button
                  onClick={handleToggleFavorite}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all text-lg hover-lift",
                    isFavorite
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      : "border-border hover:border-yellow-500/30 text-muted-foreground",
                  )}
                  title={isFavorite ? "Remove from favorites" : "Add to favorites"}
                >
                  {isFavorite ? "★" : "☆"}
                </button>
                <button
                  onClick={async () => {
                    const newVal = !isArchived;
                    setIsArchived(newVal);
                    try {
                      const res = await fetch(`/api/items/${itemId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isArchived: newVal }),
                      });
                      if (!res.ok) throw new Error();
                      toast.success(newVal ? "Item archived" : "Item restored");
                    } catch {
                      setIsArchived(!newVal);
                      toast.error("Failed to update archive status");
                    }
                  }}
                  className={cn(
                    "p-2.5 rounded-xl border transition-all text-lg",
                    isArchived
                      ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
                      : "border-border hover:border-amber-500/30 text-muted-foreground",
                  )}
                  title={isArchived ? "Restore from archive" : "Archive item"}
                >
                  {isArchived ? "📦" : "🗃"}
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
          </div>
        </div>
      )}{" "}
      {/* Close the !editing block */}
      {!editing && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Main Content (2/3) ── */}
          <div className="lg:col-span-2 space-y-6">
            {/* AI Summary */}
            <div className="glass-card p-6 rounded-2xl gradient-border">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nexus-500/20 to-indigo-500/20 flex items-center justify-center text-sm">
                  ✨
                </div>
                <h2 className="font-semibold">AI Summary</h2>
                {hasAiData && item.aiData?.processedAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    Processed {formatDateRelative(item.aiData.processedAt)}
                  </span>
                )}
              </div>
              {hasAiData ? (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.aiData?.summary}
                </p>
              ) : (
                <div className="text-center py-10">
                  <div className="text-3xl mb-3 animate-pulse">✦</div>
                  <p className="text-sm text-muted-foreground">
                    AI processing in progress... Check back soon!
                  </p>
                </div>
              )}
            </div>

            {/* Key Points */}
            {item.aiData?.keyPoints && item.aiData.keyPoints.length > 0 && (
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2.5 mb-5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-sm">
                    🎯
                  </div>
                  <h2 className="font-semibold">Key Points</h2>
                </div>
                <div className="grid gap-3">
                  {item.aiData.keyPoints.map((point, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-all stagger-item"
                    >
                      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-nexus-500/15 text-nexus-400 flex items-center justify-center text-xs font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm text-muted-foreground leading-relaxed">{point}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Content Preview */}
            {item.content && (
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center text-sm">
                    📄
                  </div>
                  <h2 className="font-semibold">Content</h2>
                  {item.metadata?.wordCount && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {item.metadata.wordCount.toLocaleString()} words
                      {item.metadata.readingTime ? ` · ${item.metadata.readingTime} min read` : ""}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <pre className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans">
                    {item.content}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* ── Sidebar (1/3) ── */}
          <div className="space-y-6">
            {/* Tags */}
            {item.aiData?.tags && item.aiData.tags.length > 0 && (
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-sm">
                    🏷️
                  </div>
                  <h2 className="font-semibold">Tags</h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {item.aiData.tags.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.aiData.tags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/search?q=${encodeURIComponent(tag)}&mode=semantic`}
                      className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-nexus-500/20 hover:text-nexus-400 transition-all hover-scale"
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
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center text-sm">
                    🎭
                  </div>
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
            {/* Details */}
            <div className="glass-card p-6 rounded-2xl">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-500/20 to-zinc-500/20 flex items-center justify-center text-sm">
                  ℹ️
                </div>
                <h2 className="font-semibold">Details</h2>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { label: "Type", value: `${typeConfig.icon} ${typeConfig.label}` },
                  { label: "Created", value: formatDate(item.createdAt) },
                  { label: "Updated", value: formatDate(item.updatedAt) },
                  {
                    label: "Visibility",
                    value: item.visibility.charAt(0).toUpperCase() + item.visibility.slice(1),
                  },
                  ...(item.aiData?.language
                    ? [{ label: "Language", value: item.aiData.language.toUpperCase() }]
                    : []),
                  ...(item.aiData?.processingVersion
                    ? [{ label: "AI Version", value: `v${item.aiData.processingVersion}` }]
                    : []),
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex justify-between items-center p-2 rounded-lg bg-muted/20"
                  >
                    <span className="text-muted-foreground text-xs">{label}</span>
                    <span className="text-xs font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* Mini Graph */}
            {connections.length > 2 && item && (
              <MiniGraph
                centerId={itemId}
                centerTitle={item.title}
                centerType={item.type}
                connections={connections}
              />
            )}
            {/* Connections */}
            {connections.length > 0 && (
              <div className="glass-card p-6 rounded-2xl">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-sm">
                    🔗
                  </div>
                  <h2 className="font-semibold">Connections</h2>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {connections.length}
                  </span>
                </div>
                <div className="space-y-2">
                  {connections.map((conn) => {
                    const otherItem = conn.from_item_id === itemId ? conn.to_item : conn.from_item;
                    const otherType = otherItem?.type || "link";
                    const otherIcon =
                      ITEM_TYPE_CONFIG[otherType as keyof typeof ITEM_TYPE_CONFIG]?.icon || "📄";
                    const otherId =
                      conn.from_item_id === itemId ? conn.to_item_id : conn.from_item_id;
                    const otherGradient =
                      TYPE_GRADIENTS[otherType] || "from-nexus-500/20 to-indigo-500/20";
                    const strengthPct = Math.round(conn.strength * 100);

                    return (
                      <Link
                        key={conn.id}
                        href={`/items/${otherId}`}
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-all group hover-lift stagger-item"
                      >
                        <div
                          className={`w-9 h-9 rounded-xl bg-gradient-to-br ${otherGradient} flex items-center justify-center text-base shrink-0`}
                        >
                          {otherIcon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-nexus-400 transition-colors">
                            {otherItem?.title || "Untitled"}
                          </p>
                          {conn.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {conn.description}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="h-1 flex-1 rounded-full bg-muted-foreground/10 max-w-24 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-nexus-500 transition-all duration-500"
                                style={{ width: `${strengthPct}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {strengthPct}%
                            </span>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Source link (mobile) */} {/* Reprocess with AI button */}
            <button
              onClick={async () => {
                try {
                  const res = await fetch("/api/ai/process", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ itemId }),
                  });
                  if (!res.ok) throw new Error();
                  toast.success("AI processing re-queued");
                } catch {
                  toast.error("Failed to re-queue AI processing");
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-nexus-500/10 hover:bg-nexus-500/20 text-nexus-400 rounded-xl text-sm transition-all"
            >
              ✨ Reprocess with AI
            </button>
            {item.metadata?.sourceUrl && (
              <a
                href={item.metadata.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="sm:hidden flex items-center gap-2 px-4 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all justify-center"
              >
                ↗ Open Original
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
