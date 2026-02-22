import type { SupabaseClient } from "@supabase/supabase-js";
import { planLimitReached, rateLimited } from "./errors";
import { getUserPlan } from "./entitlements";

export interface ConsumedQuota {
  usageId: string;
  plan: string;
  period: "day" | "month";
  used: number;
  limit: number;
  remaining: number;
  resetAt: string;
}

interface RpcRow {
  allowed: boolean;
  usage_id: string | null;
  plan: string;
  period: "day" | "month";
  used: number;
  limit_count: number;
  remaining: number;
  reset_at: string;
  reason: string | null;
}

async function countWindow(supabase: SupabaseClient, userId: string, ms: number) {
  const { count, error } = await supabase
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - ms).toISOString());

  if (error) throw error;
  return count ?? 0;
}

async function assertFairUseForPlan(supabase: SupabaseClient, userId: string): Promise<void> {
  const plan = await getUserPlan(supabase, userId);

  const cooldownCount = await countWindow(supabase, userId, 10_000);
  if (cooldownCount >= 2) {
    throw rateLimited("Too many rapid AI requests. Please wait 10 seconds.", { cooldownSeconds: 10 });
  }

  if (plan.plan === "unlimited") {
    const minuteCount = await countWindow(supabase, userId, 60_000);
    if (minuteCount >= 20) {
      throw rateLimited("Fair-use slow mode active: too many AI requests this minute.", {
        plan: "unlimited",
        window: "1 minute",
        maxRequests: 20,
        slowModeSeconds: 45,
      });
    }

    const hourCount = await countWindow(supabase, userId, 60 * 60_000);
    if (hourCount >= 200) {
      throw rateLimited("Fair-use guard triggered due to unusually high sustained usage.", {
        plan: "unlimited",
        window: "1 hour",
        maxRequests: 200,
      });
    }
    return;
  }

  const burstCount = await countWindow(supabase, userId, 5 * 60_000);
  if (burstCount >= 25) {
    throw rateLimited("Fair-use guard triggered due to unusually high request volume. Please try later.", {
      windowMinutes: 5,
      maxRequests: 25,
    });
  }
}

export async function consumeQuotaOrThrow(
  supabase: SupabaseClient,
  userId: string,
  route: string,
): Promise<ConsumedQuota> {
  await assertFairUseForPlan(supabase, userId);

  const { data, error } = await supabase.rpc("consume_ai_quota", {
    p_user_id: userId,
    p_route: route,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : null) as RpcRow | null;
  if (!row) throw new Error("Quota guard returned empty response");

  if (!row.allowed || !row.usage_id) {
    throw planLimitReached({
      route,
      plan: row.plan,
      used: row.used,
      limit: row.limit_count,
      period: row.period,
      resetAt: row.reset_at,
    });
  }

  return {
    usageId: row.usage_id,
    plan: row.plan,
    period: row.period,
    used: row.used,
    limit: row.limit_count,
    remaining: row.remaining,
    resetAt: row.reset_at,
  };
}

export async function finalizeUsage(
  supabase: SupabaseClient,
  usageId: string,
  payload: { request_tokens?: number; response_tokens?: number; total_tokens?: number; cost_estimate?: number },
): Promise<void> {
  await supabase
    .from("ai_usage")
    .update({
      request_tokens: payload.request_tokens ?? 0,
      response_tokens: payload.response_tokens ?? 0,
      total_tokens: payload.total_tokens ?? (payload.request_tokens ?? 0) + (payload.response_tokens ?? 0),
      cost_estimate: payload.cost_estimate ?? 0,
    })
    .eq("id", usageId);
}
