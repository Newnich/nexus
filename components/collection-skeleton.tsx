/**
 * CollectionSkeleton
 *
 * Renders skeleton placeholders matching the collections card layout.
 * Used during loading states to improve perceived performance.
 */
export function CollectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-6 rounded-2xl">
          {/* Card Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl skeleton" />
              <div className="space-y-2">
                <div className="h-5 w-36 skeleton rounded" />
                <div className="h-3 w-28 skeleton rounded" />
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5 mb-4">
            <div className="h-3 w-full skeleton rounded" />
            <div className="h-3 w-4/5 skeleton rounded" />
          </div>

          {/* Preview Items */}
          <div className="space-y-1.5 mb-4">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <div className="w-4 h-4 skeleton rounded" />
                <div className="h-3 flex-1 skeleton rounded" />
                <div className="h-3 w-12 skeleton rounded" />
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-border/50">
            <div className="h-3 w-24 skeleton rounded" />
            <div className="h-3 w-10 skeleton rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
