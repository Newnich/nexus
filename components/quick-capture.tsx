"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export function QuickCapture() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "note">("link");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const fabRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus first input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, mode]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (mode === "link" && !url.trim()) {
      toast.error("Please enter a URL");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setSaving(true);
    try {
      const body =
        mode === "link"
          ? { type: "link", title: title.trim(), metadata: { sourceUrl: url.trim() } }
          : { type: "note", title: title.trim(), content: content.trim() };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      toast.success(`${mode === "link" ? "Link" : "Note"} saved!`);
      setTitle("");
      setUrl("");
      setContent("");
      setIsOpen(false);
      router.refresh();
    } catch {
      toast.error("Failed to save item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div ref={fabRef} className="fixed bottom-20 md:bottom-6 right-6 z-40">
      {/* Expanded form */}
      <div
        className={cn(
          "absolute bottom-16 right-0 w-72 md:w-80 glass-card rounded-2xl overflow-hidden transition-all duration-300 origin-bottom-right",
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4 pointer-events-none",
        )}
      >
        {/* Mode tabs */}
        <div className="flex border-b border-border/50">
          <button
            onClick={() => setMode("link")}
            className={cn(
              "flex-1 px-4 py-2.5 text-xs font-medium transition-all",
              mode === "link"
                ? "text-nexus-400 border-b-2 border-nexus-500"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            🔗 Link
          </button>
          <button
            onClick={() => setMode("note")}
            className={cn(
              "flex-1 px-4 py-2.5 text-xs font-medium transition-all",
              mode === "note"
                ? "text-nexus-400 border-b-2 border-nexus-500"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            📝 Note
          </button>
        </div>

        {/* Form */}
        <div className="p-4 space-y-3">
          {mode === "link" && (
            <input
              ref={inputRef}
              type="url"
              placeholder="Paste a URL..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                // Auto-extract title from URL if empty
                if (!title.trim() && e.target.value.trim()) {
                  try {
                    const domain = new URL(e.target.value).hostname
                      .replace("www.", "")
                      .split(".")[0];
                    setTitle(domain.charAt(0).toUpperCase() + domain.slice(1));
                  } catch {}
                }
              }}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
            />
          )}
          <input
            ref={mode === "note" ? inputRef : undefined}
            type="text"
            placeholder={mode === "link" ? "Title (optional)" : "Note title..."}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
          />
          {mode === "note" && (
            <textarea
              placeholder="Write your note..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-muted/50 border border-border rounded-xl text-xs focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all resize-none"
            />
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setIsOpen(false)}
              className="flex-1 px-3 py-2 glass-card hover:bg-card/70 rounded-xl text-xs transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!url.trim() && mode === "link") || !title.trim()}
              className="flex-1 px-3 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-xs transition-all disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                `Save ${mode === "link" ? "Link" : "Note"}`
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FAB button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-2xl transition-all duration-300 hover:scale-110 active:scale-95",
          isOpen
            ? "bg-red-500 hover:bg-red-600 rotate-45 shadow-red-500/30"
            : "bg-nexus-500 hover:bg-nexus-600 shadow-nexus-500/30 hover:shadow-xl hover:shadow-nexus-500/40",
        )}
        title={isOpen ? "Close" : "Quick capture"}
      >
        {isOpen ? "✕" : "+"}
      </button>
    </div>
  );
}
