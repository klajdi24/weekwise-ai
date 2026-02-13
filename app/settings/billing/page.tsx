"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";

type BillingPlan = "pro" | "unlimited";
type BillingInterval = "monthly" | "annual";

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
  billingInterval: BillingInterval;
  cta: string;
}

export default function BillingSettingsPage() {
  const supabase = getSupabaseClient();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPlan, setBusyPlan] = useState<BillingPlan | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [changeBusy, setChangeBusy] = useState(false);
  const [interval, setInterval] = useState<BillingInterval>("monthly");

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
      // no-op
    }
  };

  useEffect(() => {
    if (!supabase) return;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;
        if (!token) throw new Error("Please log in to manage billing.");

        const res = await fetch("/api/subscription/status", {
          headers: { Authorization: `Bearer ${token}` },
        });

        const payload = (await res.json()) as SubscriptionStatus & { error?: string };
        if (!res.ok) throw new Error(payload.error || "Failed to load billing status.");
        setStatus(payload);
        setInterval(payload.billingInterval ?? "monthly");
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load billing status.");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supabase]);

  const startCheckout = async (plan: BillingPlan) => {
    if (!supabase) return;
    setBusyPlan(plan);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please log in first.");

      await trackEvent("plan_cta_clicked", { plan, interval, location: "billing_settings" });
      await trackEvent("checkout_started", { plan, interval, location: "billing_settings" });

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan, interval }),
      });

      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error || "Could not start checkout");

      window.location.assign(payload.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start checkout");
    } finally {
      setBusyPlan(null);
    }
  };

  const downgradeToFree = async () => {
    if (!supabase) return;
    setChangeBusy(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please log in first.");

      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plan: "free" }),
      });

      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error || "Could not downgrade plan");

      await trackEvent("plan_cta_clicked", { plan: "free", location: "billing_settings" });
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not downgrade plan");
    } finally {
      setChangeBusy(false);
    }
  };

  const openPortal = async () => {
    if (!supabase) return;
    setPortalBusy(true);
    setError(null);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Please log in first.");

      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !payload.url) throw new Error(payload.error || "Billing portal unavailable");

      await trackEvent("billing_portal_opened", { source: "settings_billing" });
      window.location.assign(payload.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Billing portal unavailable");
    } finally {
      setPortalBusy(false);
    }
  };

  const usageWidth = useMemo(() => Math.min(100, status?.usagePct ?? 0), [status?.usagePct]);

  return (
    <main className="min-h-screen app-surface p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="rounded-2xl bg-slate-900 text-white p-6 shadow-xl">
          <h1 className="text-3xl font-bold">Billing Settings</h1>
          <p className="text-slate-300 mt-2">Manage your plan, quota usage, and billing controls.</p>
        </section>

        {loading ? <p>Loading billing status...</p> : null}
        {error ? <p className="text-rose-600">{error}</p> : null}

        {status && !loading && (
          <>
            <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow space-y-3">
              <p className="text-sm text-slate-500">Current plan</p>
              <p className="text-2xl font-bold">{status.planLabel}</p>
              <p className="text-sm text-slate-600">Reset date: {new Date(status.resetAt).toLocaleDateString()}</p>

              {status.plan === "unlimited" ? (
                <p className="text-sm text-indigo-700">Unlimited (fair use)</p>
              ) : (
                <>
                  <p className="text-sm text-slate-700">Usage: {status.used}/{status.freeLimit}</p>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className="h-full bg-indigo-500" style={{ width: `${usageWidth}%` }} />
                  </div>
                </>
              )}

              {status.nearLimit && status.plan !== "unlimited" ? (
                <p className="text-sm text-amber-700">You are near your limit. Upgrade to avoid interruption.</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-indigo-100 bg-white p-5 shadow space-y-4">
              <div className="inline-flex rounded-full border border-slate-300 p-1 bg-slate-50">
                <button
                  onClick={() => setInterval("monthly")}
                  className={`px-4 py-1.5 rounded-full text-sm ${interval === "monthly" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setInterval("annual")}
                  className={`px-4 py-1.5 rounded-full text-sm ${interval === "annual" ? "bg-slate-900 text-white" : "text-slate-600"}`}
                >
                  Annual
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
              <button
                onClick={() => startCheckout("pro")}
                disabled={busyPlan !== null || status.plan === "pro"}
                className="rounded-lg bg-fuchsia-600 text-white px-4 py-2 disabled:opacity-60"
              >
                {status.plan === "pro" ? "Current Pro Plan" : busyPlan === "pro" ? "Starting..." : "Upgrade to Pro"}
              </button>
              <button
                onClick={() => startCheckout("unlimited")}
                disabled={busyPlan !== null || status.plan === "unlimited"}
                className="rounded-lg bg-indigo-600 text-white px-4 py-2 disabled:opacity-60"
              >
                {status.plan === "unlimited" ? "Current Unlimited Plan" : busyPlan === "unlimited" ? "Starting..." : "Upgrade to Unlimited"}
              </button>
              <button onClick={openPortal} disabled={portalBusy} className="rounded-lg border border-slate-300 px-4 py-2">
                {portalBusy ? "Opening..." : "Manage billing portal"}
              </button>
              <button onClick={downgradeToFree} disabled={changeBusy || status.plan === "free"} className="rounded-lg border border-rose-300 text-rose-700 px-4 py-2 disabled:opacity-60">
                {status.plan === "free" ? "Already on Free" : changeBusy ? "Downgrading..." : "Downgrade to Free"}
              </button>
              </div>
            </section>
          </>
        )}

        <Link href="/pricing" className="text-indigo-700 underline">Back to pricing</Link>
      </div>
    </main>
  );
}
