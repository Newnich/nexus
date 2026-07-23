/**
 * ActivitySkeleton
 *
 * Renders skeleton placeholders matching the activity timeline entry layout.
 * Used during loading states to improve perceived performance.
 */
export function ActivitySkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative flex items-start gap-4 p-4 glass-card rounded-2xl">
          {/* Timeline dot */}
          <div className="flex flex-col items-center shrink-0">
            <div className="w-10 h-10 rounded-xl skeleton" />
            {i < count - 1 && <div className="w-px flex-1 min-h-[8px] bg-border/30 mt-1" />}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 pt-1 space-y-2">
            {/* Action label + entity type */}
            <div className="flex items-center gap-2">
              <div className="h-4 w-20 skeleton rounded" />
              <div className="h-3 w-10 skeleton rounded" />
            </div>

            {/* Metadata line */}
            <div className="h-3 w-3/4 skeleton rounded" />

            {/* Timestamp */}
            <div className="h-3 w-16 skeleton rounded" />
          </div>

          {/* View button */}
          <div className="h-8 w-16 skeleton rounded-lg shrink-0" />
        </div>
      ))}
    </div>
  );
}
