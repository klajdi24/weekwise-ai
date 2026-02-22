"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

type BillingPlan = "pro" | "unlimited";
type BillingCycle = "monthly" | "annual";

interface SubscriptionStatus {
  isPremium: boolean;
  freeLimit: number;
  used: number;
  remaining: number | null;
  plan: "free" | "pro" | "unlimited";
  planLabel: string;
  usagePct: number;
  nearLimit: boolean;
  resetAt: string;
}

export default function PricingPage() {
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState<BillingPlan | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [showFairUse, setShowFairUse] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const checkoutResult = useMemo(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("checkout");
  }, []);

  const trackEvent = async (eventName: string, payload: Record<string, unknown> = {}) => {
    if (!supabase) return;
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) return;
      await supabase.from("analytics_events").insert({
        user_id: userData.user.id,
        event_name: eventName,
        payload,
      });
    } catch {
      // analytics should not break UX
    }
  };

  useEffect(() => {
    if (!supabase) return;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      setIsLoggedIn(Boolean(token));
      if (!token) return;

      const res = await fetch("/api/subscription/status", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) return;
      setStatus((await res.json()) as SubscriptionStatus);
      await trackEvent("pricing_view", { source: "pricing_page" });
      if (checkoutResult === "success") {
        await trackEvent("checkout_completed", { source: "pricing_page_return" });
      }
    };

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, checkoutResult]);

  const startCheckout = async (plan: BillingPlan) => {
    if (!supabase) {
      setCheckoutError("App is not configured. Missing Supabase environment variables.");
      return;
    }

    setCheckoutLoading(plan);
    setCheckoutError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setCheckoutError("Please log in first to upgrade.");
        return;
      }

      await trackEvent("plan_cta_clicked", { plan, billingCycle, location: "pricing_card" });
      await trackEvent("checkout_started", { plan, billingCycle, location: "pricing_card" });

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, interval: billingCycle }),
      });

      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) {
        setCheckoutError(payload.error || "Could not start checkout.");
        return;
      }

      if (plan === "pro" || plan === "unlimited") {
        await trackEvent("trial_started", { plan, source: "pricing_button" });
      }

      window.location.assign(payload.url);
    } finally {
      setCheckoutLoading(null);
    }
  };

  const onToggleCycle = async (cycle: BillingCycle) => {
    setBillingCycle(cycle);
    await trackEvent("billing_toggle_changed", { cycle });
  };

  const annualEquivalent = (monthly: number) => Number((monthly * 0.8).toFixed(2));
  const proDisplay = billingCycle === "monthly" ? 6.99 : annualEquivalent(6.99);
  const unlimitedDisplay = billingCycle === "monthly" ? 19.99 : annualEquivalent(19.99);

  const usageLabel =
    status?.plan === "unlimited"
      ? "Unlimited (fair use)"
      : `${status?.used ?? 0}/${status?.freeLimit ?? 60}`;

  return (
    <main className="min-h-screen app-surface p-6 md:p-10">
      <section className="max-w-6xl mx-auto space-y-6 app-layer">
        <div className="rounded-3xl bg-slate-900 text-white p-8 shadow-xl">
          <h1 className="text-4xl font-bold">Pick your WeekWise plan</h1>
          <p className="text-slate-300 mt-3">Student-friendly pricing. Clear limits. No surprises.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <span className="bg-white/10 px-3 py-1 rounded-full">Current plan: {status?.planLabel ?? "Free"}</span>
            <span className="bg-white/10 px-3 py-1 rounded-full">Usage this month: {usageLabel}</span>
            <span className="bg-white/10 px-3 py-1 rounded-full">Resets monthly on your billing date</span>
          </div>
          {status?.nearLimit ? (
            <p className="text-amber-300 mt-3 text-sm">You are near your monthly AI limit. Upgrade to avoid interruptions.</p>
          ) : null}
        </div>

        <div className="rounded-2xl border border-indigo-100 bg-white p-4 flex items-center justify-between flex-wrap gap-3 section-enter">
          <div>
            <p className="font-semibold text-slate-900">Billing</p>
            <p className="text-xs text-slate-500">Switch display to see annual savings</p>
          </div>
          <div className="segmented">
            <button
              onClick={() => onToggleCycle("monthly")}
              className={`segmented-btn ${billingCycle === "monthly" ? "active" : ""}`}
            >
              Monthly
            </button>
            <button
              onClick={() => onToggleCycle("annual")}
              className={`segmented-btn ${billingCycle === "annual" ? "active" : ""}`}
            >
              Annual (Save 20%)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <article className="rounded-2xl border border-gray-200 bg-white p-6 shadow">
            <h2 className="text-2xl font-bold">Free</h2>
            <p className="text-3xl font-extrabold mt-2">£0<span className="text-base text-gray-500"> / month</span></p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• Planner core</li>
              <li>• 60 AI actions / month</li>
              <li>• Motivation & streak basics</li>
            </ul>
            <button
              disabled={!isLoggedIn || status?.plan === "free"}
              className="mt-6 w-full rounded-lg bg-slate-900 text-white px-4 py-2 font-semibold disabled:opacity-50"
            >
              {!isLoggedIn ? "Log in to continue" : status?.plan === "free" ? "Current Plan" : "Continue Free"}
            </button>
          </article>

          <article className="rounded-2xl border-2 border-fuchsia-500 bg-gradient-to-b from-fuchsia-50 to-white p-6 shadow-2xl relative scale-[1.01]">
            <span className="absolute -top-3 right-4 text-xs px-2 py-1 bg-fuchsia-600 text-white rounded-full">Most Popular</span>
            <h2 className="text-2xl font-bold">Pro</h2>
            <p className="text-3xl font-extrabold mt-2">£{proDisplay}<span className="text-base text-gray-500"> / month</span></p>
            {billingCycle === "annual" ? <p className="text-xs text-fuchsia-700 mt-1">Billed annually. Equivalent monthly price shown.</p> : null}
            <p className="mt-2 text-sm text-fuchsia-700 font-medium">Includes 7-day free trial</p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• Everything in Free</li>
              <li>• 500 AI actions / month</li>
              <li>• Premium UX/perks enabled</li>
            </ul>
            <button onClick={() => startCheckout("pro")} disabled={!isLoggedIn || checkoutLoading !== null || status?.plan === "pro"} className="mt-6 w-full rounded-lg bg-fuchsia-600 text-white px-4 py-2 font-semibold hover:bg-fuchsia-700 disabled:opacity-60">
              {!isLoggedIn ? "Log in to upgrade" : status?.plan === "pro" ? "Current Plan" : checkoutLoading === "pro" ? "Opening checkout..." : "Start 7-day free trial"}
            </button>
          </article>

          <article className="rounded-2xl border-2 border-indigo-400 bg-white p-6 shadow-lg">
            <h2 className="text-2xl font-bold">Unlimited</h2>
            <p className="text-3xl font-extrabold mt-2">£{unlimitedDisplay}<span className="text-base text-gray-500"> / month</span></p>
            {billingCycle === "annual" ? <p className="text-xs text-indigo-700 mt-1">Billed annually. Equivalent monthly price shown.</p> : null}
            <p className="mt-2 text-sm text-indigo-700 font-medium">Includes 7-day free trial</p>
            <ul className="mt-4 space-y-2 text-gray-700">
              <li>• Everything in Pro</li>
              <li>
                • Unlimited AI (fair use)
                <button onClick={() => setShowFairUse(true)} className="ml-2 text-indigo-700 underline text-xs">What’s fair use?</button>
              </li>
              <li>• Priority processing</li>
            </ul>
            <button onClick={() => startCheckout("unlimited")} disabled={!isLoggedIn || checkoutLoading !== null || status?.plan === "unlimited"} className="mt-6 w-full rounded-lg bg-indigo-600 text-white px-4 py-2 font-semibold hover:bg-indigo-700 disabled:opacity-60">
              {!isLoggedIn ? "Log in to upgrade" : status?.plan === "unlimited" ? "Current Plan" : checkoutLoading === "unlimited" ? "Opening checkout..." : "Start Unlimited trial"}
            </button>
          </article>
        </div>

        <p className="text-sm text-slate-600">1 AI action = 1 AI generate/summarize/suggest request.</p>

        <section className="rounded-2xl border border-indigo-100 bg-white shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">Feature</th>
                <th className="text-left p-3">Free</th>
                <th className="text-left p-3">Pro</th>
                <th className="text-left p-3">Unlimited</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["AI actions/month", "60", "500", "Unlimited (fair use)"],
                ["Schedule AI", "✓", "✓", "✓"],
                ["Summarizer/notes AI", "✓", "✓", "✓"],
                ["Weekly plan optimization", "✓", "✓", "✓"],
                ["Motivation/streak features", "✓", "✓", "✓"],
                ["Priority processing", "—", "✓", "✓"],
                ["Support level", "Standard", "Priority email", "Priority + fast lane"],
              ].map((row, rowIndex) => (
                <tr key={row[0]} className="border-t border-slate-100">
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}-${cell}`} className="p-3 text-slate-700">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900 flex flex-wrap gap-3 justify-between">
          <span>Cancel anytime</span>
          <span>Secure checkout by Stripe</span>
          <span>No lock-in contracts</span>
          <span>Student-friendly pricing</span>
        </section>

        {checkoutError ? <p className="text-sm text-rose-600">{checkoutError}</p> : null}

        <div className="rounded-2xl bg-white card-hover border border-indigo-100 p-5 shadow flex flex-wrap gap-3 items-center justify-between">
          <p className="text-gray-700">Need plan controls? Open Billing Settings.</p>
          <div className="flex gap-3">
            <Link href="/settings/billing" className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50">Billing Settings</Link>
            <Link href="/schedule" className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">Open Schedule</Link>
          </div>
        </div>

        {showFairUse && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div className="bg-white max-w-md w-full rounded-2xl p-5 shadow-xl border border-indigo-100">
              <h3 className="text-lg font-bold text-slate-900">Fair-use policy (Unlimited plan)</h3>
              <p className="text-sm text-slate-700 mt-2">
                Normal student usage is unaffected. To protect platform stability, extreme bot-like or abusive sustained traffic is temporarily rate-limited.
              </p>
              <button onClick={() => setShowFairUse(false)} className="mt-4 rounded-lg bg-slate-900 text-white px-4 py-2">Got it</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
