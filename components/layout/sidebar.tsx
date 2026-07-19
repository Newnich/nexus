"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◈" },
  { href: "/items", label: "Items", icon: "⊞" },
  { href: "/collections", label: "Collections", icon: "▦" },
  { href: "/search", label: "Search", icon: "⌕" },
  { href: "/graph", label: "Graph", icon: "⬡" },
];

const quickLinks = [
  { href: "/items/new", label: "New Item", icon: "+", primary: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full z-40 flex flex-col border-r border-border bg-background/80 backdrop-blur-xl transition-all duration-300",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="text-2xl">⟠</span>
          {!collapsed && (
            <span className="font-bold gradient-text text-lg">NEXUS</span>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
        >
          {collapsed ? "→" : "←"}
        </button>
      </div>

      {/* Quick Action */}
      <div className="p-3">
        <Link
          href="/items/new"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 bg-nexus-500 hover:bg-nexus-600 text-white font-medium rounded-lg transition-all",
            collapsed && "justify-center px-0"
          )}
        >
          <span className="text-lg">+</span>
          {!collapsed && <span className="text-sm">Save to NEXUS</span>}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm",
                isActive
                  ? "bg-nexus-500/10 text-nexus-400 font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                collapsed && "justify-center px-0"
              )}
            >
              <span className="text-base">{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-nexus-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-border">
        <div className={cn(
          "flex items-center gap-3 px-3 py-2",
          collapsed && "justify-center"
        )}>
          <div className="w-8 h-8 rounded-full bg-nexus-500/20 flex items-center justify-center text-sm font-medium text-nexus-400">
            U
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">User</p>
              <p className="text-xs text-muted-foreground">Free Plan</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
