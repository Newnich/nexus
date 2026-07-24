"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { z } from "zod";
import { validatedFetcher } from "@/lib/utils";
import { useApiData } from "@/lib/hooks/use-api-data";
import { CooldownConfigResponseSchema, CooldownConfigSchema } from "@/lib/schemas";
import { PageSkeleton } from "@/components/page-skeleton";

// ── Types ──

interface CooldownConfig {
  slack: number;
  discord: number;
  email: number;
}

interface ChannelCooldownConfig {
  key: keyof CooldownConfig;
  label: string;
  description: string;
  detail: string;
  icon: string;
  min: number;
  max: number;
  step: number;
}

// ── Constants ──

const CHANNEL_CONFIGS: ChannelCooldownConfig[] = [
  {
    key: "slack",
    label: "Slack Cooldown",
    description: "How long to wait before sending another Slack notification for the same alert",
    detail:
      "Prevents alert fatigue by enforcing a minimum gap between repeated Slack notifications for the same alert ID.",
    icon: "💬",
    min: 1,
    max: 1440,
    step: 5,
  },
  {
    key: "discord",
    label: "Discord Cooldown",
    description: "How long to wait before sending another Discord notification for the same alert",
    detail:
      "Prevents alert fatigue by enforcing a minimum gap between repeated Discord notifications for the same alert ID.",
    icon: "🎮",
    min: 1,
    max: 1440,
    step: 5,
  },
  {
    key: "email",
    label: "Email Cooldown",
    description: "How long to wait before sending another email notification for the same alert",
    detail:
      "Prevents alert fatigue by enforcing a minimum gap between repeated email notifications for the same alert ID.",
    icon: "📧",
    min: 1,
    max: 1440,
    step: 5,
  },
];

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ── Component ──

export default function CooldownSettingsPage() {
  const [config, setConfig] = useState<CooldownConfig | null>(null);
  const [draft, setDraft] = useState<CooldownConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const isDirty = !!(
    draft &&
    config &&
    CHANNEL_CONFIGS.some((cfg) => draft[cfg.key] !== config[cfg.key])
  );

  // Load config via useApiData hook
  const {
    data,
    loading,
    error,
    refetch: refetchConfig,
  } = useApiData("/api/settings/cooldown", CooldownConfigResponseSchema);

  // Sync loaded data into config + draft
  useEffect(() => {
    if (data?.cooldown) {
      const c = data.cooldown as CooldownConfig;
      setConfig(c);
      setDraft(c);
    }
  }, [data]);

  // Show error toast on fetch failure
  useEffect(() => {
    if (error) {
      toast.error("Failed to load cooldown configuration", {
        duration: 4000,
        style: { background: "hsl(0 63% 6%)", border: "1px solid hsl(0 63% 31%)" },
      });
    }
  }, [error]);

  // Update a single channel value
  const update = (key: keyof CooldownConfig, value: number) => {
    if (!draft) return;
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  // Save configuration
  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const data = await validatedFetcher(
        "/api/settings/cooldown",
        z.object({
          success: z.boolean(),
          cooldown: CooldownConfigSchema,
          error: z.string().optional(),
        }),
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cooldown: draft }),
        },
      );

      if (!data.success) throw new Error(data.error || "Save failed");

      setConfig(data.cooldown as CooldownConfig);
      setDraft(data.cooldown as CooldownConfig);

      toast.success("Cooldown settings saved!", {
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
      const data = await validatedFetcher(
        "/api/settings/cooldown",
        z.object({
          success: z.boolean(),
          cooldown: CooldownConfigSchema,
          error: z.string().optional(),
        }),
        { method: "DELETE" },
      );

      if (!data.success) throw new Error(data.error || "Reset failed");

      setConfig(data.cooldown as CooldownConfig);
      setDraft(data.cooldown as CooldownConfig);

      toast.success("Reset to default cooldown periods", {
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
      <PageSkeleton titleWidth="w-64" subtitleWidth="w-96">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 skeleton rounded-2xl" />
          ))}
        </div>
      </PageSkeleton>
    );
  }

  // ── Error State ──
  if (!draft) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold gradient-text">Cooldown Settings</h1>
        <div className="glass-card p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold mb-2">Could not load cooldown config</h2>
          <p className="text-muted-foreground mb-6">Make sure Redis is running and try again.</p>
          <button
            onClick={refetchConfig}
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
          <h1 className="text-2xl font-bold gradient-text">Cooldown Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure how long to wait before re-sending a notification for the same alert
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDirty && <span className="text-xs text-yellow-400 font-medium">Unsaved changes</span>}

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

      {/* ── Cooldown Cards ── */}
      <div className="space-y-4">
        {CHANNEL_CONFIGS.map((cfg) => (
          <div key={cfg.key} className="glass-card p-6 rounded-2xl">
            <div className="flex items-start gap-4">
              <span className="text-2xl mt-1">{cfg.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <h3 className="font-semibold">{cfg.label}</h3>
                    <p className="text-xs text-muted-foreground">{cfg.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <input
                      type="number"
                      min={cfg.min}
                      max={cfg.max}
                      step={cfg.step}
                      value={draft[cfg.key]}
                      onChange={(e) => update(cfg.key, parseInt(e.target.value) || cfg.min)}
                      className="w-24 px-3 py-2 bg-muted/50 border border-border rounded-xl text-sm font-mono text-right focus:outline-none focus:border-nexus-500/50 focus:ring-1 focus:ring-nexus-500/20 transition-all"
                    />
                    <span className="text-xs text-muted-foreground w-10">min</span>
                  </div>
                </div>

                {/* Slider */}
                <input
                  type="range"
                  min={cfg.min}
                  max={cfg.max}
                  step={cfg.step}
                  value={draft[cfg.key]}
                  onChange={(e) => update(cfg.key, parseInt(e.target.value))}
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

                {/* Duration badge */}
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-nexus-500/10 text-nexus-400 font-mono">
                    {formatDuration(draft[cfg.key])}
                  </span>
                  <span className="text-xs text-muted-foreground/60">{cfg.detail}</span>
                </div>
              </div>
            </div>

            {/* Range labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground/40 mt-1 ml-12">
              <span>1 min</span>
              <span>24 hours</span>
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
              This will reset all cooldown periods to their factory defaults of{" "}
              <strong>30 minutes</strong> per channel.
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
            <span className="ml-auto text-muted-foreground group-hover:translate-x-1 transition-transform shrink-0">
              →
            </span>
          </Link>
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
        Cooldown values are stored in minutes and converted to seconds for Redis. Changes take
        effect immediately.
      </div>
    </div>
  );
}
