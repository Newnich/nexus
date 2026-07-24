"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import { cn, validatedFetcher } from "@/lib/utils";
import { ItemsResponseSchema } from "@/lib/schemas";

// ── Types ──
interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  section: "navigation" | "actions" | "recent";
  href?: string;
  action?: () => void;
  keywords?: string;
}

// ── Navigation commands ──
const NAV_COMMANDS: Command[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Home overview",
    icon: "◈",
    section: "navigation",
    href: "/dashboard",
    keywords: "home main",
  },
  {
    id: "items",
    label: "Items",
    description: "All saved items",
    icon: "⊞",
    section: "navigation",
    href: "/items",
    keywords: "links notes files",
  },
  {
    id: "collections",
    label: "Collections",
    description: "Organize items",
    icon: "▦",
    section: "navigation",
    href: "/collections",
    keywords: "folders groups",
  },
  {
    id: "search",
    label: "Search",
    description: "Find anything",
    icon: "⌕",
    section: "navigation",
    href: "/search",
    keywords: "find query",
  },
  {
    id: "graph",
    label: "Graph",
    description: "Knowledge connections",
    icon: "⬡",
    section: "navigation",
    href: "/graph",
    keywords: "map visualize",
  },
  {
    id: "status",
    label: "System Status",
    description: "Monitor services",
    icon: "⚙",
    section: "navigation",
    href: "/status",
    keywords: "health queue",
  },
  {
    id: "settings",
    label: "Settings",
    description: "General preferences",
    icon: "🔧",
    section: "navigation",
    href: "/settings/general",
    keywords: "preferences config",
  },
  {
    id: "alerts",
    label: "Alert Settings",
    description: "Configure alert thresholds",
    icon: "🔔",
    section: "navigation",
    href: "/settings/alerts",
    keywords: "thresholds notifications",
  },
  {
    id: "channels",
    label: "Channel Config",
    description: "Webhook & email settings",
    icon: "📡",
    section: "navigation",
    href: "/settings/notifications",
    keywords: "slack discord email",
  },
  {
    id: "cooldown",
    label: "Cooldown Settings",
    description: "Notification cooldown periods",
    icon: "⏳",
    section: "navigation",
    href: "/settings/cooldown",
    keywords: "rate limit delay",
  },
];

const ACTION_COMMANDS: Command[] = [
  {
    id: "new-link",
    label: "Save Link",
    description: "Save a webpage or article",
    icon: "🔗",
    section: "actions",
    href: "/items/new",
    keywords: "bookmark url add",
  },
  {
    id: "new-note",
    label: "Write Note",
    description: "Write your own thoughts",
    icon: "📝",
    section: "actions",
    href: "/items/new?type=note",
    keywords: "create text",
  },
  {
    id: "new-file",
    label: "Upload File",
    description: "Upload a document or image",
    icon: "📄",
    section: "actions",
    href: "/items/new?type=file",
    keywords: "upload document",
  },
];

// ── Fuzzy matching score ──
function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (t === q) return 100;
  if (t.startsWith(q)) return 80;
  if (t.includes(q)) return 60;
  // Character-by-character fuzzy matching
  let qi = 0;
  let score = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += 10;
      qi++;
    }
  }
  if (qi === q.length) return score;
  return 0;
}

// ── Recent Items (fetched from API) ──
interface RecentItem {
  id: string;
  title: string;
  type: string;
  icon: string;
}

function useRecentItems() {
  const [items, setItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    let mounted = true;
    async function loadItems() {
      try {
        const data = await validatedFetcher(
          "/api/items?limit=5&sort=updated_at",
          ItemsResponseSchema,
        );
        if (!mounted) return;
        const typeIcons: Record<string, string> = {
          link: "🔗",
          note: "📝",
          file: "📄",
          image: "🖼",
          screenshot: "📸",
          voice_memo: "🎤",
          pdf: "📕",
          video: "🎬",
        };
        setItems(
          (data.items ?? []).map((i) => ({
            id: i.id,
            title: i.title || "Untitled",
            type: i.type,
            icon: typeIcons[i.type] || "📄",
          })),
        );
      } catch {}
    }
    loadItems();
    return () => {
      mounted = false;
    };
  }, []);

  return items;
}

// ── Component ──
export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const recentItems = useRecentItems();

  // Build all commands including recent items
  const allCommands = useMemo(() => {
    const recentCommands: Command[] = recentItems.map((item) => ({
      id: `item-${item.id}`,
      label: item.title,
      description: item.type,
      icon: item.icon,
      section: "recent" as const,
      href: `/items/${item.id}`,
    }));
    return [...NAV_COMMANDS, ...ACTION_COMMANDS, ...recentCommands];
  }, [recentItems]);

  // Filtered + scored commands
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      // Show all, grouped by section order
      return allCommands;
    }
    const scored = allCommands
      .map((cmd) => {
        const text = `${cmd.label} ${cmd.description || ""} ${cmd.keywords || ""}`;
        return { cmd, score: scoreMatch(query, text) };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ cmd }) => cmd);
  }, [query, allCommands]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Open/close with Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          setIsOpen(false);
        } else {
          setIsOpen(true);
          setQuery("");
        }
      }
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Close on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) return;
    const items = listRef.current.querySelectorAll("[data-command-item]");
    if (items[selectedIndex]) {
      items[selectedIndex].scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const executeCommand = useCallback(
    (cmd: Command) => {
      setIsOpen(false);
      if (cmd.action) {
        cmd.action();
      } else if (cmd.href) {
        router.push(cmd.href);
      }
    },
    [router],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        break;
      case "Enter":
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex]);
        }
        break;
      case "Tab":
        e.preventDefault();
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Group commands by section for display
  const groupedCommands = useMemo(() => {
    const groups: { section: string; commands: Command[] }[] = [];
    const sectionOrder = ["navigation", "actions", "recent"];
    const sectionLabels: Record<string, string> = {
      navigation: "Navigate",
      actions: "Actions",
      recent: "Recent Items",
    };
    for (const section of sectionOrder) {
      const cmds = filteredCommands.filter((c) => c.section === section);
      if (cmds.length > 0) {
        groups.push({ section: sectionLabels[section] || section, commands: cmds });
      }
    }
    return groups;
  }, [filteredCommands]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
      />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg glass-card rounded-2xl overflow-hidden shadow-2xl border-nexus-500/20 animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
          <span className="text-muted-foreground text-lg">⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions, and items..."
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground/40"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] text-muted-foreground font-mono">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2 space-y-1">
          {groupedCommands.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2">🔍</div>
              <p className="text-sm text-muted-foreground">No results for &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            groupedCommands.map((group) => (
              <div key={group.section}>
                <div className="px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.section}
                </div>
                {group.commands.map((cmd, localIdx) => {
                  const globalIdx = filteredCommands.indexOf(cmd);
                  const isSelected = globalIdx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-command-item
                      onClick={() => executeCommand(cmd)}
                      onMouseEnter={() => setSelectedIndex(globalIdx)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left",
                        isSelected
                          ? "bg-nexus-500/15 text-nexus-400"
                          : "hover:bg-muted/50 text-foreground",
                      )}
                    >
                      <span className="text-lg shrink-0">{cmd.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className={cn("font-medium truncate", isSelected && "text-nexus-400")}>
                          {cmd.label}
                        </p>
                        {cmd.description && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {cmd.description}
                          </p>
                        )}
                      </div>
                      {cmd.href && (
                        <kbd className="shrink-0 px-1.5 py-0.5 bg-muted border border-border rounded text-[9px] text-muted-foreground font-mono hidden sm:inline">
                          ↵
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-border/50">
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[8px]">↑↓</kbd>{" "}
            Navigate
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[8px]">↵</kbd>{" "}
            Open
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <kbd className="px-1 py-0.5 bg-muted border border-border rounded text-[8px]">⌘K</kbd>{" "}
            Toggle
          </span>
        </div>
      </div>
    </div>
  );
}
