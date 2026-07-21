import { highlightMatches } from "@/lib/utils";

/**
 * Render highlighted text as React elements with <mark> tags.
 * Matching segments are highlighted with the nexus brand color.
 * Use: <>{renderHighlighted(text, query)}</>
 */
export function renderHighlighted(text: string, query: string) {
  if (!query.trim()) return text;
  const segments = highlightMatches(text, query);
  return segments.map((seg, i) =>
    seg.highlight ? (
      <mark key={i} className="bg-nexus-500/20 text-nexus-300 rounded-sm px-0.5">
        {seg.text}
      </mark>
    ) : (
      <span key={i}>{seg.text}</span>
    )
  );
}
