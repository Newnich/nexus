"use client";

import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex items-center gap-4 h-full px-6 ml-60">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="text-foreground font-medium">NEXUS</span>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1 max-w-xl ml-auto">
          <div
            className={cn(
              "relative flex items-center transition-all duration-200",
              isFocused && "scale-[1.02]"
            )}
          >
            <span className="absolute left-3 text-muted-foreground">⌕</span>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder='Search your knowledge... (⌘K)'
              className={cn(
                "w-full pl-10 pr-12 py-2 bg-muted border border-border rounded-xl text-sm",
                "focus:outline-none focus:ring-2 focus:ring-nexus-500/30 focus:border-nexus-500/50",
                "placeholder:text-muted-foreground/50 transition-all"
              )}
            />
            <div className="absolute right-3 flex items-center gap-1">
              <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 bg-background border border-border rounded text-[10px] text-muted-foreground">
                ⌘K
              </kbd>
            </div>
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <span>🔔</span>
          </button>
          <button className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
            <span>⚙</span>
          </button>
        </div>
      </div>
    </header>
  );
}
