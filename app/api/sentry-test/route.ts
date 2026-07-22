import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/sentry-test
 *
 * Deliberately throws an unhandled error to verify Sentry error tracking.
 * Sentry's withSentryConfig wrapper auto-captures unhandled exceptions in
 * API routes, so this error will appear in the Sentry Issues dashboard.
 * Used during setup and onboarding (see SENTRY_SETUP.md).
 *
 * Response: Always returns a 500 (Next.js default for unhandled errors).
 */
export async function POST() {
  console.info("[SentryTest] Triggering test error for Sentry verification...");

  // Intentionally unhandled — Sentry's instrumentation catches this and
  // sends it to the Issues dashboard as a full error event with stack trace.
  throw new Error(
    "Sentry test error — this is a deliberate error to verify Sentry " +
      "error tracking is properly configured. Safe to ignore.",
  );
}
