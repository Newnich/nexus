/**
 * Shared tag color utilities.
 *
 * Provides a color palette and deterministic hash-to-color function
 * used by both the tags API (server) and tag-chips component (client).
 */

export const TAG_COLOR_PALETTE = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ef4444",
  "#84cc16",
  "#0ea5e9",
  "#d946ef",
] as const;

/**
 * Deterministically maps a tag name to a color from the palette.
 * Same tag always gets the same color (no persistence needed).
 */
export function hashTagToColor(tag: string): string {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return TAG_COLOR_PALETTE[Math.abs(hash) % TAG_COLOR_PALETTE.length];
}
