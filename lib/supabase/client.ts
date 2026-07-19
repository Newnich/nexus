import { createBrowserClient } from "@supabase/ssr";

// Lazily initialized — avoids crashing during static generation/build
// when env vars may not be available.
let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function supabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error(
        "Missing Supabase environment variables. " +
        "Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY " +
        "are set in Vercel project settings with 'Available during Build' enabled."
      );
    }
    _supabase = createBrowserClient(url, key);
  }
  return _supabase;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
