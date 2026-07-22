"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatDateRelative } from "@/lib/utils";

interface SharedData {
  type: "item" | "collection";
  title: string;
  description?: string;
  items?: Array<{ id: string; title: string; type: string; summary?: string }>;
  itemTitle?: string;
  itemType?: string;
  itemSummary?: string;
  itemContent?: string;
  itemTags?: string[];
  createdAt: string;
  expiresAt?: string;
}

export default function SharedPage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<SharedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Look up the token in localStorage
    const allLinks = JSON.parse(
      typeof window !== "undefined" ? localStorage.getItem("nexus:share-links") || "[]" : "[]",
    );
    const link = allLinks.find((l: { token: string }) => l.token === params.token);

    if (!link) {
      setError("This shared link is invalid or has been revoked.");
      setLoading(false);
      return;
    }

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      setError("This shared link has expired.");
      setLoading(false);
      return;
    }

    // Fetch the item data
    async function fetchShared() {
      try {
        const res = await fetch(`/api/items/${link.itemId}`);
        if (!res.ok) throw new Error("Failed to load shared content");
        const json = await res.json();
        const item = json.item;

        setData({
          type: "item",
          title: item.title || "Untitled",
          itemTitle: item.title || "Untitled",
          itemType: item.type,
          itemSummary: item.aiData?.summary,
          itemContent: item.content,
          itemTags: item.aiData?.tags,
          createdAt: item.createdAt,
          expiresAt: link.expiresAt,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load content");
      } finally {
        setLoading(false);
      }
    }
    fetchShared();
  }, [params.token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4 text-nexus-400">⬡</div>
          <p className="text-muted-foreground">Loading shared content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-5xl mb-6">🔒</div>
          <h1 className="text-2xl font-bold mb-3">{error}</h1>
          <p className="text-muted-foreground mb-8">
            The link you followed may have expired or the content was removed.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
          >
            ⟠ Go to NEXUS
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm">
            <span className="text-lg">⟠</span>
            <span className="font-semibold gradient-text">NEXUS</span>
          </Link>
          <span className="text-xs text-muted-foreground">Shared content</span>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-12">
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Banner */}
          <div className="h-2 bg-gradient-to-r from-nexus-500/20 to-indigo-500/20" />

          <div className="p-6 sm:p-8">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full uppercase bg-nexus-500/10 text-nexus-400">
                Shared {data?.type}
              </span>
              {data?.expiresAt && (
                <span className="text-xs text-muted-foreground">
                  Expires {formatDateRelative(data.expiresAt)}
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl sm:text-3xl font-bold gradient-text mb-4">{data?.title}</h1>

            {/* Item details */}
            {data?.type === "item" && (
              <div className="space-y-6">
                {data.itemSummary && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Summary</h3>
                    <p className="text-sm leading-relaxed">{data.itemSummary}</p>
                  </div>
                )}

                {data.itemContent && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2">Content</h3>
                    <pre className="text-sm leading-relaxed whitespace-pre-wrap font-sans bg-muted/30 p-4 rounded-xl">
                      {data.itemContent}
                    </pre>
                  </div>
                )}

                {data.itemTags && data.itemTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {data.itemTags.map((tag: string) => (
                      <span
                        key={tag}
                        className="text-xs px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-8 pt-6 border-t border-border/50 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Shared from NEXUS · {formatDateRelative(data?.createdAt || "")}
              </p>
              <Link
                href="/"
                className="text-xs text-nexus-400 hover:text-nexus-300 transition-colors"
              >
                ⟠ Powered by NEXUS
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
