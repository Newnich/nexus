"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const mobileNavItems = [
  { href: "/dashboard", label: "Home", icon: "◈" },
  { href: "/activity", label: "Activity", icon: "⚡" },
  { href: "/items", label: "Items", icon: "⊞" },
  { href: "/tags", label: "Tags", icon: "🏷️" },
  { href: "/search", label: "Search", icon: "⌕" },
  { href: "/collections", label: "Collections", icon: "▦" },
  { href: "/items/new", label: "New", icon: "+" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 h-16 border-t border-border bg-background/95 backdrop-blur-xl">
      <div className="flex items-center justify-around h-full px-1">
        {mobileNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all min-w-0",
                isActive
                  ? "text-nexus-400"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[9px] font-medium truncate max-w-full">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
