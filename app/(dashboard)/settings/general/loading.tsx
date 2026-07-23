import { PageSkeleton } from "@/components/page-skeleton";

export default function GeneralSettingsLoading() {
  return (
    <PageSkeleton titleWidth="w-64" subtitleWidth="w-96">
      <div className="h-96 skeleton rounded-2xl" />
    </PageSkeleton>
  );
}
