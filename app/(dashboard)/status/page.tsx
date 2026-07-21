"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";

// ── Types ──

interface QueueCounts {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

interface BackfillLastRun {
  scanned: number;
  enqueued: number;
  skipped: number;
  errors: number;
  hasMore: boolean;
  completedAt: string | null;
}

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  firstSeen: string;
  lastSeen: string;
  fresh: boolean;
}

interface StatusData {
  redis: string;
  queues: {
    ai_processing: QueueCounts;
    maintenance: QueueCounts;
  } | null;
  backfill: {
    cursor: string | null;
    schedule: string;
    nextRun: string | null;
    batchSize: number;
    enabled: boolean;
    hasMore: boolean;
    lastRun: BackfillLastRun | null;
  } | null;
  database: {
    unprocessedItems: number | null;
  } | null;
  config: {
    redisHost: string;
    redisPort: string;
    ollamaUrl: string;
    workerConcurrency: string;
    backfillCron: string;
    backfillBatch: string;
    dbListener: boolean;
  } | null;
  error?: string;
}

// ── Helpers ──

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusColor(status: string): string {
  switch (status) {
    case "connected": return "text-green-400";
    case "ready": return "text-green-400";
    case "connecting": return "text-yellow-400";
    case "error": return "text-red-400";
    default: return "text-muted-foreground";
  }
}

function statusIndicator(status: string): string {
  switch (status) {
    case "connected": return "bg-green-400";
    case "ready": return "bg-green-400";
    case "connecting": return "bg-yellow-400";
    case "error": return "bg-red-400";
    default: return "bg-muted-foreground";
  }
}

function getAlertIcon(severity: string): string {
  switch (severity) {
    case "critical": return "🔴";
    case "warning": return "🟡";
    case "info": return "🔵";
    default: return "⚪";
  }
}

function getAlertBorder(severity: string): string {
  switch (severity) {
    case "critical": return "border-red-500/30";
    case "warning": return "border-yellow-500/30";
    case "info": return "border-blue-500/30";
    default: return "border-border/50";
  }
}

function getAlertBg(severity: string): string {
  switch (severity) {
    case "critical": return "bg-red-500/5";
    case "warning": return "bg-yellow-500/5";
    case "info": return "bg-blue-500/5";
    default: return "bg-muted/20";
  }
}

// ── Component ──

export default function StatusPage() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const dismissedAlerts = useRef<Set<string>>(new Set());

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/status");
      if (!res.ok) throw new Error("Failed to load status");
      const d = await res.json();
      setData(d);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch alerts separately with previous IDs for fresh detection
  const fetchAlerts = useCallback(async () => {
    try {
      const previousIds = alerts
        .filter((a) => !dismissedAlerts.current.has(a.id))
        .map((a) => a.id)
        .join(",");
      const res = await fetch("/api/queue/alerts?previous=" + encodeURIComponent(previousIds));
      if (!res.ok) return;
      const result = await res.json();
      const newAlerts: Alert[] = result.alerts || [];

      // Show toast for fresh critical/warning alerts
      for (const alert of newAlerts) {
        if (
          alert.fresh &&
          (alert.severity === "critical" || alert.severity === "warning")
        ) {
          const emoji = alert.severity === "critical" ? "🚨" : "⚠️";
          toast(emoji + " " + alert.title + " — " + alert.message, {
            duration: 6000,
            style: {
              background: alert.severity === "critical"
                ? "hsl(0 63% 6%)"
                : "hsl(38 92% 6%)",
              border: alert.severity === "critical"
                ? "1px solid hsl(0 63% 31%)"
                : "1px solid hsl(38 92% 31%)",
            },
          });
        }
      }

      setAlerts(newAlerts);
    } catch {
      // Silently fail — alerts are best-effort
    }
  }, [alerts]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchStatus();
      fetchAlerts();
    }, 10_000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchStatus, fetchAlerts]);

  // ── Loading State ──
  if (loading) {
    return (
      <div className="space-y-8">
        <div className="h-8 w-48 skeleton rounded-lg" />
        <div className="h-5 w-64 skeleton rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 skeleton rounded-2xl" />
          <div className="h-72 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold gradient-text">System Status</h1>
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Could not load status</h2>
          <p className="text-muted-foreground mb-6">{error}</p>
          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            className="px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const redisOk = data?.redis === "connected" || data?.redis === "ready";
  const aiQueue = data?.queues?.ai_processing;
  const maintQueue = data?.queues?.maintenance;
  const backfill = data?.backfill;
  const db = data?.database;

  // Sort alerts: critical first, then warning, then info
  const sortedAlerts = [...alerts].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    return (order[a.severity] || 99) - (order[b.severity] || 99);
  });
  const activeAlerts = sortedAlerts.filter((a) => !dismissedAlerts.current.has(a.id));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">System Status</h1>
          <p className="text-muted-foreground mt-1">
            Live monitoring of background services and queues
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-border bg-muted text-nexus-500 focus:ring-nexus-500/30"
            />
            Auto-refresh
          </label>
          <button
            onClick={() => { setLoading(true); fetchStatus(); }}
            className="flex items-center gap-2 px-4 py-2 glass-card hover:bg-card/70 rounded-lg text-sm transition-all"
          >
            <span>⟳</span>
            Refresh
          </button>
        </div>
      </div>

      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-2">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={"glass-card p-4 rounded-xl border " + getAlertBorder(alert.severity)}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg mt-0.5">{getAlertIcon(alert.severity)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{alert.title}</span>
                    <span className={
                      "text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium " +
                      (alert.severity === "critical" ? "bg-red-500/10 text-red-400" :
                       alert.severity === "warning" ? "bg-yellow-500/10 text-yellow-400" :
                       "bg-blue-500/10 text-blue-400")
                    }>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                </div>
                <button
                  onClick={() => {
                    dismissedAlerts.current.add(alert.id);
                    setAlerts([...alerts]);
                  }}
                  className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Redis */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${statusIndicator(data?.redis || "disconnected")}`} />
            <span className="font-semibold">Redis</span>
          </div>
          <p className={`text-2xl font-bold ${statusColor(data?.redis || "disconnected")}`}>
            {data?.redis || "disconnected"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {process.env.NEXT_PUBLIC_REDIS_HOST || process.env.REDIS_HOST || "localhost"}
          </p>
        </div>

        {/* AI Processing Queue */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${(aiQueue?.active || 0) > 0 ? "bg-green-400" : "bg-muted-foreground"}`} />
            <span className="font-semibold">AI Queue</span>
          </div>
          <p className="text-2xl font-bold gradient-text">
            {((aiQueue?.waiting || 0) + (aiQueue?.active || 0)).toLocaleString()}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {aiQueue?.active || 0} active · {aiQueue?.waiting || 0} waiting
          </p>
        </div>

        {/* Backfill */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${backfill?.enabled ? "bg-green-400" : "bg-yellow-400"}`} />
            <span className="font-semibold">Backfill</span>
          </div>
          <p className={`text-2xl font-bold ${backfill?.hasMore ? "text-yellow-400" : "text-green-400"}`}>
            {backfill?.hasMore ? "In progress" : "Caught up"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {backfill?.enabled ? backfill.schedule : "Disabled"}
          </p>
        </div>

        {/* Unprocessed Items */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`w-2.5 h-2.5 rounded-full ${(db?.unprocessedItems || 0) > 0 ? "bg-yellow-400" : "bg-green-400"}`} />
            <span className="font-semibold">Unprocessed</span>
          </div>
          <p className={`text-2xl font-bold ${(db?.unprocessedItems || 0) > 0 ? "text-yellow-400" : "text-green-400"}`}>
            {db?.unprocessedItems?.toLocaleString() || 0}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Items missing AI embeddings
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Queue Depths */}
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">📊 Queue Depths</h2>

          {/* AI Processing Queue */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-nexus-400">AI Processing</span>
              <span className="text-xs text-muted-foreground">
                Total: {((aiQueue?.waiting || 0) + (aiQueue?.active || 0) + (aiQueue?.completed || 0) + (aiQueue?.failed || 0) + (aiQueue?.delayed || 0)).toLocaleString()}
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Waiting", value: aiQueue?.waiting || 0, color: "bg-blue-500" },
                { label: "Active", value: aiQueue?.active || 0, color: "bg-green-500" },
                { label: "Completed", value: aiQueue?.completed || 0, color: "bg-emerald-500/50" },
                { label: "Failed", value: aiQueue?.failed || 0, color: "bg-red-500" },
                { label: "Delayed", value: aiQueue?.delayed || 0, color: "bg-yellow-500" },
              ].map((item) => {
                const total = (aiQueue?.waiting || 0) + (aiQueue?.active || 0) + (aiQueue?.completed || 0) + (aiQueue?.failed || 0) + (aiQueue?.delayed || 0);
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-right text-muted-foreground">{item.label}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                        style={{ width: `${Math.max(0.5, pct)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Maintenance Queue */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-yellow-400">Maintenance</span>
              <span className="text-xs text-muted-foreground">
                Total: {((maintQueue?.waiting || 0) + (maintQueue?.active || 0) + (maintQueue?.completed || 0) + (maintQueue?.failed || 0) + (maintQueue?.delayed || 0)).toLocaleString()}
              </span>
            </div>
            <div className="space-y-1.5">
              {[
                { label: "Waiting", value: maintQueue?.waiting || 0, color: "bg-blue-500" },
                { label: "Active", value: maintQueue?.active || 0, color: "bg-green-500" },
                { label: "Completed", value: maintQueue?.completed || 0, color: "bg-emerald-500/50" },
                { label: "Failed", value: maintQueue?.failed || 0, color: "bg-red-500" },
                { label: "Delayed", value: maintQueue?.delayed || 0, color: "bg-yellow-500" },
              ].map((item) => {
                const total = (maintQueue?.waiting || 0) + (maintQueue?.active || 0) + (maintQueue?.completed || 0) + (maintQueue?.failed || 0) + (maintQueue?.delayed || 0);
                const pct = total > 0 ? (item.value / total) * 100 : 0;
                return (
                  <div key={item.label} className="flex items-center gap-2 text-xs">
                    <span className="w-20 shrink-0 text-right text-muted-foreground">{item.label}</span>
                    <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${item.color}`}
                        style={{ width: `${Math.max(0.5, pct)}%` }}
                      />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono tabular-nums">
                      {item.value.toLocaleString()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Backfill Details */}
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">🔁 Backfill Scanner</h2>

          <div className="space-y-4">
            {/* Status row */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-sm font-medium ${backfill?.enabled ? "text-green-400" : "text-yellow-400"}`}>
                {backfill?.enabled ? "Active" : "Disabled"}
              </span>
            </div>

            {/* Schedule row */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <span className="text-sm text-muted-foreground">Schedule</span>
              <span className="text-sm font-medium font-mono">{backfill?.schedule || "—"}</span>
            </div>

            {/* Next run row */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <span className="text-sm text-muted-foreground">Next Run</span>
              <span className="text-sm font-medium">
                {backfill?.nextRun ? (
                  <span className="text-nexus-400">{timeAgo(backfill.nextRun)}</span>
                ) : "—"}
              </span>
            </div>

            {/* Batch size row */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <span className="text-sm text-muted-foreground">Batch Size</span>
              <span className="text-sm font-medium">{backfill?.batchSize || 200}</span>
            </div>

            {/* Cursor row */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <span className="text-sm text-muted-foreground">Cursor</span>
              <span className="text-sm font-medium font-mono" title={backfill?.cursor || undefined}>
                {backfill?.cursor
                  ? `${formatDate(backfill.cursor)} ${formatTimestamp(backfill.cursor)}`
                  : "—"}
              </span>
            </div>

            {/* Divider */}
            <div className="border-t border-border/50 pt-4">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Last Run</h3>

              {backfill?.lastRun ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Scanned", value: backfill.lastRun.scanned.toLocaleString(), color: "text-blue-400" },
                      { label: "Enqueued", value: backfill.lastRun.enqueued.toLocaleString(), color: "text-green-400" },
                      { label: "Skipped", value: backfill.lastRun.skipped.toLocaleString(), color: "text-muted-foreground" },
                      { label: "Errors", value: backfill.lastRun.errors.toLocaleString(), color: backfill.lastRun.errors > 0 ? "text-red-400" : "text-muted-foreground" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                        <span className="text-xs text-muted-foreground">{item.label}</span>
                        <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/20 rounded-lg">
                    <span className="text-xs text-muted-foreground">Completed</span>
                    <span className="text-xs font-medium">
                      {timeAgo(backfill.lastRun.completedAt)}
                    </span>
                  </div>
                  {backfill.lastRun.hasMore && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-500/10 rounded-lg">
                      <span className="text-yellow-400 text-xs">⚠</span>
                      <span className="text-xs text-yellow-400/80">More items remain — next run will continue</span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No backfill runs yet
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Env / Config Info */}
      <div className="glass-card p-6">
        <h2 className="font-semibold mb-4">⚙ Configuration</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {[
            { label: "Redis Host", value: data?.config?.redisHost || "localhost" },
            { label: "Redis Port", value: data?.config?.redisPort || "6379" },
            { label: "Ollama URL", value: data?.config?.ollamaUrl || "http://localhost:11434" },
            { label: "Worker Concurrency", value: data?.config?.workerConcurrency || "2" },
            { label: "Backfill Cron", value: data?.config?.backfillCron || "*/15 * * * *" },
            { label: "Backfill Batch", value: data?.config?.backfillBatch || "200" },
            { label: "DB Listener", value: data?.config?.dbListener ? "Connected" : "Not configured" },
          ].map((item) => (
            <div key={item.label} className="p-3 bg-muted/20 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">{item.label}</p>
              <p className="text-sm font-medium font-mono truncate" title={item.value}>
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground/50">
        Auto-refreshes every 10s · Data is fetched from the running worker process
      </div>
    </div>
  );
}
