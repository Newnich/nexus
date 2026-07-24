"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import * as Sentry from "@sentry/nextjs";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
    Sentry.captureException(error, {
      tags: { errorBoundary: "dashboard" },
    });
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="max-w-md w-full text-center space-y-6 px-4">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-7 h-7 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-foreground tracking-tight">
            Something went wrong
          </h2>
          <p className="text-muted-foreground">
            An unexpected error occurred in this section.
            {process.env.NODE_ENV === "development" && (
              <span className="block mt-2 text-sm font-mono text-destructive/80">
                {error.message}
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all duration-200"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border text-foreground font-medium text-sm hover:bg-accent transition-all duration-200"
          >
            <Home className="w-4 h-4" />
            Dashboard home
          </Link>
        </div>

        {/* Error reference */}
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
