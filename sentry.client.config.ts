// This file configures the initialization of Sentry on the client (browser).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Performance monitoring
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
    // Session replay for debugging user sessions (low rate to stay free)
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    // Environment tag
    environment: process.env.NODE_ENV || "development",
    // Only initialize when DSN is provided (prevents using quota in dev)
    enabled: !!SENTRY_DSN,
    // Ignore common non-actionable errors
    ignoreErrors: [
      // ResizeObserver loop errors (benign browser behavior)
      "ResizeObserver loop",
      "ResizeObserver loop completed",
      // Network errors that are handled by the app
      "Network request failed",
      "Failed to fetch",
      // Chrome extension errors
      "chrome-extension://",
      "moz-extension://",
      // Ad-blocker related
      "Error with Permissions-Policy header",
    ],
    // Integrate with existing error boundaries
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}
