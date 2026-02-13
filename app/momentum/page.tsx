"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  xp: number;
}

interface MomentumSummary {
  xp: number;
  level: number;
  levelProgressPct: number;
  xpToNextLevel: number;
  consistencyScore: number;
  streak: number;
  streakStatus: "safe" | "warming" | "risk";
  dailyGoalTarget: number;
  dailyGoalDone: number;
  checklist: ChecklistItem[];
  latestWorkoutAt: string | null;
}

export default function MomentumPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [summary, setSummary] = useState<MomentumSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError("App is not configured. Missing Supabase environment variables.");
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const [{ data: userData }, { data: sessionData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        const user = userData?.user;
        const token = sessionData?.session?.access_token;

        if (!user || !token) {
          router.replace("/login");
          return;
        }

        const res = await fetch("/api/gamification/summary", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = (await res.json()) as MomentumSummary & { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to load momentum summary");

        setSummary(data);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load momentum summary");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [supabase, router]);

  const checklistDone = useMemo(() => summary?.checklist.filter((item) => item.done).length ?? 0, [summary]);
  const checklistSize = summary?.checklist.length ?? 0;
  const completionPct = checklistSize > 0 ? Math.round((checklistDone / checklistSize) * 100) : 0;
  const earnedXp = useMemo(
    () => summary?.checklist.filter((item) => item.done).reduce((acc, item) => acc + item.xp, 0) ?? 0,
    [summary]
  );

  const streakLabel =
    summary?.streakStatus === "safe"
      ? "🔥 Safe"
      : summary?.streakStatus === "warming"
      ? "⚡ Building"
      : "⚠️ At Risk";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-900 text-white p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <section className="rounded-3xl border border-white/20 bg-white/10 backdrop-blur-xl p-6 md:p-8 shadow-2xl">
          <p className="text-xs uppercase tracking-[0.2em] text-violet-200">WeekWise Momentum</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Your Daily Momentum Center</h1>
          <p className="text-violet-100/90 mt-3 max-w-2xl">Live progress from your schedule and fitness data.</p>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-2xl bg-white card-hover/10 border border-white/20 p-4">
              <p className="text-xs text-violet-200">Checklist Completion</p>
              <p className="text-3xl font-bold mt-1">{loading ? "..." : `${completionPct}%`}</p>
            </div>
            <div className="rounded-2xl bg-white card-hover/10 border border-white/20 p-4">
              <p className="text-xs text-violet-200">XP Earned Today</p>
              <p className="text-3xl font-bold mt-1">{loading ? "..." : `+${earnedXp}`}</p>
            </div>
            <div className="rounded-2xl bg-white card-hover/10 border border-white/20 p-4">
              <p className="text-xs text-violet-200">Streak Status</p>
              <p className="text-3xl font-bold mt-1">{loading ? "..." : streakLabel}</p>
            </div>
            <div className="rounded-2xl bg-white card-hover/10 border border-white/20 p-4">
              <p className="text-xs text-violet-200">Consistency</p>
              <p className="text-3xl font-bold mt-1">{loading ? "..." : `${summary?.consistencyScore ?? 0}`}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 rounded-3xl bg-white text-slate-900 p-6 shadow-2xl">
            <h2 className="text-2xl font-bold">Today&apos;s Power Checklist</h2>
            <p className="text-slate-600 mt-1">These are generated from your real app activity.</p>

            {loading && <p className="mt-4 text-slate-500">Loading checklist...</p>}
            {error && <p className="mt-4 text-red-600">{error}</p>}

            {!loading && !error && (
              <div className="mt-5 space-y-3">
                {(summary?.checklist ?? []).map((item) => (
                  <div
                    key={item.id}
                    className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 ${
                      item.done
                        ? "border-emerald-300 bg-emerald-50 shadow-md"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold">{item.done ? "✅" : "⭕"} {item.label}</p>
                        <p className="text-sm text-slate-500 mt-1">Reward: +{item.xp} XP</p>
                      </div>
                      <span className="text-sm font-semibold text-violet-700">{item.done ? "Done" : "Pending"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl p-5 shadow-2xl space-y-4">
            <div>
              <h3 className="text-xl font-bold">Level Progress</h3>
              <p className="text-sm text-violet-100 mt-1">Level {summary?.level ?? 1} • {summary?.xp ?? 0} XP</p>
              <div className="mt-3 w-full bg-white/20 rounded-full h-2 overflow-hidden">
                <div className="h-full bg-emerald-400 transition-all duration-700" style={{ width: `${summary?.levelProgressPct ?? 0}%` }} />
              </div>
              <p className="text-xs text-violet-100 mt-2">{summary?.xpToNextLevel ?? 0} XP to next level</p>
            </div>

            <div className="rounded-2xl bg-black/20 border border-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-violet-200">Daily Goal</p>
              <p className="text-sm mt-2 text-violet-50">
                {summary?.dailyGoalDone ?? 0}/{summary?.dailyGoalTarget ?? 0} key actions completed.
              </p>
              <p className="text-xs text-violet-200 mt-2">
                Last workout: {summary?.latestWorkoutAt ? new Date(summary.latestWorkoutAt).toLocaleString() : "No workouts yet"}
              </p>
            </div>

            <div className="mt-2 flex flex-col gap-3">
              <Link href="/schedule" className="rounded-xl bg-indigo-500 hover:bg-indigo-400 px-4 py-3 font-semibold transition">Open Schedule</Link>
              <Link href="/fitness" className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-3 font-semibold transition">Open Fitness</Link>
              <Link href="/summarize" className="rounded-xl bg-violet-500 hover:bg-violet-400 px-4 py-3 font-semibold transition">Open Summarizer</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
