"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn, formatDateRelative, validatedFetcher } from "@/lib/utils";
import { AlertsResponseSchema } from "@/lib/schemas";
import { ThemeToggle } from "@/components/theme-toggle";

interface AlertEntry {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  details?: string;
  firstSeen: string;
  lastSeen: string;
  fresh?: boolean;
  dismissed?: boolean;
}

export function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const quickCreateRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const activeAlerts = alerts.filter((a) => !dismissedIds.has(a.id));
  const notificationCount = activeAlerts.filter(
    (a) => a.severity === "critical" || a.severity === "warning",
  ).length;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        router.push("/items/new");
      }
      if (e.key === "Escape") {
        setShowQuickCreate(false);
        setShowNotifications(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quickCreateRef.current && !quickCreateRef.current.contains(e.target as Node)) {
        setShowQuickCreate(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch alerts on mount and poll
  useEffect(() => {
    async function fetchAlerts() {
      try {
        const data = await validatedFetcher("/api/queue/alerts", AlertsResponseSchema);
        setAlerts(data.alerts as AlertEntry[]);
      } catch {
        // Silently fail — alerts are best-effort
      }
    }
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  const dismissAlert = (alertId: string) => {
    setDismissedIds((prev) => new Set(prev).add(alertId));
  };

  const dismissAll = () => {
    setDismissedIds(new Set(alerts.map((a) => a.id)));
  };

  const SEVERITY_STYLES: Record<
    string,
    { icon: string; border: string; bg: string; text: string }
  > = {
    critical: { icon: "🔴", border: "border-red-500/30", bg: "bg-red-500/5", text: "text-red-400" },
    warning: {
      icon: "🟡",
      border: "border-amber-500/30",
      bg: "bg-amber-500/5",
      text: "text-amber-400",
    },
    info: { icon: "🔵", border: "border-blue-500/30", bg: "bg-blue-500/5", text: "text-blue-400" },
  };

  return (
    <header className="sticky top-0 z-30 h-14 md:h-16 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-2 md:gap-4 h-full px-3 md:px-6 md:ml-60">
        {/* Breadcrumb / Title */}
        <div className="flex items-center gap-2 text-sm shrink-0">
          <span className="text-foreground font-semibold hidden sm:inline">⟠ NEXUS</span>
          <span className="text-foreground font-semibold sm:hidden">⟠</span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl">
          <div
            className={cn(
              "relative flex items-center transition-all duration-200",
              isFocused && "scale-[1.02]",
            )}
          >
            <span className="absolute left-3 text-muted-foreground text-sm">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Search..."
              className={cn(
                "w-full pl-8 pr-8 py-1.5 md:py-2 bg-muted border border-border rounded-xl text-xs md:text-sm",
                "focus:outline-none focus:ring-2 focus:ring-nexus-500/30 focus:border-nexus-500/50",
                "placeholder:text-muted-foreground/50 transition-all",
              )}
            />
            <div className="absolute right-2 flex items-center gap-1">
              <kbd className="hidden md:inline-flex items-center gap-1 px-1.5 py-0.5 bg-background border border-border rounded text-[10px] text-muted-foreground font-mono">
                ⌘K
              </kbd>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Theme Toggle */}
          <ThemeToggle />
          <div ref={quickCreateRef} className="relative">
            <button
              onClick={() => setShowQuickCreate(!showQuickCreate)}
              className="flex items-center gap-1 px-2.5 py-1.5 md:px-3 md:py-2 bg-nexus-500 hover:bg-nexus-600 text-white rounded-lg md:rounded-xl text-xs md:text-sm transition-all hover:shadow-lg hover:shadow-nexus-500/25"
            >
              <span>+</span>
              <span className="hidden md:inline text-xs">New</span>
            </button>

            {showQuickCreate && (
              <div className="absolute right-0 top-full mt-1.5 w-48 glass-card rounded-xl overflow-hidden animate-fade-in-up z-50">
                <button
                  onClick={() => {
                    setShowQuickCreate(false);
                    router.push("/items/new");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-all text-sm"
                >
                  <span className="text-lg">🔗</span>
                  <div className="text-left">
                    <p className="font-medium">Save Link</p>
                    <p className="text-[10px] text-muted-foreground">URL or article</p>
                  </div>
                </button>
                <div className="border-t border-border/50" />
                <button
                  onClick={() => {
                    setShowQuickCreate(false);
                    router.push("/items/new?type=note");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-all text-sm"
                >
                  <span className="text-lg">📝</span>
                  <div className="text-left">
                    <p className="font-medium">Write Note</p>
                    <p className="text-[10px] text-muted-foreground">Quick thoughts</p>
                  </div>
                </button>
                <div className="border-t border-border/50" />
                <button
                  onClick={() => {
                    setShowQuickCreate(false);
                    router.push("/items/new?type=file");
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-all text-sm"
                >
                  <span className="text-lg">📄</span>
                  <div className="text-left">
                    <p className="font-medium">Upload File</p>
                    <p className="text-[10px] text-muted-foreground">Document or image</p>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Notifications Dropdown */}
          <div ref={notificationRef} className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "relative p-2 rounded-lg transition-colors",
                showNotifications || notificationCount > 0
                  ? "bg-nexus-500/10 text-nexus-400"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
              title="Notifications & alerts"
            >
              <span className="text-base">{notificationCount > 0 ? "🔔" : "🔕"}</span>
              {notificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {notificationCount > 9 ? "9+" : notificationCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-1.5 w-80 md:w-96 glass-card rounded-xl overflow-hidden animate-fade-in-up z-50 max-h-[70vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">Notifications</span>
                    {notificationCount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-medium">
                        {notificationCount}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {notificationCount > 0 && (
                      <button
                        onClick={dismissAll}
                        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Dismiss all
                      </button>
                    )}
                    <button
                      onClick={() => router.push("/status")}
                      className="text-[10px] text-nexus-400 hover:text-nexus-300 transition-colors"
                    >
                      View all →
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {activeAlerts.length === 0 ? (
                    <div className="text-center py-10">
                      <div className="text-3xl mb-3">✅</div>
                      <p className="text-sm text-muted-foreground">All clear!</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">No active alerts</p>
                    </div>
                  ) : (
                    activeAlerts.map((alert) => {
                      const style = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                      return (
                        <div
                          key={alert.id}
                          className={cn(
                            "flex items-start gap-3 p-3 rounded-xl transition-all group",
                            style.bg,
                            "hover:bg-card/80",
                          )}
                        >
                          <span className="text-sm mt-0.5 shrink-0">{style.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-medium", style.text)}>{alert.message}</p>
                            {alert.details && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                {alert.details}
                              </p>
                            )}
                            <p className="text-[9px] text-muted-foreground/60 mt-1">
                              {formatDateRelative(alert.firstSeen)}
                            </p>
                          </div>
                          <button
                            onClick={() => dismissAlert(alert.id)}
                            className="shrink-0 text-muted-foreground/40 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all text-xs"
                            title="Dismiss"
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-border/50 shrink-0">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      router.push("/status");
                    }}
                    className="w-full text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-1"
                  >
                    Go to System Status →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <button
            onClick={() => router.push("/settings/general")}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Settings"
          >
            <span className="text-base">⚙</span>
          </button>
        </div>
      </div>
    </header>
  );
}
