import { PageSkeleton } from "@/components/page-skeleton";

export default function SearchLoading() {
  return (
    <PageSkeleton titleWidth="w-24" subtitleWidth="w-48" searchBar filterCount={4}>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-2xl p-5 space-y-3">
            <div className="skeleton h-4 w-16 rounded" />
            <div className="skeleton h-6 w-3/4 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-4 w-2/3 rounded" />
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}
