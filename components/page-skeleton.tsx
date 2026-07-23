import { type ReactNode } from "react";

interface PageSkeletonProps {
  /** Width of the page title skeleton (default: "w-48") */
  titleWidth?: string;
  /** Width of the subtitle skeleton (default: "w-64") */
  subtitleWidth?: string;
  /** Array of widths for action button skeletons (default: ["w-36"]) */
  actionWidths?: string[];
  /** Number of filter chip skeletons (default: 0) */
  filterCount?: number;
  /** Width of each filter chip (default: "w-20") */
  filterWidth?: string;
  /** Show a search bar skeleton above the filters (default: false) */
  searchBar?: boolean;
  /** Optional children rendered after the filters — typically a page-specific skeleton */
  children?: ReactNode;
}

/**
 * PageSkeleton
 *
 * Reusable loading skeleton that wraps the common page layout pattern:
 *   Header (title + subtitle + action buttons)
 *   Search bar (optional)
 *   Filter chips (optional)
 *   Content (children — page-specific skeleton)
 *
 * All skeleton elements use only the `skeleton` CSS class for consistent shimmer animation.
 *
 * @example
 * ```tsx
 * <PageSkeleton
 *   titleWidth="w-48"
 *   subtitleWidth="w-64"
 *   actionWidths={["w-36"]}
 *   filterCount={6}
 *   searchBar
 * >
 *   <ItemSkeleton viewMode="grid" count={8} />
 * </PageSkeleton>
 * ```
 */
export function PageSkeleton({
  titleWidth = "w-48",
  subtitleWidth = "w-64",
  actionWidths = ["w-36"],
  filterCount = 0,
  filterWidth = "w-20",
  searchBar = false,
  children,
}: PageSkeletonProps) {
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-8 ${titleWidth} skeleton rounded-lg`} />
          <div className={`h-5 ${subtitleWidth} skeleton rounded`} />
        </div>
        {actionWidths.length > 0 && (
          <div className="flex items-center gap-3">
            {actionWidths.map((w, i) => (
              <div key={i} className={`h-10 ${w} skeleton rounded-lg`} />
            ))}
          </div>
        )}
      </div>

      {/* ── Search bar (optional) ── */}
      {searchBar && <div className="h-11 w-full skeleton rounded-xl" />}

      {/* ── Filter chips (optional) ── */}
      {filterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {Array.from({ length: filterCount }).map((_, i) => (
            <div key={i} className={`h-8 ${filterWidth} skeleton rounded-lg`} />
          ))}
        </div>
      )}

      {/* ── Content skeleton (children) ── */}
      {children}
    </div>
  );
}
