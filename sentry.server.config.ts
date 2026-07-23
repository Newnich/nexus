// This file configures the initialization of Sentry on the server (Node.js).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Performance monitoring for API routes (lower rate to conserve free tier quota)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    // Environment tag
    environment: process.env.NODE_ENV || "development",
    // Only initialize when DSN is provided
    enabled: !!SENTRY_DSN,
    // Ignore 404s and known non-actionable errors
    ignoreErrors: ["Not Found", "not_found", "not-found"],
  });
}
