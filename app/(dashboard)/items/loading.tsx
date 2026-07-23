import { PageSkeleton } from "@/components/page-skeleton";
import { ItemSkeleton } from "@/components/item-skeleton";

/**
 * Loading boundary for the items list page.
 */
export default function ItemsLoading() {
  return (
    <PageSkeleton
      titleWidth="w-24"
      subtitleWidth="w-48"
      actionWidths={["w-24", "w-28"]}
      searchBar
      filterCount={6}
      filterWidth="w-18"
    >
      <ItemSkeleton viewMode="grid" count={8} />
    </PageSkeleton>
  );
}
