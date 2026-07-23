import { PageSkeleton } from "@/components/page-skeleton";
import { CollectionSkeleton } from "@/components/collection-skeleton";

/**
 * Loading boundary for the collections list page.
 */
export default function CollectionsLoading() {
  return (
    <PageSkeleton
      titleWidth="w-48"
      subtitleWidth="w-64"
      actionWidths={["w-36"]}
      filterCount={4}
      filterWidth="w-28"
    >
      <CollectionSkeleton count={4} />
    </PageSkeleton>
  );
}
