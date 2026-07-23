import { PageSkeleton } from "@/components/page-skeleton";
import { ActivitySkeleton } from "@/components/activity-skeleton";

/**
 * Loading boundary for the activity list page.
 */
export default function ActivityLoading() {
  return (
    <PageSkeleton
      titleWidth="w-32"
      subtitleWidth="w-48"
      actionWidths={["w-40"]}
      filterCount={8}
      filterWidth="w-24"
    >
      <ActivitySkeleton count={5} />
    </PageSkeleton>
  );
}
