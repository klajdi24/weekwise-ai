import type { SupabaseClient, Session, User } from "@supabase/supabase-js";

export type ClientAuth = {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
};

const emptyAuth: ClientAuth = { session: null, user: null, accessToken: null };

function isExpired(session: Session, skewSeconds = 30) {
  const expiresAt = session.expires_at;
  if (!expiresAt) return false;
  return expiresAt * 1000 <= Date.now() + skewSeconds * 1000;
}

async function localSignOut(supabase: SupabaseClient) {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignore
  }
}

/** Read auth from the local session — never throws if Supabase is unreachable. */
export async function getClientAuth(supabase: SupabaseClient): Promise<ClientAuth> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) return emptyAuth;

    const session = data.session;

    if (isExpired(session)) {
      await localSignOut(supabase);
      return emptyAuth;
    }

    return {
      session,
      user: session.user,
      accessToken: session.access_token,
    };
  } catch {
    await localSignOut(supabase);
    return emptyAuth;
  }
}

/** Same-origin API fetch with clearer errors when the dev server is unavailable. */
export async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (err) {
    if (err instanceof TypeError) {
      throw new Error(
        "Could not reach the app server. Start it with npm run dev, then reload this page."
      );
    }
    throw err;
  }
}
