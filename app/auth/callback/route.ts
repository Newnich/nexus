import { createServerSupabaseClient, createServiceClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const VALID_NEXT_PATTERN = /^\/[a-zA-Z0-9\-_./]*$/;

function isValidNextPath(path: string): boolean {
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  try {
    const url = new URL(path, "http://n");
    return url.pathname === path && VALID_NEXT_PATTERN.test(path);
  } catch {
    return false;
  }
}

function sanitizeRedirect(path: string, fallback: string): string {
  return isValidNextPath(path) ? path : fallback;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";
  const authType = searchParams.get("type"); // "signup" | "recovery" | "invite"

  // Handle auth errors from Supabase (e.g. expired/invalid links)
  const providerError = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  if (providerError) {
    const params = new URLSearchParams({
      error: providerError,
      error_description: errorDescription || "Authentication failed",
    });
    return NextResponse.redirect(
      `${origin}/auth/login?${params.toString()}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=missing_code`
    );
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error("Auth code exchange failed:", exchangeError.message);
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent(
          exchangeError.message
        )}`
      );
    }

    // Get the authenticated user to upsert into the users table
    const {
      data: { user: authUser },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !authUser) {
      console.error("Failed to get authenticated user:", userError?.message);
      return NextResponse.redirect(
        `${origin}/auth/login?error=session_not_found`
      );
    }

    // Sync user record — create one in the `users` table if it doesn't exist.
    // The `users.id` is set to the Supabase Auth UID so foreign keys work.
    // Uses the service role client to bypass RLS (new users may not have RLS policies yet).
    const serviceClient = await createServiceClient();
    const { error: upsertError } = await serviceClient.from("users").upsert(
      {
        id: authUser.id,
        email: authUser.email ?? "",
        name:
          authUser.user_metadata?.full_name ??
          authUser.user_metadata?.name ??
          authUser.email?.split("@")[0] ??
          "User",
        avatar_url: authUser.user_metadata?.avatar_url ?? null,
      },
      { onConflict: "id", ignoreDuplicates: false }
    );

    if (upsertError) {
      // Non-critical — the user is authenticated, log and continue
      console.error("Failed to upsert user record:", upsertError.message);
    }

    // Flow-specific redirects
    if (authType === "signup") {
      return NextResponse.redirect(`${origin}/onboarding`);
    }
    if (authType === "recovery") {
      return NextResponse.redirect(`${origin}/auth/reset-password`);
    }

    const safeRedirect = sanitizeRedirect(next, "/dashboard");
    return NextResponse.redirect(`${origin}${safeRedirect}`);
  } catch (err) {
    console.error("Auth callback error:", err);
    return NextResponse.redirect(
      `${origin}/auth/login?error=unexpected_error`
    );
  }
}
