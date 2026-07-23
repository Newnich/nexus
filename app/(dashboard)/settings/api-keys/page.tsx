"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { cn, formatDateRelative } from "@/lib/utils";
import { PageSkeleton } from "@/components/page-skeleton";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings/api-keys");
      if (!res.ok) {
        if (res.status === 401) throw new Error("Please sign in");
        throw new Error("Failed to load API keys");
      }
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create key");
      }
      const data = await res.json();
      setNewKeyValue(data.key);
      setNewKeyName("");
      toast.success("API key created! Copy it now — you won't see it again.");
      fetchKeys();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (keyId: string) => {
    if (!confirm("Revoke this API key? Any services using it will immediately lose access."))
      return;
    setRevoking(keyId);
    try {
      const res = await fetch(`/api/settings/api-keys?keyId=${keyId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to revoke key");
      toast.success("API key revoked");
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch {
      toast.error("Failed to revoke key");
    } finally {
      setRevoking(null);
    }
  };

  const copyToClipboard = (value: string) => {
    navigator.clipboard.writeText(value);
    toast.success("Copied to clipboard");
  };

  if (loading) {
    return (
      <PageSkeleton titleWidth="w-56" subtitleWidth="w-72">
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 skeleton rounded-2xl" />
          ))}
        </div>
      </PageSkeleton>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text">API Keys</h1>
            <p className="text-muted-foreground mt-1">Manage programmatic access to NEXUS</p>
          </div>
        </div>
        <div className="text-center py-16 glass-card rounded-2xl border-red-500/20">
          <div className="text-4xl mb-4">⚠️</div>
          <h3 className="text-lg font-semibold text-red-400 mb-1">Failed to load API keys</h3>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={fetchKeys}
            className="px-4 py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg text-sm transition-all"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold gradient-text">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Create and manage API keys for programmatic access to NEXUS
        </p>
      </div>

      {/* New Key Banner */}
      {newKeyValue && (
        <div className="gradient-border rounded-2xl">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">🔑</span>
              <h3 className="font-semibold text-green-400">Key created successfully!</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Copy this key now. For security, it will never be shown again.
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 px-4 py-3 bg-background border border-border rounded-xl text-sm font-mono break-all">
                {newKeyValue}
              </code>
              <button
                onClick={() => copyToClipboard(newKeyValue)}
                className="px-4 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all shrink-0"
              >
                Copy
              </button>
              <button
                onClick={() => setNewKeyValue(null)}
                className="p-3 glass-card hover:bg-card/70 rounded-xl transition-all shrink-0"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Key */}
      {!showNewKey ? (
        <button
          onClick={() => setShowNewKey(true)}
          className="flex items-center gap-2 px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all text-sm w-fit"
        >
          <span>+</span>
          Create New Key
        </button>
      ) : (
        <div className="glass-card p-5 rounded-xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm">New API Key</h3>
            <button
              onClick={() => setShowNewKey(false)}
              className="text-muted-foreground hover:text-foreground text-sm"
            >
              Cancel
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g., My CLI Tool"
              className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-nexus-500/50 focus:border-nexus-500 transition-all"
              autoFocus
              maxLength={100}
            />
            <button
              onClick={handleCreate}
              disabled={creating || !newKeyName.trim()}
              className="px-5 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl text-sm transition-all disabled:opacity-50"
            >
              {creating ? "Creating..." : "Generate"}
            </button>
          </div>
        </div>
      )}

      {/* Keys List */}
      {keys.length === 0 ? (
        <div className="text-center py-16 glass-card rounded-2xl">
          <div className="text-4xl mb-4">🔑</div>
          <h2 className="text-xl font-semibold mb-2">No API keys yet</h2>
          <p className="text-muted-foreground max-w-sm mx-auto">
            Create an API key to integrate NEXUS with your tools, scripts, and workflows.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {keys.length} key{keys.length !== 1 ? "s" : ""}
          </p>
          {keys.map((key) => (
            <div key={key.id} className="glass-card p-5 rounded-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">{key.name}</span>
                    <code className="text-[10px] px-1.5 py-0.5 bg-muted rounded font-mono text-muted-foreground">
                      {key.prefix}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Created {formatDateRelative(key.created_at)}
                    {key.last_used_at
                      ? ` · Last used ${formatDateRelative(key.last_used_at)}`
                      : " · Never used"}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(key.id)}
                  disabled={revoking === key.id}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs transition-all shrink-0",
                    "border border-red-500/20 text-red-400 hover:bg-red-500/10",
                  )}
                >
                  {revoking === key.id ? "⟳" : "Revoke"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-4">
        <a
          href="/settings/general"
          className="flex items-center gap-3 p-3 glass-card hover:bg-card/70 rounded-xl text-sm transition-all group"
        >
          <span>🔧</span>
          <span className="flex-1">General Settings</span>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            →
          </span>
        </a>
        <a
          href="/settings/notifications"
          className="flex items-center gap-3 p-3 glass-card hover:bg-card/70 rounded-xl text-sm transition-all group"
        >
          <span>📡</span>
          <span className="flex-1">Channel Config</span>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            →
          </span>
        </a>
        <a
          href="/status"
          className="flex items-center gap-3 p-3 glass-card hover:bg-card/70 rounded-xl text-sm transition-all group"
        >
          <span>⚙</span>
          <span className="flex-1">System Status</span>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors shrink-0">
            →
          </span>
        </a>
      </div>
    </div>
  );
}
