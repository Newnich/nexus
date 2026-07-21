"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn, formatDateRelative, extractDomain, ITEM_TYPE_CONFIG } from "@/lib/utils";
import type { Item } from "@/types/item";

interface Connection {
  id: string;
  from_item_id: string;
  to_item_id: string;
  type: string;
  strength: number;
  description?: string;
  from_item?: { id: string; title: string; type: string };
  to_item?: { id: string; title: string; type: string };
}

interface QuickViewModalProps {
  itemId: string;
  onClose: () => void;
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

export function QuickViewModal({ itemId, onClose }: QuickViewModalProps) {
  const router = useRouter();
  const [item, setItem] = useState<Item | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchItem() {
      setLoading(true);
      try {
        const res = await fetch(`/api/items/${itemId}`);
        if (!res.ok) return;
        const data = await res.json();
        setItem(data.item);
        setConnections(data.connections || []);
      } catch {} finally {
        setLoading(false);
      }
    }
    fetchItem();
  }, [itemId]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  if (!item && !loading) return null;

  const typeConfig = item ? ITEM_TYPE_CONFIG[item.type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.note : null;
  const gradient = item ? TYPE_GRADIENTS[item.type] || "from-nexus-500/20 to-indigo-500/20" : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-2xl max-h-[85vh] glass-card rounded-2xl overflow-hidden flex flex-col animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close + Open buttons */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <button
            onClick={() => router.push(`/items/${itemId}`)}
            className="p-2 rounded-lg glass-card hover:bg-card/70 text-xs transition-all"
            title="Open full page"
          >
            ↗
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg glass-card hover:bg-card/70 text-xs transition-all"
            title="Close"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            <div className="h-6 w-24 skeleton rounded-lg" />
            <div className="h-8 w-3/4 skeleton rounded-lg" />
            <div className="h-4 w-1/2 skeleton rounded" />
            <div className="h-32 skeleton rounded-2xl" />
          </div>
        ) : item && typeConfig ? (
          <>
            {/* Color accent */}
            <div className={`h-1.5 bg-gradient-to-r ${gradient} shrink-0`} />

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Header */}
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-lg shrink-0`}>
                  {typeConfig.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase bg-nexus-500/10", typeConfig.color)}>
                      {typeConfig.label}
                    </span>
                    {item.visibility !== "private" && (
                      <span className="text-[10px] text-muted-foreground">
                        {item.visibility === "public" ? "🌍 Public" : "👥 Team"}
                      </span>
                    )}
                  </div>
                  <h2 className="text-lg font-bold gradient-text mt-1 break-words">{item.title || "Untitled"}</h2>
                </div>
              </div>

              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>📅 Saved {formatDateRelative(item.createdAt)}</span>
                <span className="text-border">·</span>
                <span>✏️ Updated {formatDateRelative(item.updatedAt)}</span>
                {item.aiData?.category && (
                  <>
                    <span className="text-border">·</span>
                    <span>📂 <span className="text-nexus-400">{item.aiData.category}</span></span>
                  </>
                )}
                {item.aiData?.sentiment && (
                  <>
                    <span className="text-border">·</span>
                    <span className="capitalize">{item.aiData.sentiment === "positive" ? "😊" : item.aiData.sentiment === "negative" ? "😟" : "😐"} {item.aiData.sentiment}</span>
                  </>
                )}
              </div>

              {/* Domain */}
              {item.metadata?.sourceUrl && (
                <a href={item.metadata.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-nexus-400 hover:text-nexus-300 transition-colors">
                  ↗ {extractDomain(item.metadata.sourceUrl)}
                </a>
              )}

              {/* Summary */}
              {item.aiData?.summary && (
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-xs">✨</span>
                    <span className="text-xs font-semibold">AI Summary</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.aiData.summary}</p>
                </div>
              )}

              {/* Content */}
              {item.content && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Content</h3>
                  <pre className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap font-sans line-clamp-6">
                    {item.content}
                  </pre>
                </div>
              )}

              {/* Tags */}
              {item.aiData?.tags && item.aiData.tags.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {item.aiData.tags.map((tag) => (
                      <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}&mode=semantic`}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground hover:bg-nexus-500/20 hover:text-nexus-400 transition-all">
                        #{tag}
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Connections */}
              {connections.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Connections ({connections.length})
                  </h3>
                  <div className="space-y-1.5">
                    {connections.slice(0, 5).map((conn) => {
                      const other = conn.from_item_id === itemId ? conn.to_item : conn.from_item;
                      const otherConfig = ITEM_TYPE_CONFIG[other?.type as keyof typeof ITEM_TYPE_CONFIG] || ITEM_TYPE_CONFIG.note;
                      return (
                        <Link key={conn.id} href={`/items/${other?.id}`}
                          className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-all text-sm">
                          <span>{otherConfig.icon}</span>
                          <span className="flex-1 truncate">{other?.title || "Untitled"}</span>
                          <span className="text-[10px] text-muted-foreground">{Math.round(conn.strength * 100)}%</span>
                        </Link>
                      );
                    })}
                    {connections.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center pt-1">
                        +{connections.length - 5} more connections
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-border/50 flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                {item.aiData?.keyPoints?.length || 0} key points · {item.aiData?.tags?.length || 0} tags
              </span>
              <Link href={`/items/${itemId}`}
                className="text-xs text-nexus-400 hover:text-nexus-300 transition-colors font-medium">
                Open full page →
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
