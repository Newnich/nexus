"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { cn, validatedFetcher } from "@/lib/utils";
import { ExportDataResponseSchema, ImportDataResponseSchema } from "@/lib/schemas";

export default function ImportExportPage() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    total: number;
    message: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await validatedFetcher("/api/data/export", ExportDataResponseSchema);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success(`Exported ${data.stats.items} items, ${data.stats.collections} collections`);
    } catch {
      toast.error("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImport(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImport(file);
  };

  const handleImport = async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "json" && ext !== "html" && ext !== "htm") {
      toast.error("Please upload a .json or .html file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }

    setImportResult(null);
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", ext === "html" || ext === "htm" ? "html" : "json");

      const data = await validatedFetcher("/api/data/import", ImportDataResponseSchema, {
        method: "POST",
        body: formData,
      });

      setImportResult(data);
      toast.success(data.message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const quickLinks = [
    { href: "/settings/general", label: "General Settings", icon: "⚙️" },
    { href: "/settings/notifications", label: "Notification Channels", icon: "📡" },
    { href: "/status", label: "System Status", icon: "📊" },
  ];

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-bold gradient-text">Import & Export</h1>
        <p className="text-muted-foreground mt-1">
          Export your data as JSON or import from browser bookmark exports
        </p>
      </div>

      {/* ── Quick Links ── */}
      <div className="flex items-center gap-3 flex-wrap">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-card/70 rounded-xl text-sm transition-all"
          >
            <span>{link.icon}</span>
            {link.label}
          </Link>
        ))}
      </div>

      {/* ── Export Section ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/20 flex items-center justify-center text-lg">
            📤
          </div>
          <div>
            <h2 className="text-lg font-semibold">Export Data</h2>
            <p className="text-sm text-muted-foreground">
              Download all your items, collections, and connections as JSON
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all disabled:opacity-50 hover:shadow-lg hover:shadow-nexus-500/25"
        >
          {exporting ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Exporting...
            </>
          ) : (
            <>⬇ Download Export</>
          )}
        </button>
      </div>

      {/* ── Import Section ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center text-lg">
            📥
          </div>
          <div>
            <h2 className="text-lg font-semibold">Import Data</h2>
            <p className="text-sm text-muted-foreground">
              Import items from a JSON export or browser bookmark HTML file
            </p>
          </div>
        </div>

        {/* Drop zone */}
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
              ? "border-nexus-500 bg-nexus-500/5"
              : "border-border hover:border-nexus-500/30 hover:bg-muted/20",
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.html,.htm"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="text-5xl mb-4">{importing ? "⟳" : isDragging ? "📥" : "📂"}</div>
          <p className="text-sm font-medium mb-1">
            {importing
              ? "Importing..."
              : isDragging
                ? "Drop file here"
                : "Click to browse or drag & drop"}
          </p>
          <p className="text-xs text-muted-foreground">
            Supports .json (NEXUS export) and .html (browser bookmarks) · Max 10MB
          </p>
        </div>

        {/* Import result */}
        {importResult && (
          <div className="mt-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-1">
              <span>✅</span>
              <span className="text-sm font-semibold text-emerald-400">Import Complete</span>
            </div>
            <p className="text-sm text-muted-foreground">{importResult.message}</p>
          </div>
        )}

        {/* Format info */}
        <div className="mt-6 p-4 rounded-xl bg-muted/30">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Supported formats
            </summary>
            <div className="mt-3 space-y-3 text-sm text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-1">📄 NEXUS JSON Export</p>
                <p>Full data export with items, collections, and connections.</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-1">🔖 Browser Bookmarks (HTML)</p>
                <p>
                  Standard Netscape bookmark format exported from Chrome, Firefox, Safari, or Edge.
                </p>
                <p className="text-xs mt-1">
                  Import up to 500 items at once. Duplicate URLs are skipped.
                </p>
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
