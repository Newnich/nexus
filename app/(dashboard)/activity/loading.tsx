import { ActivitySkeleton } from "@/components/activity-skeleton";

/**
 * Loading boundary for the activity list page.
 */
export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-8 w-32 skeleton rounded-lg" />
          <div className="h-5 w-48 skeleton rounded mt-1" />
        </div>
        <div className="h-9 w-40 skeleton rounded-lg" />
      </div>

      {/* Filter chips skeleton */}
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-8 w-28 skeleton rounded-lg" />
        ))}
        <div className="w-px h-6 bg-border mx-1" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 w-20 skeleton rounded-lg" />
        ))}
      </div>

      {/* Timeline entries skeleton */}
      <ActivitySkeleton count={5} />
    </div>
  );
}
