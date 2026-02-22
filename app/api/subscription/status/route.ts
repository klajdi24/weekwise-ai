import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { getCurrentUsage, getUserPlan } from "@/lib/ai/entitlements";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function planLabel(plan: "free" | "pro" | "unlimited") {
  if (plan === "pro") return "Pro";
  if (plan === "unlimited") return "Unlimited (Fair Use)";
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
    const plan = await getUserPlan(supabase, userId);
    const usage = await getCurrentUsage(supabase, userId, plan.plan);
    const usagePct = usage.limit > 0 ? Math.round((usage.used / usage.limit) * 100) : 0;

    return NextResponse.json({
      isPremium: plan.plan !== "free",
      freeLimit: usage.limit,
      used: usage.used,
      remaining: plan.plan === "unlimited" ? null : usage.remaining,
      canUseAi: usage.remaining > 0,
      plan: plan.plan,
      planLabel: planLabel(plan.plan),
      billingInterval: plan.billing_interval ?? "monthly",
      period: usage.period,
      resetAt: usage.resetAt,
      status: plan.status,
      usagePct,
      nearLimit: plan.plan !== "unlimited" && usagePct >= 80,
      cta:
        plan.plan === "free"
          ? "Upgrade to Pro"
          : plan.plan === "pro"
          ? "Upgrade to Unlimited"
          : "Manage billing",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load subscription status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
