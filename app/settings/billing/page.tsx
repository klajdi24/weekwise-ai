"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";

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
      const { user } = await getClientAuth(supabase);
      if (!user) return;
      await supabase.from("analytics_events").insert({
        user_id: user.id,
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
    <div className="min-h-screen app-surface p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-violet-300">Billing</p>
          <h1 className="page-title mt-2">Billing settings</h1>
          <p className="text-[var(--muted)] mt-3">Manage your plan, quota usage, and billing controls.</p>
        </section>

        {loading ? <p>Loading billing status...</p> : null}
        {error ? <p className="text-rose-300">{error}</p> : null}

        {status && !loading && (
          <>
            <section className="rounded-2xl border border-violet-400/30 bg-white/[0.05] backdrop-blur-xl p-5 shadow space-y-3">
              <p className="text-sm text-[var(--muted)]">Current plan</p>
              <p className="text-2xl font-bold">{status.planLabel}</p>
              <p className="text-sm text-[var(--foreground)]">Reset date: {new Date(status.resetAt).toLocaleDateString()}</p>

              {status.plan === "unlimited" ? (
                <p className="text-sm text-violet-200">Unlimited (fair use)</p>
              ) : (
                <>
                  <p className="text-sm text-[var(--foreground)]">Usage: {status.used}/{status.freeLimit}</p>
                  <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-violet-500" style={{ width: `${usageWidth}%` }} />
                  </div>
                </>
              )}

              {status.nearLimit && status.plan !== "unlimited" ? (
                <p className="text-sm text-violet-200">You are near your limit. Upgrade to avoid interruption.</p>
              ) : null}
            </section>

            <section className="rounded-2xl border border-violet-400/30 bg-white/[0.05] backdrop-blur-xl p-5 shadow space-y-4">
              <div className="segmented">
                <button
                  onClick={() => setInterval("monthly")}
                  className={`segmented-btn ${interval === "monthly" ? "active" : ""}`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setInterval("annual")}
                  className={`segmented-btn ${interval === "annual" ? "active" : ""}`}
                >
                  Annual
                </button>
              </div>

              <div className="flex flex-wrap gap-3">
              <button
                onClick={() => startCheckout("pro")}
                disabled={busyPlan !== null || status.plan === "pro"}
                className="btn-accent disabled:opacity-60"
              >
                {status.plan === "pro" ? "Current Pro Plan" : busyPlan === "pro" ? "Starting..." : "Upgrade to Pro"}
              </button>
              <button
                onClick={() => startCheckout("unlimited")}
                disabled={busyPlan !== null || status.plan === "unlimited"}
                className="btn-accent disabled:opacity-60"
              >
                {status.plan === "unlimited" ? "Current Unlimited Plan" : busyPlan === "unlimited" ? "Starting..." : "Upgrade to Unlimited"}
              </button>
              <button onClick={openPortal} disabled={portalBusy} className="rounded-lg border border-white/10 px-4 py-2">
                {portalBusy ? "Opening..." : "Manage billing portal"}
              </button>
              <button onClick={downgradeToFree} disabled={changeBusy || status.plan === "free"} className="rounded-lg border border-rose-400/35 text-rose-200 px-4 py-2 disabled:opacity-60">
                {status.plan === "free" ? "Already on Free" : changeBusy ? "Downgrading..." : "Downgrade to Free"}
              </button>
              </div>
            </section>
          </>
        )}

        <Link href="/pricing" className="text-violet-200 underline">Back to pricing</Link>
      </div>
    </div>
  );
}
