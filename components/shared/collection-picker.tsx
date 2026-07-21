"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface CollectionOption {
  id: string;
  name: string;
  icon: string;
}

interface CollectionPickerProps {
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  limit?: number;
}

export function CollectionPicker({
  selected,
  onChange,
  placeholder = "Choose collections...",
  disabled = false,
  className,
  limit = 50,
}: CollectionPickerProps) {
  const [collections, setCollections] = useState<CollectionOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fetch collections
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/collections?limit=${limit}`);
        if (!res.ok) return;
        const data = await res.json();
        setCollections(
          (data.collections || []).map((c: { id: string; name: string; icon: string }) => ({
            id: c.id,
            name: c.name,
            icon: c.icon || "▦",
          }))
        );
      } catch {} finally {
        setLoading(false);
      }
    }
    load();
  }, [limit]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", handleClick), 0);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  if (collections.length === 0) return null;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          "w-full flex items-center gap-2 px-4 py-3 bg-muted border border-border rounded-xl text-sm text-left transition-all",
          "hover:border-nexus-500/30",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        {selected.size > 0 ? (
          <span className="text-nexus-400">{selected.size} selected</span>
        ) : loading ? (
          <span className="text-muted-foreground">Loading...</span>
        ) : (
          <span className="text-muted-foreground">{placeholder}</span>
        )}
        <span className="ml-auto text-muted-foreground transition-transform" style={{ transform: isOpen ? "rotate(180deg)" : "" }}>
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-1 left-0 right-0 z-20 glass-card rounded-xl overflow-hidden animate-fade-in-up border border-border/50">
          {collections.length === 0 ? (
            <div className="px-4 py-6 text-center text-xs text-muted-foreground">
              {loading ? "Loading..." : "No collections yet"}
            </div>
          ) : (
            collections.map((col) => {
              const isSelected = selected.has(col.id);
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => toggle(col.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-all",
                    isSelected ? "bg-nexus-500/10 text-nexus-400" : "hover:bg-muted/50"
                  )}
                >
                  <span>{col.icon}</span>
                  <span className="flex-1 text-left">{col.name}</span>
                  {isSelected && <span className="text-nexus-400 text-xs">✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
