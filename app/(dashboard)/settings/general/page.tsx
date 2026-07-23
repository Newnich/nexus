"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { PageSkeleton } from "@/components/page-skeleton";

// ── Types ──

type ChannelId = "slack" | "discord" | "email";
type AlertId = string;

interface ChannelInfo {
  id: ChannelId;
  label: string;
  icon: string;
  description: string;
}

interface AlertInfo {
  id: AlertId;
  title: string;
  description: string;
  severity: "critical" | "warning" | "info";
}

interface NotificationPreferences {
  [alertId: string]: {
    [channelId: string]: boolean;
  };
}

// ── Constants ──

const CHANNELS: ChannelInfo[] = [
  { id: "slack", label: "Slack", icon: "💬", description: "Slack webhook" },
  { id: "discord", label: "Discord", icon: "🎮", description: "Discord webhook" },
  { id: "email", label: "Email", icon: "📧", description: "Resend email" },
];

const ALERTS: AlertInfo[] = [
  {
    id: "redis_disconnected",
    title: "Redis Disconnected",
    description: "Redis connection drops — AI processing and backfill become unavailable",
    severity: "critical",
  },
  {
    id: "backfill_repeated_failures",
    title: "Backfill Failing Repeatedly",
    description: "3+ consecutive backfill failures — check Ollama and database",
    severity: "warning",
  },
  {
    id: "backfill_enqueue_errors",
    title: "Backfill Enqueue Errors",
    description: "Items failed to enqueue during the last backfill scan",
    severity: "warning",
  },
  {
    id: "worker_inactive",
    title: "Worker Appears Inactive",
    description: "No successful backfill run in 2+ hours — worker may have stopped",
    severity: "warning",
  },
  {
    id: "worker_no_successful_run",
    title: "Worker Hasn't Completed a Run",
    description: "Worker started but has only failures and no successful runs",
    severity: "warning",
  },
  {
    id: "large_backlog",
    title: "Large Processing Backlog",
    description: "1,000+ items missing AI embeddings — backfill is processing them",
    severity: "info",
  },
];

function severityBadge(severity: string): string {
  switch (severity) {
    case "critical":
      return "bg-red-500/10 text-red-400";
    case "warning":
      return "bg-yellow-500/10 text-yellow-400";
    case "info":
      return "bg-blue-500/10 text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

function severityIcon(severity: string): string {
  switch (severity) {
    case "critical":
      return "🔴";
    case "warning":
      return "🟡";
    case "info":
      return "🔵";
    default:
      return "⚪";
  }
}

// ── Component ──

export default function GeneralSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Load preferences on mount
  const fetchPreferences = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/preferences");
      if (!res.ok) throw new Error("Failed to load preferences");
      const data = await res.json();
      setPreferences(data.preferences || {});
    } catch (err) {
      console.error("Failed to load preferences:", err);
      toast.error("Failed to load notification preferences", {
        duration: 4000,
        style: { background: "hsl(0 63% 6%)", border: "1px solid hsl(0 63% 31%)" },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Toggle a preference
  const toggle = (alertId: string, channel: ChannelId) => {
    if (!preferences) return;
    setPreferences((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const alertPrefs = { ...next[alertId] };
      alertPrefs[channel] = !alertPrefs[channel];
      next[alertId] = alertPrefs;
      return next;
    });
    setDirty(true);
  };

  // Toggle all channels for an alert
  const toggleAlert = (alertId: string) => {
    if (!preferences || !preferences[alertId]) return;
    const allEnabled = CHANNELS.every((ch) => preferences[alertId][ch.id]);
    setPreferences((prev) => {
      if (!prev) return prev;
      const next = { ...prev };
      const alertPrefs: Record<string, boolean> = {};
      for (const ch of CHANNELS) {
        alertPrefs[ch.id] = !allEnabled;
      }
      next[alertId] = alertPrefs as Record<ChannelId, boolean>;
      return next;
    });
    setDirty(true);
  };

  // Save preferences
  const save = async () => {
    if (!preferences) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");

      toast.success("Notification preferences saved!", {
        duration: 3000,
        style: { background: "hsl(142 76% 6%)", border: "1px solid hsl(142 76% 36%)" },
      });
      setDirty(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to save: ${msg}`, {
        duration: 5000,
        style: { background: "hsl(0 63% 6%)", border: "1px solid hsl(0 63% 31%)" },
      });
    } finally {
      setSaving(false);
    }
  };

  // Reset to defaults (all channels enabled for all alerts)
  const resetToDefaults = async () => {
    const defaults: NotificationPreferences = {};
    for (const alert of ALERTS) {
      const alertPrefs: Record<string, boolean> = {};
      for (const ch of CHANNELS) {
        alertPrefs[ch.id] = true;
      }
      defaults[alert.id] = alertPrefs as Record<ChannelId, boolean>;
    }

    setPreferences(defaults);
    setDirty(true);
    setShowResetConfirm(false);

    // Auto-save the defaults immediately
    setSaving(true);
    try {
      const res = await fetch("/api/settings/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: defaults }),
      });

      if (!res.ok) throw new Error("Failed to save defaults");

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");

      toast.success("Reset to default preferences", {
        duration: 3000,
        style: { background: "hsl(142 76% 6%)", border: "1px solid hsl(142 76% 36%)" },
      });
      setDirty(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast.error(`Failed to reset: ${msg}`, {
        duration: 5000,
        style: { background: "hsl(0 63% 6%)", border: "1px solid hsl(0 63% 31%)" },
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <PageSkeleton titleWidth="w-64" subtitleWidth="w-96">
        <div className="h-96 skeleton rounded-2xl" />
      </PageSkeleton>
    );
  }

  // ── Preferences Not Loaded ──
  if (!preferences) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold gradient-text">General Settings</h1>
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Could not load preferences</h2>
          <p className="text-muted-foreground mb-6">Make sure Redis is running and try again.</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchPreferences();
            }}
            className="px-6 py-3 bg-nexus-500 hover:bg-nexus-600 text-white rounded-xl transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">General Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure which system alerts trigger notifications on each channel
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-xs text-yellow-400 font-medium">Unsaved changes</span>}

          {/* Reset to Defaults */}
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            className="px-4 py-2.5 glass-card hover:bg-card/70 text-muted-foreground hover:text-foreground rounded-xl transition-all text-sm"
          >
            🔄 Reset to Defaults
          </button>

          <button
            onClick={save}
            disabled={saving || !dirty}
            className="px-5 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:bg-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all text-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ── Notification Preferences Table ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-6">
          <span className="text-2xl">🔔</span>
          <div>
            <h2 className="font-semibold">Notification Preferences</h2>
            <p className="text-xs text-muted-foreground">
              Toggle which alerts are sent to each notification channel
            </p>
          </div>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-[1fr_repeat(3,64px)_auto] gap-2 px-4 py-3 text-xs text-muted-foreground font-medium border-b border-border/30 mb-2">
          <span>Alert</span>
          {CHANNELS.map((ch) => (
            <span key={ch.id} className="text-center" title={ch.description}>
              {ch.icon}
            </span>
          ))}
          <span className="text-center w-12">All</span>
        </div>

        {/* Alert rows */}
        <div className="divide-y divide-border/20">
          {ALERTS.map((alert) => {
            const alertPrefs = preferences[alert.id];
            if (!alertPrefs) return null;

            const allEnabled = CHANNELS.every((ch) => alertPrefs[ch.id]);

            return (
              <div
                key={alert.id}
                className="grid grid-cols-[1fr_repeat(3,64px)_auto] gap-2 px-4 py-3 items-center hover:bg-muted/20 transition-colors rounded-lg"
              >
                {/* Alert info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{severityIcon(alert.severity)}</span>
                    <span className="text-sm font-medium">{alert.title}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase font-medium ${severityBadge(alert.severity)}`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {alert.description}
                  </p>
                </div>

                {/* Channel toggles */}
                {CHANNELS.map((ch) => (
                  <div key={ch.id} className="flex justify-center">
                    <button
                      onClick={() => toggle(alert.id, ch.id)}
                      className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all text-sm ${
                        alertPrefs[ch.id]
                          ? "bg-nexus-500/20 text-nexus-400 hover:bg-nexus-500/30"
                          : "bg-muted/30 text-muted-foreground/40 hover:bg-muted/50"
                      }`}
                      title={`${alertPrefs[ch.id] ? "Disable" : "Enable"} ${ch.label} for ${alert.title}`}
                    >
                      {alertPrefs[ch.id] ? "✓" : "—"}
                    </button>
                  </div>
                ))}

                {/* Toggle all */}
                <div className="flex justify-center">
                  <button
                    onClick={() => toggleAlert(alert.id)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all text-xs ${
                      allEnabled
                        ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                        : "bg-muted/30 text-muted-foreground/40 hover:bg-muted/50"
                    }`}
                    title={allEnabled ? "Disable all channels" : "Enable all channels"}
                  >
                    {allEnabled ? "✓" : "—"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-4 border-t border-border/30 text-xs text-muted-foreground">
          {(() => {
            const totalEnabled = Object.values(preferences).reduce((sum, alertPrefs) => {
              return sum + CHANNELS.filter((ch) => alertPrefs[ch.id]).length;
            }, 0);
            const totalSlots = ALERTS.length * CHANNELS.length;
            return `${totalEnabled} of ${totalSlots} notification routes enabled`;
          })()}
        </div>
      </div>

      {/* ── Reset Confirmation Dialog ── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="glass-card p-6 rounded-2xl max-w-md w-full mx-4 shadow-2xl border border-border">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🔄</span>
              <h3 className="text-lg font-semibold">Reset to Defaults?</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              This will enable <strong>all notification routes</strong> — every alert will be sent
              to every configured channel. Any custom toggles you've set will be lost.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2.5 glass-card hover:bg-card/70 text-sm rounded-xl transition-all"
              >
                Cancel
              </button>
              <button
                onClick={resetToDefaults}
                disabled={saving}
                className="px-5 py-2.5 bg-yellow-500 hover:bg-yellow-600 disabled:bg-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all text-sm"
              >
                {saving ? "Resetting..." : "Yes, Reset All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Links ── */}
      <div className="glass-card p-6 rounded-2xl">
        <h2 className="font-semibold mb-4">🔗 Related Settings</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/settings/alerts"
            className="flex items-center gap-3 p-4 bg-muted/20 hover:bg-muted/40 rounded-xl transition-all group"
          >
            <span className="text-2xl">🔴</span>
            <div>
              <p className="text-sm font-medium group-hover:text-nexus-400 transition-colors">
                Alert Thresholds
              </p>
              <p className="text-xs text-muted-foreground">
                Configure when system alerts are triggered (failures, inactivity, backlog)
              </p>
            </div>
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
          <Link
            href="/settings/notifications"
            className="flex items-center gap-3 p-4 bg-muted/20 hover:bg-muted/40 rounded-xl transition-all group"
          >
            <span className="text-2xl">📧</span>
            <div>
              <p className="text-sm font-medium group-hover:text-nexus-400 transition-colors">
                Channel Configuration
              </p>
              <p className="text-xs text-muted-foreground">
                Configure webhook URLs, test channels, view notification history
              </p>
            </div>
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
          <Link
            href="/status"
            className="flex items-center gap-3 p-4 bg-muted/20 hover:bg-muted/40 rounded-xl transition-all group"
          >
            <span className="text-2xl">⚙</span>
            <div>
              <p className="text-sm font-medium group-hover:text-nexus-400 transition-colors">
                System Status
              </p>
              <p className="text-xs text-muted-foreground">
                Monitor Redis, queues, backfill, and system health
              </p>
            </div>
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground/50">
        Preferences are stored in Redis and persist across server restarts
      </div>
    </div>
  );
}
