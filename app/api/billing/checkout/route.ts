import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import {
  type BillingInterval,
  type BillingPlan,
  getPlanAndIntervalFromPriceId,
  getPriceForSelection,
  getStripeServer,
  isStripeReady,
} from "@/lib/stripe";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function sanitizePlan(input: unknown): BillingPlan {
  return input === "unlimited" ? "unlimited" : "pro";
}

function sanitizeInterval(input: unknown): BillingInterval {
  return input === "annual" ? "annual" : "monthly";
}

export async function POST(req: NextRequest) {
  try {
    if (!isStripeReady()) {
      return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
    }

    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = userRes.user;
    const stripe = getStripeServer();

    const body = (await req.json().catch(() => ({}))) as { plan?: BillingPlan; interval?: BillingInterval };
    const plan = sanitizePlan(body.plan);
    const interval = sanitizeInterval(body.interval);
    const priceId = getPriceForSelection(plan, interval);
    if (!priceId) return NextResponse.json({ error: "Price is not configured for selected plan/interval" }, { status: 503 });

    await supabase.from("analytics_events").insert({
      user_id: user.id,
      event_name: "checkout_started",
      payload: { source: "api", plan, interval },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/settings/billing?checkout=success`,
      cancel_url: `${appUrl}/settings/billing?checkout=cancelled`,
      customer_email: user.email ?? undefined,
      metadata: {
        user_id: user.id,
        plan,
        interval,
      },
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          user_id: user.id,
          plan,
          interval,
        },
      },
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url, plan, interval });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userRes.user.id;
    const { data } = await supabase
      .from("subscriptions")
      .select("plan,billing_interval")
      .eq("user_id", userId)
      .maybeSingle();

    return NextResponse.json({
      currentPlan: (data?.plan as string | undefined) ?? "free",
      currentInterval: (data?.billing_interval as string | undefined) ?? "monthly",
      plans: ["pro", "unlimited"],
      intervals: ["monthly", "annual"],
      mapping: {
        proMonthly: getPlanAndIntervalFromPriceId(getPriceForSelection("pro", "monthly")),
        proAnnual: getPlanAndIntervalFromPriceId(getPriceForSelection("pro", "annual")),
        unlimitedMonthly: getPlanAndIntervalFromPriceId(getPriceForSelection("unlimited", "monthly")),
        unlimitedAnnual: getPlanAndIntervalFromPriceId(getPriceForSelection("unlimited", "annual")),
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load checkout metadata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
