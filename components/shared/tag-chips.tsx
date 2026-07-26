"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { hashTagToColor } from "@/lib/tag-colors";

interface TagChipsProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  maxTags?: number;
  className?: string;
  tagColors?: Record<string, string>;
}

export function TagChips({
  tags,
  onChange,
  placeholder = "Type a tag and press Enter",
  disabled = false,
  maxTags = 20,
  className,
  tagColors = {},
}: TagChipsProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = useCallback(
    (raw: string) => {
      const parts = raw
        .toLowerCase()
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);
      const newTags = [...tags];
      for (const part of parts) {
        const cleaned = part.replace(/[^a-z0-9-_]/g, "");
        if (cleaned && !newTags.includes(cleaned) && newTags.length < maxTags) {
          newTags.push(cleaned);
        }
      }
      onChange(newTags);
      setInput("");
    },
    [tags, onChange, maxTags],
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(tags.filter((t) => t !== tag));
    },
    [tags, onChange],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
    } else if (e.key === "Backspace" && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 px-3 py-2.5 bg-muted border border-border rounded-xl transition-all",
        "focus-within:ring-2 focus-within:ring-nexus-500/50 focus-within:border-nexus-500",
        disabled && "opacity-50 cursor-not-allowed",
        className,
      )}
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => {
        const color = tagColors[tag] || hashTagToColor(tag);
        return (
          <span
            key={tag}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs"
            style={{
              backgroundColor: color + "20",
              color: color,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: color }}
            />
            #{tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="hover:text-red-400 transition-colors text-[10px]"
              >
                ✕
              </button>
            )}
          </span>
        );
      })}
      {!disabled && tags.length < maxTags && (
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/50"
          disabled={disabled}
        />
      )}
    </div>
  );
}
