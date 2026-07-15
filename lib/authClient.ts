import type { SupabaseClient, Session, User } from "@supabase/supabase-js";

export type ClientAuth = {
  session: Session | null;
  user: User | null;
  accessToken: string | null;
};

/** Read auth from the local session — safe when logged out (avoids AuthSessionMissingError). */
export async function getClientAuth(supabase: SupabaseClient): Promise<ClientAuth> {
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) {
    return { session: null, user: null, accessToken: null };
  }

  return {
    session: data.session,
    user: data.session.user,
    accessToken: data.session.access_token,
  };
}
