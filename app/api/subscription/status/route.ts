import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { FREE_DAILY_AI_LIMIT, getAiUsageToday, getSubscriptionSnapshot } from "@/lib/subscription";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function planLabel(plan: "free" | "pro_trial" | "pro") {
  if (plan === "pro_trial") return "Pro Trial";
  if (plan === "pro") return "Pro";
  return "Free";
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userRes.user.id;

    const [snapshot, used] = await Promise.all([
      getSubscriptionSnapshot(supabase, userId),
      getAiUsageToday(supabase, userId),
    ]);

    const remaining = snapshot.isUnlimitedAi ? null : Math.max(0, FREE_DAILY_AI_LIMIT - used);

    return NextResponse.json({
      isPremium: snapshot.plan === "pro" || snapshot.plan === "pro_trial",
      freeLimit: FREE_DAILY_AI_LIMIT,
      used,
      remaining,
      canUseAi: snapshot.isUnlimitedAi || (remaining ?? 0) > 0,
      plan: snapshot.plan,
      planLabel: planLabel(snapshot.plan),
      trialEndsAt: snapshot.trialEndsAt,
      trialDaysLeft: snapshot.trialDaysLeft,
      cta:
        snapshot.plan === "free"
          ? "Start 7-day free trial"
          : snapshot.plan === "pro_trial"
          ? "Manage trial"
          : "Manage subscription",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load subscription status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
