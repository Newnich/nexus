import { CollectionSkeleton } from "@/components/collection-skeleton";

/**
 * Loading boundary for the collections list page.
 */
export default function CollectionsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 skeleton rounded-lg" />
          <div className="h-5 w-64 skeleton rounded mt-2" />
        </div>
        <div className="h-10 w-36 skeleton rounded-lg" />
      </div>

      {/* Filter chips skeleton */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-28 skeleton rounded-lg" />
        ))}
      </div>

      {/* Cards grid skeleton */}
      <CollectionSkeleton count={4} />
    </div>
  );
}
