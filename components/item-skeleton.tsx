import { cn } from "@/lib/utils";

interface ItemSkeletonProps {
  viewMode?: "grid" | "list";
  count?: number;
}

/**
 * ItemSkeleton
 *
 * Renders skeleton placeholders that visually match the NEXUS item card layout.
 * Used during loading states to improve perceived performance.
 *
 * Grid mode: 8 cards (default) with accent bar, icon, title, summary, tags, date
 * List mode: 5 rows (default) with icon, type badge, title, summary, tags
 */
export function ItemSkeleton({ viewMode = "grid", count }: ItemSkeletonProps) {
  const skeletonCount = count ?? (viewMode === "grid" ? 8 : 5);

  if (viewMode === "list") {
    return (
      <div className="space-y-2">
        {Array.from({ length: skeletonCount }).map((_, i) => (
          <div
            key={i}
            className="p-4 glass-card rounded-2xl animate-pulse"
            style={{ animationDelay: `${i * 60}ms`, animationDuration: "1.5s" }}
          >
            <div className="flex items-start gap-4">
              {/* Icon skeleton */}
              <div className="w-10 h-10 rounded-xl bg-muted shrink-0" />

              <div className="flex-1 min-w-0 space-y-2">
                {/* Type badge + date */}
                <div className="flex items-center gap-2">
                  <div className="h-3 w-14 skeleton rounded" />
                  <div className="h-3 w-10 skeleton rounded" />
                  <div className="h-3 w-16 skeleton rounded ml-auto" />
                </div>

                {/* Title */}
                <div className="h-4 w-3/4 skeleton rounded" />

                {/* Summary */}
                <div className="h-3 w-full skeleton rounded" />

                {/* Tags */}
                <div className="flex items-center gap-2">
                  <div className="h-4 w-12 skeleton rounded-full" />
                  <div className="h-4 w-16 skeleton rounded-full" />
                  <div className="h-4 w-10 skeleton rounded-full" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Grid mode
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: skeletonCount }).map((_, i) => (
        <div
          key={i}
          className="glass-card rounded-2xl overflow-hidden animate-pulse"
          style={{ animationDelay: `${i * 60}ms`, animationDuration: "1.5s" }}
        >
          {/* Color accent bar skeleton */}
          <div className="h-1.5 bg-muted" />

          <div className="p-5 space-y-3">
            {/* Icon + Favorite row */}
            <div className="flex items-start justify-between">
              <div className="w-9 h-9 rounded-xl bg-muted" />
              <div className="w-4 h-4 skeleton rounded" />
            </div>

            {/* Title (2 lines) */}
            <div className="space-y-1.5">
              <div className="h-4 w-full skeleton rounded" />
              <div className="h-4 w-2/3 skeleton rounded" />
            </div>

            {/* Summary (2 lines) */}
            <div className="space-y-1">
              <div className="h-3 w-full skeleton rounded" />
              <div className="h-3 w-4/5 skeleton rounded" />
            </div>

            {/* Tags row */}
            <div className="flex items-center gap-2">
              <div className="h-4 w-14 skeleton rounded-full" />
              <div className="h-4 w-10 skeleton rounded-full" />
            </div>

            {/* Bottom row: date + archive */}
            <div className="flex items-center justify-between pt-1">
              <div className="h-3 w-20 skeleton rounded" />
              <div className="h-6 w-6 skeleton rounded-lg" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
