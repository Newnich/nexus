import { createBrowserClient } from "@supabase/ssr";

// Lazily initialized — avoids crashing during static generation/build
// when env vars may not be available.
let _supabase: ReturnType<typeof createBrowserClient> | null = null;

export function supabase() {
  if (!_supabase) {
    _supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return _supabase;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
