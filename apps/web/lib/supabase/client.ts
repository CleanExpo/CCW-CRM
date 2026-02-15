import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Lazy-initialized Supabase client.
 *
 * The client is only created when `getSupabase()` is called, avoiding a crash
 * at module-load time when NEXT_PUBLIC_SUPABASE_URL is not configured (e.g.
 * local dev pointing at FastAPI instead of Supabase).
 */
let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error(
        "Supabase environment variables are not configured. " +
          "Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, " +
          "or use FastAPI auth for local development."
      );
    }

    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }
  return _supabase;
}

/**
 * @deprecated Use `getSupabase()` instead. This eager export is kept for
 * backward compatibility but will throw at import time if env vars are missing.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
