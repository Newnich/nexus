"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { cn, extractDomain } from "@/lib/utils";
import { TagChips } from "@/components/shared/tag-chips";
import { CollectionPicker } from "@/components/shared/collection-picker";
import { useDraft } from "@/lib/hooks/use-draft";

type SaveType = "link" | "note" | "file";

const SAVE_TYPE_CONFIG = [
  { type: "link" as SaveType, icon: "🔗", label: "Link", desc: "Save a webpage or article" },
  { type: "note" as SaveType, icon: "📝", label: "Note", desc: "Write your own thoughts" },
  { type: "file" as SaveType, icon: "📄", label: "File", desc: "Upload a document or image" },
];

export default function NewItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get("type") as SaveType) || "link";
  const [saveType, setSaveType] = useState<SaveType>("link");
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!initialized && initialType && ["link", "note", "file"].includes(initialType)) {
      setSaveType(initialType);
      setInitialized(true);
    }
  }, [initialType, initialized]);

  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [urlPreview, setUrlPreview] = useState<{
    title: string;
    domain: string;
    favicon: string | null;
  } | null>(null);
  const [fetchingPreview, setFetchingPreview] = useState(false);
  const [selectedCollections, setSelectedCollections] = useState<Set<string>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { hasDraft, saveDraft, loadDraft, clearDraft } = useDraft();
  const [draftRestored, setDraftRestored] = useState(false);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) {
      setSaveType(draft.saveType as SaveType);
      setUrl(draft.url || "");
      setTitle(draft.title || "");
      setContent(draft.content || "");
      setTags(draft.tags || []);
      setDraftRestored(true);
      toast.success("📝 Draft restored", { duration: 2000 });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    saveDraft({ saveType, url, title, content, tags });
  }, [saveType, url, title, content, tags, saveDraft]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        const form = document.querySelector("form");
        if (form) form.requestSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const fetchUrlPreview = useCallback(async (urlStr: string) => {
    if (!urlStr.trim()) {
      setUrlPreview(null);
      return;
    }
    setFetchingPreview(true);
    await new Promise((r) => setTimeout(r, 400));
    const domain = extractDomain(urlStr);
    setUrlPreview({ title: urlStr, domain, favicon: null });
    setFetchingPreview(false);
  }, []);

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const base64 = ev.target?.result as string;
          toast.success(`📎 ${file.name} ready to save`);
          setContent(base64);
          if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
        };
        reader.readAsDataURL(file);
      }
    },
    [title],
  );

  const handleFileDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      handleFiles(files);
    },
    [handleFiles],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      handleFiles(files);
    },
    [handleFiles],
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {
        type: saveType,
        title: title || url || "Untitled",
        content: saveType === "note" ? content : saveType === "file" ? content : url,
        metadata:
          saveType === "link"
            ? { sourceUrl: url, ...(urlPreview?.domain ? { domain: urlPreview.domain } : {}) }
            : {},
        tags: tags.length > 0 ? tags : undefined,
        collectionIds: selectedCollections.size > 0 ? Array.from(selectedCollections) : undefined,
      };

      const res = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to save item");
      }

      const { item } = await res.json();
      clearDraft();

      toast.success(
        (t) => (
          <div className="flex items-center gap-2">
            <span>✨ Saved! AI is processing...</span>
            <button
              onClick={() => {
                toast.dismiss(t.id);
                router.push(`/items/${item.id}`);
              }}
              className="text-xs underline hover:text-nexus-400 transition-colors"
            >
              View
            </button>
          </div>
        ),
        { duration: 5000 },
      );

      router.push("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save item");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="text-center">
        <div className="text-5xl mb-4">⟠</div>
        <h1 className="text-3xl font-bold gradient-text mb-2">Save to NEXUS</h1>
        <p className="text-muted-foreground">
          Save anything. AI will automatically organize, tag, and connect it.
        </p>
      </div>

      {/* Save Type Selector */}
      <div className="grid grid-cols-3 gap-3">
        {SAVE_TYPE_CONFIG.map(({ type, icon, label, desc }) => (
          <button
            key={type}
            onClick={() => {
              setSaveType(type);
              setUrlPreview(null);
              setContent("");
            }}
            className={cn(
              "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all duration-200 hover-lift",
              saveType === type
                ? "border-nexus-500 bg-nexus-500/10 text-nexus-400"
                : "border-border hover:border-nexus-500/30 bg-muted/20",
            )}
          >
            <span className="text-3xl">{icon}</span>
            <span className="text-sm font-semibold">{label}</span>
            <span className="text-[10px] text-muted-foreground text-center">{desc}</span>
          </button>
        ))}
      </div>

      {/* Save Form */}
      <form onSubmit={handleSave} className="space-y-5">
        {saveType === "link" && (
          <div>
            <label className="block text-sm font-medium mb-2">URL</label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground">
                🔗
              </span>
              <input
                name="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onBlur={() => fetchUrlPreview(url)}
                onKeyDown={(e) => e.key === "Enter" && fetchUrlPreview(url)}
                placeholder="https://example.com/article"
                className="w-full pl-10 pr-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
                required
                autoFocus
              />
              {fetchingPreview && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="animate-spin text-xs text-muted-foreground">⟳</span>
                </div>
              )}
            </div>
            {urlPreview && (
              <div className="mt-3 glass-card p-3 rounded-xl flex items-center gap-3 animate-fade-in-up">
                {urlPreview.favicon && (
                  <img src={urlPreview.favicon} alt="" className="w-6 h-6 rounded" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{urlPreview.title}</p>
                  <p className="text-xs text-muted-foreground">↗ {urlPreview.domain}</p>
                </div>
                <span className="text-[10px] text-green-400">✓ Ready</span>
              </div>
            )}
          </div>
        )}

        {saveType === "file" && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200",
              isDragging
                ? "border-nexus-500 bg-nexus-500/10"
                : "border-border hover:border-nexus-500/30 hover:bg-muted/20",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
            />
            <div className="text-4xl mb-3">{isDragging ? "📥" : "📄"}</div>
            <p className="font-semibold mb-1">
              {isDragging ? "Drop files here" : "Drag & drop files or click to browse"}
            </p>
            <p className="text-xs text-muted-foreground">PDFs, images, documents, and more</p>
            {content && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm">
                <span>✓ File loaded</span>
              </div>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Title {saveType !== "link" && <span className="text-muted-foreground">(optional)</span>}
          </label>
          <input
            name="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={saveType === "link" ? "Auto-detected from URL" : "My amazing note..."}
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
          />
        </div>

        {/* Note Content */}
        {saveType === "note" && (
          <div>
            <label className="block text-sm font-medium mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={10}
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all resize-none font-mono text-sm leading-relaxed"
              required
            />
            <p className="text-xs text-muted-foreground mt-1.5 text-right">
              {content.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>
        )}

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Tags <span className="text-muted-foreground">(type and press Enter)</span>
          </label>
          <TagChips tags={tags} onChange={setTags} placeholder="AI, machine-learning, research" />
        </div>

        {/* Collection Picker */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Add to Collections <span className="text-muted-foreground">(optional)</span>
          </label>
          <CollectionPicker
            selected={selectedCollections}
            onChange={setSelectedCollections}
            placeholder="Choose collections..."
          />
        </div>

        {/* AI Processing Preview */}
        <div className="gradient-border">
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
              <span className="w-2 h-2 bg-nexus-500 rounded-full animate-pulse" />
              <span className="font-medium">After saving, AI will automatically:</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "📝", label: "Generate summary" },
                { icon: "🎯", label: "Extract key points" },
                { icon: "🏷", label: "Auto-tag & categorize" },
                { icon: "🔗", label: "Find connections" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs text-muted-foreground">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-8 py-3 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-nexus-500/25"
          >
            {isSaving ? (
              <>
                <span className="animate-spin">⟳</span>
                Saving & Processing...
              </>
            ) : (
              <>
                <span>⟠</span>
                Save to NEXUS
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 glass-card hover:bg-card/70 rounded-xl transition-all text-sm"
          >
            Cancel
          </button>
          <span className="text-xs text-muted-foreground ml-auto hidden sm:block">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">
              ⌘↵
            </kbd>{" "}
            to save
          </span>
        </div>
      </form>
    </div>
  );
}
