import type { SupabaseClient } from "@supabase/supabase-js";

export const FREE_DAILY_AI_LIMIT = 5;

type Plan = "free" | "pro_trial" | "pro";

export interface SubscriptionSnapshot {
  plan: Plan;
  status: string;
  trialEndsAt: string | null;
  trialDaysLeft: number;
  isUnlimitedAi: boolean;
}

function daysLeft(iso: string | null): number {
  if (!iso) return 0;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return 0;
  const diff = end - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function isTrialActive(snapshot: { plan?: string | null; status?: string | null; trial_ends_at?: string | null }) {
  if (snapshot.plan !== "pro_trial") return false;
  if ((snapshot.status ?? "active") !== "active") return false;
  if (!snapshot.trial_ends_at) return false;
  return new Date(snapshot.trial_ends_at).getTime() > Date.now();
}

export async function getSubscriptionSnapshot(supabase: SupabaseClient, userId: string): Promise<SubscriptionSnapshot> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan, status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  const plan: Plan = (data?.plan as Plan | undefined) ?? "free";
  const status = data?.status ?? "active";
  const trialEndsAt = data?.trial_ends_at ?? null;

  const unlimited = plan === "pro" || isTrialActive({ plan, status, trial_ends_at: trialEndsAt });

  return {
    plan,
    status,
    trialEndsAt,
    trialDaysLeft: daysLeft(trialEndsAt),
    isUnlimitedAi: unlimited,
  };
}

export async function getAiUsageToday(supabase: SupabaseClient, userId: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("xp_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString())
    .like("source", "ai_action:%");

  if (error) throw error;
  return count ?? 0;
}

export async function consumeAiAction(supabase: SupabaseClient, userId: string, source: string): Promise<void> {
  await supabase.from("xp_ledger").insert({
    user_id: userId,
    source: `ai_action:${source}`,
    points: 0,
  });
}

export async function trackEvent(
  supabase: SupabaseClient,
  userId: string,
  eventName: string,
  payload: Record<string, unknown> = {},
): Promise<void> {
  await supabase.from("analytics_events").insert({
    user_id: userId,
    event_name: eventName,
    payload,
  });
}
