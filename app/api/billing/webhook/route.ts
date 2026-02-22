import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { getPlanAndIntervalFromPriceId, getStripeServer } from "@/lib/stripe";

function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase service credentials");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function upsertSubscriptionFromStripe(
  supabase: ReturnType<typeof getServiceSupabase>,
  sub: Stripe.Subscription,
  statusOverride?: string,
) {
  const userId = (sub.metadata?.user_id as string | undefined) ?? null;
  if (!userId) return;

  const firstItem = sub.items?.data?.[0];
  const subAny = sub as Stripe.Subscription & { current_period_start?: number; current_period_end?: number };
  const priceId = firstItem?.price?.id ?? null;
  const mapped = getPlanAndIntervalFromPriceId(priceId);

  const plan = sub.status === "active" || sub.status === "trialing" ? (mapped?.plan ?? "free") : "free";
  const interval = mapped?.interval ?? "monthly";

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    plan,
    billing_interval: interval,
    trial_ends_at: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    current_period_start: subAny.current_period_start ? new Date(subAny.current_period_start * 1000).toISOString() : null,
    current_period_end: subAny.current_period_end ? new Date(subAny.current_period_end * 1000).toISOString() : null,
    stripe_customer_id: (typeof sub.customer === "string" ? sub.customer : sub.customer?.id) ?? null,
    stripe_subscription_id: sub.id,
    status: statusOverride ?? sub.status,
    updated_at: new Date().toISOString(),
  });

  if (sub.status === "trialing") {
    await supabase.from("analytics_events").insert({
      user_id: userId,
      event_name: "trial_started",
      payload: { plan, interval, stripe_subscription_id: sub.id },
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "Missing STRIPE_WEBHOOK_SECRET" }, { status: 503 });

    const stripe = getStripeServer();
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");
    if (!signature) return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });

    const event = stripe.webhooks.constructEvent(body, signature, secret);
    const supabase = getServiceSupabase();

    const { data: insertedEvent, error: idempotencyError } = await supabase
      .from("stripe_webhook_events")
      .insert({ event_id: event.id })
      .select("event_id")
      .maybeSingle();

    if (idempotencyError) {
      if (idempotencyError.code === "23505") {
        return NextResponse.json({ received: true, duplicate: true });
      }
      throw new Error(`Webhook idempotency insert failed: ${idempotencyError.message}`);
    }

    if (!insertedEvent?.event_id) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(String(session.subscription));
          await upsertSubscriptionFromStripe(supabase, sub);
          const userId = (sub.metadata?.user_id as string | undefined) ?? null;
          if (userId) {
            await supabase.from("analytics_events").insert({
              user_id: userId,
              event_name: "checkout_completed",
              payload: { stripe_subscription_id: sub.id },
            });
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(supabase, sub);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await upsertSubscriptionFromStripe(supabase, sub, "canceled");
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(supabase, sub, "active");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subscriptionId) {
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await upsertSubscriptionFromStripe(supabase, sub, "past_due");
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
