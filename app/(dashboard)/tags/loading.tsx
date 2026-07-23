import { PageSkeleton } from "@/components/page-skeleton";

export default function TagsLoading() {
  return (
    <PageSkeleton titleWidth="w-24" subtitleWidth="w-56" actionWidths={["w-32"]} searchBar>
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-16 skeleton rounded-2xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}
