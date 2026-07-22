"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDateRelative } from "@/lib/utils";

interface PreviewData {
  id: string;
  title: string;
  type: string;
  content?: string;
  ai_data?: {
    summary?: string;
    tags?: string[];
    category?: string;
  } | null;
  metadata?: {
    domain?: string;
  } | null;
  created_at?: string;
}

interface ItemPreviewProps {
  itemId: string;
  children: React.ReactNode;
  className?: string;
}

const TYPE_ICONS: Record<string, string> = {
  link: "🔗",
  note: "📝",
  file: "📄",
  image: "🖼",
  screenshot: "📸",
  voice_memo: "🎤",
  pdf: "📕",
  video: "🎬",
};

const PLACEHOLDER = { icon: "📌", gradient: "from-slate-500/20 to-zinc-500/20" };

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

export function ItemPreview({ itemId, children, className }: ItemPreviewProps) {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const cacheRef = useRef<Map<string, PreviewData>>(new Map());

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => clearTimeout(timerRef.current);
  }, []);

  const fetchPreview = useCallback(async (id: string) => {
    // Check cache
    if (cacheRef.current.has(id)) {
      setPreview(cacheRef.current.get(id)!);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/items/quick/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      cacheRef.current.set(id, data.item);
      setPreview(data.item);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => {
      setShowPreview(true);
      fetchPreview(itemId);
    }, 400); // 400ms delay before showing
  };

  const handleMouseLeave = () => {
    clearTimeout(timerRef.current);
    setShowPreview(false);
    setPreview(null);
  };

  const typeIcon = TYPE_ICONS[preview?.type || ""] || PLACEHOLDER.icon;
  const gradient = TYPE_GRADIENTS[preview?.type || ""] || PLACEHOLDER.gradient;
  const aiData = preview?.ai_data;

  return (
    <div
      className={`relative inline${className ? ` ${className}` : ""}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {/* Preview Card */}
      {showPreview && (
        <div className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-1 w-72 glass-card rounded-xl overflow-hidden shadow-xl animate-fade-in-up border border-border/50">
          {loading ? (
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 skeleton rounded-lg" />
                <div className="flex-1">
                  <div className="h-3 w-20 skeleton rounded" />
                  <div className="h-4 w-32 skeleton rounded mt-1" />
                </div>
              </div>
              <div className="h-3 w-full skeleton rounded" />
              <div className="h-3 w-3/4 skeleton rounded" />
            </div>
          ) : preview ? (
            <div onClick={() => router.push(`/items/${itemId}`)} className="cursor-pointer">
              <div className={`h-1 bg-gradient-to-r ${gradient}`} />
              <div className="p-4">
                <div className="flex items-start gap-3 mb-2">
                  <div
                    className={`w-8 h-8 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center text-sm shrink-0`}
                  >
                    {typeIcon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{preview.title || "Untitled"}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-nexus-400 bg-nexus-500/10 px-1.5 py-0.5 rounded uppercase">
                        {preview.type}
                      </span>
                      {aiData?.category && (
                        <span className="text-[9px] text-muted-foreground">{aiData.category}</span>
                      )}
                    </div>
                  </div>
                </div>

                {aiData?.summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-2">
                    {aiData.summary}
                  </p>
                )}

                {aiData?.tags && aiData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {aiData.tags.slice(0, 3).map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between text-[9px] text-muted-foreground/60">
                  <span>{preview.metadata?.domain || ""}</span>
                  {preview.created_at && <span>{formatDateRelative(preview.created_at)}</span>}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
