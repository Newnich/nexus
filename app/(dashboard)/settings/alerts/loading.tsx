import { PageSkeleton } from "@/components/page-skeleton";

export default function AlertsSettingsLoading() {
  return (
    <PageSkeleton titleWidth="w-64" subtitleWidth="w-96">
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 skeleton rounded-2xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}
