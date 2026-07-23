import { PageSkeleton } from "@/components/page-skeleton";

export default function GraphLoading() {
  return (
    <PageSkeleton titleWidth="w-64" subtitleWidth="w-72">
      <div className="glass-card rounded-2xl h-[500px] flex items-center justify-center relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-nexus-500/5 via-transparent to-indigo-500/5" />

        {/* Animated grid dots */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />

        {/* Hexagon spinner */}
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 border-2 border-nexus-500/20 rounded-xl animate-pulse" />
            <div className="absolute inset-1 border-2 border-t-nexus-500 border-r-transparent border-b-transparent border-l-transparent rounded-xl animate-spin" />
            <div className="absolute inset-3 border-2 border-t-indigo-500/50 border-r-transparent border-b-transparent border-l-transparent rounded-xl animate-spin animation-delay-500" />
            <span className="absolute inset-0 flex items-center justify-center text-lg text-nexus-400">
              ⬡
            </span>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Loading knowledge graph...</p>
        </div>
      </div>

      {/* Card skeletons footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 skeleton rounded-2xl" />
        ))}
      </div>
    </PageSkeleton>
  );
}
