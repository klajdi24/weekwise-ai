"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import Mascot from "../components/mascot";
import AchievementBurst from "../components/achievement-burst";

interface Badge {
  id: string;
  label: string;
  unlocked: boolean;
}

interface GamificationSummary {
  xp: number;
  level: number;
  levelProgressPct: number;
  streak: number;
  dailyGoalTarget: number;
  dailyGoalDone: number;
  badges: Badge[];
  isPremium: boolean;
}

interface SubscriptionStatus {
  isPremium: boolean;
  freeLimit: number;
  used: number;
  remaining: number;
  canUseAi: boolean;
  planLabel: string;
  cta: string;
}

export default function Profile() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const init = async () => {
      const { user: sessionUser } = await getClientAuth(supabase);
      setUser(sessionUser);
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  useEffect(() => {
    if (!supabase || !user) return;

    const fetchSummary = async () => {
      setSummaryLoading(true);
      setSummaryError(null);
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error("Missing auth session");

        const [summaryRes, subscriptionRes] = await Promise.all([
          fetch("/api/gamification/summary", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
          fetch("/api/subscription/status", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }),
        ]);

        const summaryData = (await summaryRes.json()) as Partial<GamificationSummary> & { error?: string };
        if (!summaryRes.ok) throw new Error(summaryData.error || "Failed to load progress summary");

        const subscriptionData = (await subscriptionRes.json()) as SubscriptionStatus & { error?: string };
        if (!subscriptionRes.ok) throw new Error(subscriptionData.error || "Failed to load subscription status");

        setSummary(summaryData as GamificationSummary);
        setSubscription(subscriptionData);
      } catch (e: unknown) {
        setSummaryError(e instanceof Error ? e.message : "Failed to load progress summary");
      } finally {
        setSummaryLoading(false);
      }
    };

    fetchSummary();
  }, [supabase, user]);

  const handleLogout = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/login");
  };

  const unlockedBadges = useMemo(() => summary?.badges?.filter((b) => b.unlocked) ?? [], [summary]);

  useEffect(() => {
    if (!summary) return;
    if ((summary.dailyGoalDone ?? 0) >= (summary.dailyGoalTarget ?? 999)) {
      setShowBurst(true);
    }
  }, [summary]);

  if (!supabase) return <p>App is not configured. Missing Supabase environment variables.</p>;
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Redirecting to login...</p>;

  return (
    <div className="min-h-screen app-surface p-6 md:p-8">
      <AchievementBurst show={showBurst} text="Daily goal achieved!" onDone={() => setShowBurst(false)} />
      <div className="max-w-5xl mx-auto space-y-6">
        <Mascot mood={showBurst ? "celebrate" : "happy"} message="You’re building a real study identity — keep the streak alive." />
        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-teal-300">Profile</p>
          <h1 className="page-title text-white mt-2">Progress & account</h1>
          <p className="text-teal-50/75 mt-3">Your momentum, rewards and account controls in one place.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Current XP</p>
            <p className="text-3xl font-bold mt-1">{summaryLoading ? "..." : summary?.xp ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Level</p>
            <p className="text-3xl font-bold mt-1">{summaryLoading ? "..." : summary?.level ?? 1}</p>
          </div>
          <div className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Streak</p>
            <p className="text-3xl font-bold mt-1">🔥 {summaryLoading ? "..." : summary?.streak ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Plan</p>
            <p className="text-2xl font-bold mt-1">{summaryLoading ? "..." : summary?.isPremium ? "Premium" : "Free"}</p>
          </div>
        </section>

        <section className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Level Progress</h2>
            <span className="text-sm text-slate-500">{summary?.levelProgressPct ?? 0}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-700"
              style={{ width: `${summary?.levelProgressPct ?? 0}%` }}
            />
          </div>

          <div className="mt-6">
            <h3 className="font-semibold mb-2">Daily Goal</h3>
            <p className="text-sm text-slate-600 mb-2">
              Complete {summary?.dailyGoalDone ?? 0} / {summary?.dailyGoalTarget ?? 0} key actions today.
            </p>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-700"
                style={{
                  width: `${
                    summary?.dailyGoalTarget
                      ? Math.min(100, Math.round(((summary?.dailyGoalDone ?? 0) / summary.dailyGoalTarget) * 100))
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-6">
          <h2 className="text-xl font-semibold mb-3">Badges</h2>

          {summaryLoading && <p className="text-slate-500">Loading badge progress...</p>}
          {summaryError && <p className="text-red-600">{summaryError}</p>}

          {!summaryLoading && !summaryError && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(summary?.badges ?? []).map((badge) => (
                <div
                  key={badge.id}
                  className={`rounded-xl border p-3 transition ${
                    badge.unlocked
                      ? "bg-amber-50 border-amber-300 text-amber-900"
                      : "bg-slate-50 border-slate-200 text-slate-500"
                  }`}
                >
                  <p className="font-semibold">{badge.unlocked ? "🏅" : "🔒"} {badge.label}</p>
                </div>
              ))}
            </div>
          )}

          <p className="text-xs text-slate-500 mt-4">Unlocked: {unlockedBadges.length}</p>
        </section>

        <section className="rounded-2xl bg-white card-hover border border-teal-100 shadow p-6">
          <h2 className="text-xl font-semibold mb-2">Subscription</h2>
          <p className="text-sm text-slate-600">
            Plan: <span className="font-semibold text-slate-900">{subscription?.planLabel ?? (summary?.isPremium ? "Premium" : "Free")}</span>
          </p>
          {!subscription?.isPremium && (
            <p className="text-sm text-slate-600 mt-1">
              AI uses remaining: <span className="font-semibold text-slate-900">{subscription?.remaining ?? 0}/{subscription?.freeLimit ?? 3}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/pricing" className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 transition">
              {subscription?.cta ?? "Upgrade for unlimited AI features"}
            </Link>
            <Link href="/schedule" className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition">
              Use AI in Schedule
            </Link>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow border border-gray-100 max-w-md">
          <label className="block text-gray-600 font-semibold mb-1">Email</label>
          <input type="email" value={user.email || ""} className="w-full input-polish p-2 rounded mb-4" disabled />

          <button
            onClick={handleLogout}
            className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition"
          >
            Log Out
          </button>
        </section>
      </div>
    </div>
  );
}
