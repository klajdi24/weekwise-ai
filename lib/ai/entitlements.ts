import type { SupabaseClient } from "@supabase/supabase-js";

export type Plan = "free" | "pro" | "unlimited";
export type LimitPeriod = "day" | "month";

interface SubscriptionRow {
  plan: Plan;
  status: string;
  billing_interval: "monthly" | "annual" | null;
  current_period_start: string | null;
  current_period_end: string | null;
}

interface LimitRow {
  period: LimitPeriod;
  actions_limit: number;
}

export interface EntitlementSnapshot {
  plan: Plan;
  period: LimitPeriod;
  limit: number;
  used: number;
  remaining: number;
  resetAt: string;
}

export async function getUserPlan(supabase: SupabaseClient, userId: string): Promise<SubscriptionRow> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan,status,billing_interval,current_period_start,current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      plan: "free",
      status: "active",
      billing_interval: null,
      current_period_start: null,
      current_period_end: null,
    };
  }

  return data as SubscriptionRow;
}

export async function getLimit(supabase: SupabaseClient, plan: Plan): Promise<LimitRow> {
  const { data, error } = await supabase.from("ai_limits").select("period,actions_limit").eq("plan", plan).single();
  if (error) throw error;
  return data as LimitRow;
}

function monthlyWindow(now: Date, subscription: SubscriptionRow) {
  const start = subscription.current_period_start
    ? new Date(subscription.current_period_start)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = subscription.current_period_end
    ? new Date(subscription.current_period_end)
    : new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
}

function dailyWindow(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function getCurrentUsage(
  supabase: SupabaseClient,
  userId: string,
  plan: Plan,
  now = new Date(),
): Promise<EntitlementSnapshot> {
  const limit = await getLimit(supabase, plan);
  const subscription = await getUserPlan(supabase, userId);

  const window = limit.period === "month" ? monthlyWindow(now, subscription) : dailyWindow(now);

  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", window.start.toISOString())
    .lt("created_at", window.end.toISOString());

  if (error) throw error;

  const used = count ?? 0;
  return {
    plan,
    period: limit.period,
    limit: limit.actions_limit,
    used,
    remaining: Math.max(0, limit.actions_limit - used),
    resetAt: window.end.toISOString(),
  };
}
