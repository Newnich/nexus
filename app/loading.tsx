import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <div className="w-12 h-12 rounded-full border-2 border-nexus-500/20 border-t-nexus-500 animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground animate-pulse">Loading NEXUS...</p>
      </div>
    </div>
  );
}
