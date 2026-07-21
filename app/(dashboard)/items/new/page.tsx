"use client";

import { Suspense } from "react";
import NewItemForm from "./new-item-form";

const LoadingSkeleton = () => (
  <div className="max-w-3xl mx-auto space-y-8 pb-12">
    <div className="text-center">
      <div className="text-5xl mb-4 animate-pulse">⟠</div>
      <h1 className="text-3xl font-bold gradient-text mb-2">Save to NEXUS</h1>
      <p className="text-muted-foreground">Loading...</p>
    </div>
    <div className="grid grid-cols-3 gap-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 skeleton rounded-xl" />
      ))}
    </div>
    <div className="h-16 skeleton rounded-xl" />
    <div className="h-12 skeleton rounded-xl" />
    <div className="h-40 skeleton rounded-xl" />
    <div className="h-20 skeleton rounded-xl" />
  </div>
);

export default function NewItemPage() {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <NewItemForm />
    </Suspense>
  );
}
