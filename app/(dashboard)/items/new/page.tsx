"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

type SaveType = "link" | "note" | "file";

export default function NewItemPage() {
  const router = useRouter();
  const [saveType, setSaveType] = useState<SaveType>("link");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // TODO: Call API to save item with AI processing
      const item = {
        type: saveType,
        title: title || url || "Untitled",
        content: saveType === "note" ? content : url,
        metadata: saveType === "link" ? { sourceUrl: url } : {},
      };

      console.log("Saving item:", item);

      // Simulate AI processing
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Item saved! AI is processing...");
      router.push("/dashboard");
    } catch (error) {
      toast.error("Failed to save item");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold gradient-text">Save to NEXUS</h1>
        <p className="text-muted-foreground mt-1">
          Save anything. AI will automatically organize it.
        </p>
      </div>

      {/* Save Type Selector */}
      <div className="flex gap-2 p-1 glass-card rounded-xl w-fit">
        {[
          { type: "link" as SaveType, icon: "🔗", label: "Link" },
          { type: "note" as SaveType, icon: "📝", label: "Note" },
          { type: "file" as SaveType, icon: "📄", label: "File" },
        ].map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => setSaveType(type)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all",
              saveType === type
                ? "bg-nexus-500/20 text-nexus-400 font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Save Form */}
      <form onSubmit={handleSave} className="space-y-4">
        {saveType === "link" && (
          <div>
            <label className="block text-sm font-medium mb-2">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/article"
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
              required
              autoFocus
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Title {saveType !== "link" && <span className="text-muted-foreground">(optional)</span>}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={saveType === "link" ? "Auto-detected from page" : "My amazing note..."}
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
          />
        </div>

        {saveType === "note" && (
          <div>
            <label className="block text-sm font-medium mb-2">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={8}
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all resize-none"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-2">
            Tags <span className="text-muted-foreground">(optional, comma-separated)</span>
          </label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="AI, machine-learning, research"
            className="w-full px-4 py-3 bg-muted border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
          />
        </div>

        {/* AI Preview */}
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span className="animate-pulse">✦</span>
            <span>AI will automatically:</span>
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground/70">
            <li>• Generate a 3-sentence summary</li>
            <li>• Extract key points and entities</li>
            <li>• Categorize and tag the content</li>
            <li>• Find connections to existing items</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-xl transition-all disabled:opacity-50"
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
        </div>
      </form>
    </div>
  );
}
