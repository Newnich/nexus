"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

// ── Types ──

interface AlertThresholds {
  consecutiveFailuresThreshold: number;
  workerInactivityHours: number;
  backlogThreshold: number;
}

interface ThresholdConfig {
  key: keyof AlertThresholds;
  label: string;
  description: string;
  detail: string;
  icon: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}

// ── Constants ──

const THRESHOLD_CONFIGS: ThresholdConfig[] = [
  {
    key: "consecutiveFailuresThreshold",
    label: "Backfill Failure Threshold",
    description: "How many consecutive backfill failures before triggering an alert",
    detail: "When the backfill worker fails this many times in a row, a warning alert fires. Useful for catching persistent issues without alerting on transient failures.",
    icon: "🔴",
    min: 1,
    max: 50,
    step: 1,
    unit: "failures",
  },
  {
    key: "workerInactivityHours",
    label: "Worker Inactivity Threshold",
    description: "Hours of no successful backfill run before triggering an alert",
    detail: "If the backfill worker hasn't completed a successful run in this many hours, a warning alert fires. Helps detect when the worker process has stopped.",
    icon: "⏰",
    min: 0.5,
    max: 168,
    step: 0.5,
    unit: "hours",
  },
  {
    key: "backlogThreshold",
    label: "Backlog Size Threshold",
    description: "Number of unprocessed items before triggering a backlog alert",
    detail: "When items missing AI embeddings exceed this count, an info alert fires. Useful for monitoring if backfill is keeping up with new items.",
    icon: "📦",
    min: 10,
    max: 100000,
    step: 100,
    unit: "items",
  },
];

// ── Component ──

export default function AlertThresholdsPage() {
  const [thresholds, setThresholds] = useState<AlertThresholds | null>(null);
  const [draft, setDraft] = useState<AlertThresholds | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isDirty = !!(draft && thresholds && THRESHOLD_CONFIGS.some(
    (cfg) => draft[cfg.key] !== thresholds[cfg.key]
  ));

  // Load thresholds on mount
  const fetchThresholds = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/alert-thresholds");
      if (!res.ok) throw new Error("Failed to load thresholds");
      const data = await res.json();
      setThresholds(data.thresholds);
      setDraft(data.thresholds);
    } catch (err) {
      console.error("Failed to load thresholds:", err);
      toast.error("Failed to load alert thresholds", {
        duration: 4000,
        style: { background: "hsl(0 63% 6%)", border: "1px solid hsl(0 63% 31%)" },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchThresholds();
  }, [fetchThresholds]);

  // Update a single threshold value
  const update = (key: keyof AlertThresholds, value: number) => {
    if (!draft) return;
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  // Save thresholds
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/alert-thresholds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thresholds: draft }),
      });

      if (!res.ok) throw new Error("Failed to save");

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Save failed");

      // Use the sanitized values returned from server
      setThresholds(data.thresholds);
      setDraft(data.thresholds);

      toast.success("Alert thresholds saved!", {
        duration: 3000,
        style: { background: "hsl(142 76% 6%)", border: "1px solid hsl(142 76% 36%)" },
      });
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

  // Reset to defaults
  const resetToDefaults = async () => {
    setShowResetConfirm(false);
    setSaving(true);
    try {
      const res = await fetch("/api/settings/alert-thresholds", {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to reset");

      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Reset failed");

      setThresholds(data.thresholds);
      setDraft(data.thresholds);

      toast.success("Reset to default thresholds", {
        duration: 3000,
        style: { background: "hsl(142 76% 6%)", border: "1px solid hsl(142 76% 36%)" },
      });
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
      <div className="space-y-8">
        <div className="h-8 w-64 skeleton rounded-lg" />
        <div className="h-5 w-96 skeleton rounded" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error State ──
  if (!draft) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold gradient-text">Alert Thresholds</h1>
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Could not load thresholds</h2>
          <p className="text-muted-foreground mb-6">Make sure Redis is running and try again.</p>
          <button
            onClick={() => { setLoading(true); fetchThresholds(); }}
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
          <h1 className="text-2xl font-bold gradient-text">Alert Thresholds</h1>
          <p className="text-muted-foreground mt-1">
            Configure when system alerts are triggered
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && (
            <span className="text-xs text-yellow-400 font-medium">Unsaved changes</span>
          )}

          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            className="px-4 py-2.5 glass-card hover:bg-card/70 text-muted-foreground hover:text-foreground rounded-xl transition-all text-sm"
          >
            🔄 Reset to Defaults
          </button>

          <button
            onClick={save}
            disabled={saving || !isDirty}
            className="px-5 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:bg-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all text-sm"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* ── Threshold Cards ── */}
      <div className="space-y-4">
        {THRESHOLD_CONFIGS.map((config) => (
          <div key={config.key} className="glass-card p-6 rounded-2xl">
            <div className="flex items-start gap-4">
              <span className="text-2xl mt-1">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="font-semibold">{config.label}</h3>
                    <p className="text-xs text-muted-foreground">{config.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <input
                      type="number"
                      min={config.min}
                      max={config.max}
                      step={config.step}
                      value={draft[config.key]}
                      onChange={(e) => update(config.key, parseFloat(e.target.value) || config.min)}
                      className="w-24 px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm font-mono text-right focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
                    />
                    <span className="text-xs text-muted-foreground w-12">{config.unit}</span>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={config.min}
                  max={config.max}
                  step={config.step}
                  value={draft[config.key]}
                  onChange={(e) => update(config.key, parseFloat(e.target.value))}
                  className="w-full mt-3 h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-nexus-500
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-nexus-500
                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-nexus-500/30
                    [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:transition-transform
                    [&::-webkit-slider-thumb]:hover:scale-110
                    [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full
                    [&::-moz-range-thumb]:bg-nexus-500 [&::-moz-range-thumb]:border-0
                    [&::-moz-range-thumb]:cursor-pointer"
                />

                <p className="text-xs text-muted-foreground/60 mt-2">{config.detail}</p>
              </div>
            </div>

            {/* Range labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-1 ml-12">
              <span>{config.min}</span>
              <span>{config.max}</span>
            </div>
          </div>
        ))}
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
              This will reset all alert thresholds to their factory defaults:
            </p>
            <ul className="text-sm space-y-2 mb-6">
              <li className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <span>🔴</span>
                <span className="text-muted-foreground">Failure threshold:</span>
                <span className="font-mono font-medium ml-auto">3 failures</span>
              </li>
              <li className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <span>⏰</span>
                <span className="text-muted-foreground">Inactivity threshold:</span>
                <span className="font-mono font-medium ml-auto">2 hours</span>
              </li>
              <li className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <span>📦</span>
                <span className="text-muted-foreground">Backlog threshold:</span>
                <span className="font-mono font-medium ml-auto">1,000 items</span>
              </li>
            </ul>
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
            href="/settings/general"
            className="flex items-center gap-3 p-4 bg-muted/20 hover:bg-muted/40 rounded-xl transition-all group"
          >
            <span className="text-2xl">🔔</span>
            <div>
              <p className="text-sm font-medium group-hover:text-nexus-400 transition-colors">
                Notification Preferences
              </p>
              <p className="text-xs text-muted-foreground">
                Control which alerts trigger which notification channels
              </p>
            </div>
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">→</span>
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
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">→</span>
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
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">→</span>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground/50">
        Thresholds are stored in Redis and take effect on the next alert evaluation cycle
      </div>
    </div>
  );
}
