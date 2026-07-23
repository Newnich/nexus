import { PageSkeleton } from "@/components/page-skeleton";

export default function ApiKeysSettingsLoading() {
  return (
    <PageSkeleton titleWidth="w-56" subtitleWidth="w-72">
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-20 skeleton rounded-2xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}
