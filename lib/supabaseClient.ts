// lib/supabaseClient.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // ✅ Never throw at module evaluation/build time
  // Only create client when env vars exist (client runtime).
  if (!supabaseUrl || !supabaseAnonKey) {
    // During build/SSR import, env might not be present in some contexts.
    // Return a typed placeholder; actual usage should happen in the browser.
    return null as unknown as SupabaseClient;
  }

  _supabase = createClient(supabaseUrl, supabaseAnonKey);
  return _supabase;
}

// ✅ Backwards compatibility (some of your pages still do `import { supabase } ...`)
export const supabase =
  typeof window !== "undefined"
    ? getSupabaseClient()
    : (null as unknown as SupabaseClient);


