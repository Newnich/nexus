import { ItemSkeleton } from "@/components/item-skeleton";

/**
 * Loading boundary for the items list page.
 *
 * Displayed during:
 * - Initial server-side rendering (streaming)
 * - Page transitions via Next.js router
 * - Before the client-side component hydrates and takes over
 */
export default function ItemsLoading() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-24 skeleton rounded-lg" />
          <div className="h-5 w-48 skeleton rounded" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-8 w-24 skeleton rounded-lg" />
          <div className="h-8 w-28 skeleton rounded-lg" />
        </div>
      </div>

      {/* Search bar skeleton */}
      <div className="h-11 w-full skeleton rounded-xl" />

      {/* Filter chips skeleton */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="h-8 w-20 skeleton rounded-lg" />
        <div className="h-8 w-16 skeleton rounded-lg" />
        <div className="h-8 w-20 skeleton rounded-lg" />
        <div className="h-8 w-14 skeleton rounded-lg" />
        <div className="h-8 w-18 skeleton rounded-lg" />
        <div className="h-8 w-16 skeleton rounded-lg" />
      </div>

      {/* Items grid skeleton */}
      <ItemSkeleton viewMode="grid" count={8} />
    </div>
  );
}
