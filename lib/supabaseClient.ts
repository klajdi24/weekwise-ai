import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabase: SupabaseClient | null = null;

function projectRefFromUrl(supabaseUrl: string) {
  try {
    return new URL(supabaseUrl).hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}

/** Drop expired tokens before the client boots, so auth-js does not auto-refresh on load. */
function purgeExpiredBrowserSession(supabaseUrl: string) {
  if (typeof window === "undefined") return;

  const ref = projectRefFromUrl(supabaseUrl);
  if (!ref) return;

  const key = `sb-${ref}-auth-token`;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    const parsed = JSON.parse(raw) as {
      expires_at?: number;
      expiresAt?: number;
      currentSession?: { expires_at?: number };
    };

    const expiresAt = parsed.currentSession?.expires_at ?? parsed.expires_at ?? parsed.expiresAt;
    const expired = typeof expiresAt === "number" && expiresAt * 1000 <= Date.now() + 15_000;

    if (expired) {
      window.localStorage.removeItem(key);
    }
  } catch {
    window.localStorage.removeItem(key);
  }
}

/** Never throw TypeError "Failed to fetch" — auth-js treats this as a failed HTTP call instead. */
const resilientFetch: typeof fetch = async (input, init) => {
  try {
    return await fetch(input, init);
  } catch {
    return new Response(
      JSON.stringify({
        error: "network_error",
        error_description: "Could not reach authentication server.",
        msg: "Failed to fetch",
        message: "Failed to fetch",
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export function getSupabaseClient(): SupabaseClient | null {
  if (_supabase) return _supabase;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  purgeExpiredBrowserSession(supabaseUrl);

  _supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      fetch: resilientFetch,
    },
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: true,
    },
  });

  return _supabase;
}

export const supabase = typeof window !== "undefined" ? getSupabaseClient() : null;
