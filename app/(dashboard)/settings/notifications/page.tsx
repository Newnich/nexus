"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";

// ── Types ──

interface TestResult {
  channel: "slack" | "discord";
  sent: boolean;
  alertId: string;
  error?: string;
}

interface HistoryEntry {
  channel: "slack" | "discord" | "email";
  type: "alert" | "test";
  sent: boolean;
  alertId?: string;
  error?: string;
  timestamp: string;
}

interface SlackConfig {
  configured: boolean;
  urlPreview: string | null;
}

interface DiscordConfig {
  configured: boolean;
  urlPreview: string | null;
}

interface EmailConfig {
  configured: boolean;
  recipient: string | null;
  from: string | null;
}

interface ChannelStatus {
  slack: SlackConfig | null;
  discord: DiscordConfig | null;
  email: EmailConfig | null;
}

// ── Helpers ──

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelIcon(channel: string): string {
  switch (channel) {
    case "slack": return "💬";
    case "discord": return "🎮";
    case "email": return "📧";
    default: return "🔔";
  }
}

function channelLabel(channel: string): string {
  switch (channel) {
    case "slack": return "Slack";
    case "discord": return "Discord";
    case "email": return "Email";
    default: return channel;
  }
}

// ── Component ──

export default function NotificationSettingsPage() {
  const [channelStatus, setChannelStatus] = useState<ChannelStatus | null>(null);
  const [testing, setTesting] = useState<"slack" | "discord" | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Fetch channel configuration status
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/status");
      if (!res.ok) return;
      const data = await res.json();

      setChannelStatus({
        slack: data.config
          ? {
              configured: data.config.slackWebhookUrl ? true : false,
              urlPreview: data.config.slackWebhookUrl || null,
            }
          : null,
        discord: data.config
          ? {
              configured: data.config.discordWebhookUrl ? true : false,
              urlPreview: data.config.discordWebhookUrl || null,
            }
          : null,
        email: data.config
          ? {
              configured: data.config.resendApiKey ? true : false,
              recipient: data.config.alertEmailTo || null,
              from: data.config.alertEmailFrom || null,
            }
          : null,
      });
    } catch {
      // Best-effort
    }
  }, []);

  // Fetch notification history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/history?limit=50");
      if (!res.ok) throw new Error("Failed to load history");
      const data = await res.json();
      setHistory(data.history || []);
    } catch {
      // Best-effort
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchHistory();
  }, [fetchStatus, fetchHistory]);

  // Send test notification
  const sendTest = async (channel: "slack" | "discord") => {
    setTesting(channel);
    setTestResults((prev) => ({ ...prev, [channel + "-pending"]: { channel, sent: false, alertId: "pending" } }));

    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });

      const data = await res.json();
      const result: TestResult = data.result || { channel, sent: false, alertId: "test", error: "No result" };

      setTestResults((prev) => {
        const next = { ...prev };
        delete next[channel + "-pending"];
        next[channel] = result;
        return next;
      });

      if (result.sent) {
        toast.success(`${channel === "slack" ? "Slack" : "Discord"} test sent successfully!`, {
          duration: 4000,
          style: {
            background: "hsl(142 76% 6%)",
            border: "1px solid hsl(142 76% 36%)",
          },
        });
      } else {
        toast.error(`${channel === "slack" ? "Slack" : "Discord"} test failed: ${result.error}`, {
          duration: 6000,
          style: {
            background: "hsl(0 63% 6%)",
            border: "1px solid hsl(0 63% 31%)",
          },
        });
      }

      // Refresh history after sending
      fetchHistory();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[channel + "-pending"];
        next[channel] = { channel, sent: false, alertId: "test", error: msg };
        return next;
      });
      toast.error(`Test failed: ${msg}`, {
        duration: 6000,
        style: {
          background: "hsl(0 63% 6%)",
          border: "1px solid hsl(0 63% 31%)",
        },
      });
    } finally {
      setTesting(null);
    }
  };

  // Get latest result for a channel
  const getResult = (channel: string): TestResult | null => {
    return testing === channel
      ? { channel: channel as "slack" | "discord", sent: false, alertId: "sending" }
      : testResults[channel] || null;
  };

  const slack = channelStatus?.slack;
  const discord = channelStatus?.discord;
  const email = channelStatus?.email;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold gradient-text">Notification Settings</h1>
        <p className="text-muted-foreground mt-1">
          Configure and test your notification channels for system alerts
        </p>
      </div>

      {/* ── Slack Card ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">💬</span>
          <div>
            <h2 className="font-semibold">Slack</h2>
            <p className="text-xs text-muted-foreground">
              Incoming webhook for posting alert messages to a Slack channel
            </p>
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
            slack?.configured
              ? "bg-green-500/10 text-green-400"
              : "bg-muted text-muted-foreground"
          }`}>
            {slack?.configured ? "Configured" : "Not configured"}
          </span>
        </div>

        <div className="p-3 bg-muted/20 rounded-xl mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
              <p className="text-sm font-mono">
                {slack?.urlPreview ? (
                  <span className="text-green-400/80">{slack.urlPreview}</span>
                ) : (
                  <span className="text-muted-foreground/60 italic">
                    Set <code className="text-xs bg-muted px-1 py-0.5 rounded">SLACK_WEBHOOK_URL</code> in your environment
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Test Result */}
        {getResult("slack") && (
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            getResult("slack")!.sent
              ? "bg-green-500/10 text-green-400"
              : getResult("slack")!.alertId === "sending"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-red-500/10 text-red-400"
          }`}>
            <span>{getResult("slack")!.sent ? "✅" : getResult("slack")!.alertId === "sending" ? "⏳" : "❌"}</span>
            <span>
              {getResult("slack")!.sent
                ? "Test notification sent successfully!"
                : getResult("slack")!.alertId === "sending"
                  ? "Sending test..."
                  : `Failed: ${getResult("slack")!.error}`}
            </span>
          </div>
        )}

        <button
          onClick={() => sendTest("slack")}
          disabled={testing === "slack" || !slack?.configured}
          className="px-5 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:bg-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all text-sm"
        >
          {testing === "slack" ? "Sending..." : "Send Test to Slack"}
        </button>
      </div>

      {/* ── Discord Card ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">🎮</span>
          <div>
            <h2 className="font-semibold">Discord</h2>
            <p className="text-xs text-muted-foreground">
              Webhook for posting alert messages to a Discord channel
            </p>
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
            discord?.configured
              ? "bg-green-500/10 text-green-400"
              : "bg-muted text-muted-foreground"
          }`}>
            {discord?.configured ? "Configured" : "Not configured"}
          </span>
        </div>

        <div className="p-3 bg-muted/20 rounded-xl mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Webhook URL</p>
              <p className="text-sm font-mono">
                {discord?.urlPreview ? (
                  <span className="text-green-400/80">{discord.urlPreview}</span>
                ) : (
                  <span className="text-muted-foreground/60 italic">
                    Set <code className="text-xs bg-muted px-1 py-0.5 rounded">DISCORD_WEBHOOK_URL</code> in your environment
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Test Result */}
        {getResult("discord") && (
          <div className={`mb-4 p-3 rounded-xl text-sm flex items-center gap-2 ${
            getResult("discord")!.sent
              ? "bg-green-500/10 text-green-400"
              : getResult("discord")!.alertId === "sending"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-red-500/10 text-red-400"
          }`}>
            <span>{getResult("discord")!.sent ? "✅" : getResult("discord")!.alertId === "sending" ? "⏳" : "❌"}</span>
            <span>
              {getResult("discord")!.sent
                ? "Test notification sent successfully!"
                : getResult("discord")!.alertId === "sending"
                  ? "Sending test..."
                  : `Failed: ${getResult("discord")!.error}`}
            </span>
          </div>
        )}

        <button
          onClick={() => sendTest("discord")}
          disabled={testing === "discord" || !discord?.configured}
          className="px-5 py-2.5 bg-nexus-500 hover:bg-nexus-600 disabled:bg-muted disabled:text-muted-foreground text-white font-medium rounded-xl transition-all text-sm"
        >
          {testing === "discord" ? "Sending..." : "Send Test to Discord"}
        </button>
      </div>

      {/* ── Email Card ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center gap-3 mb-5">
          <span className="text-2xl">📧</span>
          <div>
            <h2 className="font-semibold">Email (Resend)</h2>
            <p className="text-xs text-muted-foreground">
              Transactional emails for critical alerts via Resend
            </p>
          </div>
          <span className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
            email?.configured
              ? "bg-green-500/10 text-green-400"
              : "bg-muted text-muted-foreground"
          }`}>
            {email?.configured ? "Configured" : "Not configured"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/20 rounded-xl mb-2">
          <div>
            <p className="text-xs text-muted-foreground mb-1">API Key</p>
            <p className="text-sm">
              {email?.configured
                ? <span className="text-green-400/80">••••••••</span>
                : <span className="text-muted-foreground/60 italic">Not set</span>
              }
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Recipient</p>
            <p className="text-sm font-mono">
              {email?.recipient || <span className="text-muted-foreground/60 italic">Not set</span>}
            </p>
          </div>
        </div>
        <div className="p-3 bg-muted/20 rounded-xl">
          <p className="text-xs text-muted-foreground mb-1">From Address</p>
          <p className="text-sm font-mono">
            {email?.from || <span className="text-muted-foreground/60 italic">Default: alerts@nexus.app</span>}
          </p>
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          Configure via <code className="text-xs bg-muted px-1 py-0.5 rounded">RESEND_API_KEY</code>,{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">ALERT_EMAIL_TO</code>, and{' '}
          <code className="text-xs bg-muted px-1 py-0.5 rounded">ALERT_EMAIL_FROM</code> in your environment.
        </p>
      </div>

      {/* ── Environment Setup Guide ── */}
      <details className="glass-card p-6 rounded-2xl group">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          📋 Environment Variable Reference
        </summary>
        <div className="mt-4 space-y-3 text-sm">
          <div className="p-3 bg-muted/20 rounded-xl">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-nexus-400">SLACK_WEBHOOK_URL</code>
            <p className="text-xs text-muted-foreground mt-1">
              Slack incoming webhook URL. Create one at Slack App &gt; Incoming Webhooks.
            </p>
          </div>
          <div className="p-3 bg-muted/20 rounded-xl">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-nexus-400">DISCORD_WEBHOOK_URL</code>
            <p className="text-xs text-muted-foreground mt-1">
              Discord webhook URL. Create one in Server Settings &gt; Integrations &gt; Webhooks.
            </p>
          </div>
          <div className="p-3 bg-muted/20 rounded-xl">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-nexus-400">RESEND_API_KEY</code>
            <p className="text-xs text-muted-foreground mt-1">
              Resend API key for sending emails. Get one at resend.com/api-keys.
            </p>
          </div>
          <div className="p-3 bg-muted/20 rounded-xl">
            <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-nexus-400">ALERT_EMAIL_TO</code>
            <p className="text-xs text-muted-foreground mt-1">
              Email address that receives alert notifications.
            </p>
          </div>
        </div>
      </details>

      {/* ── Notification History ── */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📜</span>
            <div>
              <h2 className="font-semibold">Notification History</h2>
              <p className="text-xs text-muted-foreground">
                Recent notifications sent to your channels
              </p>
            </div>
          </div>
          <button
            onClick={() => { setHistoryLoading(true); fetchHistory(); }}
            className="flex items-center gap-2 px-3 py-1.5 glass-card hover:bg-card/70 rounded-lg text-xs transition-all"
          >
            ⟳ Refresh
          </button>
        </div>

        {historyLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 skeleton rounded-xl" />
            ))}
          </div>
        ) : history.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-3xl mb-3">🔕</p>
            <p className="text-sm text-muted-foreground">No notifications sent yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Test your Slack or Discord configuration above to see results here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-2 text-xs text-muted-foreground font-medium">
              <span>Time</span>
              <span>Channel</span>
              <span>Type</span>
              <span>Status</span>
            </div>
            <div className="divide-y divide-border/30">
              {history.map((entry, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_auto_auto] gap-3 px-4 py-3 text-sm hover:bg-muted/20 transition-colors rounded-lg items-center"
                >
                  <span className="text-xs text-muted-foreground font-mono" title={entry.timestamp}>
                    {timeAgo(entry.timestamp)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span>{channelIcon(entry.channel)}</span>
                    <span>{channelLabel(entry.channel)}</span>
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    entry.type === "alert"
                      ? "bg-amber-500/10 text-amber-400"
                      : "bg-blue-500/10 text-blue-400"
                  }`}>
                    {entry.type === "alert" ? "Alert" : "Test"}
                  </span>
                  <span className={`text-xs flex items-center gap-1 ${
                    entry.sent ? "text-green-400" : "text-red-400"
                  }`}>
                    <span>{entry.sent ? "✅" : "❌"}</span>
                    <span className="hidden md:inline">{entry.sent ? "Sent" : entry.error ? "Failed" : "Error"}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-muted-foreground/50">
        Notification channels are configured via environment variables · Changes require a server restart
      </div>
    </div>
  );
}
