import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { getStripeServer } from "@/lib/stripe";

type Plan = "free" | "pro" | "unlimited";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function sanitizePlan(value: unknown): Plan {
  if (value === "pro" || value === "unlimited") return value;
  return "free";
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userRes.user.id;
    const body = (await req.json().catch(() => ({}))) as { plan?: Plan };
    const targetPlan = sanitizePlan(body.plan);

    const { data: current, error: currentErr } = await supabase
      .from("subscriptions")
      .select("stripe_subscription_id,plan")
      .eq("user_id", userId)
      .maybeSingle();

    if (currentErr) return NextResponse.json({ error: currentErr.message }, { status: 500 });

    if (targetPlan === "free" && current?.stripe_subscription_id) {
      const stripe = getStripeServer();
      await stripe.subscriptions.cancel(current.stripe_subscription_id);
    }

    await supabase.from("subscriptions").upsert({
      user_id: userId,
      plan: targetPlan,
      billing_interval: "monthly",
      status: "active",
      updated_at: new Date().toISOString(),
      ...(targetPlan === "free"
        ? {
            stripe_customer_id: null,
            stripe_subscription_id: null,
            current_period_start: null,
            current_period_end: null,
            trial_ends_at: null,
          }
        : {}),
    });

    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: "plan_changed_in_app",
      payload: { from: current?.plan ?? "free", to: targetPlan },
    });

    return NextResponse.json({ ok: true, plan: targetPlan });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to change plan";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
