// This file configures the initialization of Sentry on the Edge Runtime.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Lower sampling for edge functions (high volume)
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.05 : 0,
    // Environment tag
    environment: process.env.NODE_ENV || "development",
    // Only initialize when DSN is provided
    enabled: !!SENTRY_DSN,
    // Edge-specific ignore list
    ignoreErrors: ["Not Found", "not_found"],
  });
}
