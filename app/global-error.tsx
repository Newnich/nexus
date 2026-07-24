"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
    Sentry.captureException(error, {
      tags: { errorBoundary: "global" },
    });
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-[hsl(222,47%,4%)] text-[hsl(210,40%,98%)] font-sans antialiased">
        <div className="min-h-screen flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-8">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-bold tracking-tight">Critical error</h1>
              <p className="text-gray-400 leading-relaxed">
                A critical application error occurred. Please try refreshing the page.
              </p>
            </div>

            <div className="flex items-center justify-center gap-4">
              <button
                onClick={reset}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[hsl(239,84%,67%)] text-white font-medium hover:opacity-90 transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Try again
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
