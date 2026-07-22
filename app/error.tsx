"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-8">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-destructive" />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">
            Something went wrong
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            An unexpected error occurred. Our team has been notified.
            {process.env.NODE_ENV === "development" && (
              <span className="block mt-2 text-sm font-mono text-destructive/80">
                {error.message}
              </span>
            )}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-all duration-200 focus-glow"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-border text-foreground font-medium hover:bg-accent transition-all duration-200 focus-glow"
          >
            <Home className="w-4 h-4" />
            Go home
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
