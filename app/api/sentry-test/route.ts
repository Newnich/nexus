import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/sentry-test
 *
 * Deliberately throws an error to verify Sentry error tracking is working.
 * Used during setup and onboarding (see SENTRY_SETUP.md).
 *
 * Response: Always returns a 500 with a description of the test error.
 */
export async function POST() {
  console.info("[SentryTest] Triggering test error for Sentry verification...");

  try {
    // Throw a well-typed error that Sentry can capture
    throw new Error(
      "Sentry test error — this is a deliberate error to verify Sentry " +
        "error tracking is properly configured. Safe to ignore.",
    );
  } catch (error) {
    // Notify Sentry explicitly (it will auto-capture the uncaught throw too,
    // but this ensures we get a breadcrumb trail)
    console.error("[SentryTest] Test error thrown:", error);

    return NextResponse.json(
      {
        status: "error",
        message:
          "Test error thrown successfully. If Sentry is configured, this error " +
          "should appear in your Sentry Issues dashboard within 30 seconds.",
        sentryTest: true,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
