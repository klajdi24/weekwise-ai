"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import PageShell, { PageHero } from "../components/page-shell";
import Reveal from "../components/reveal";
import Mascot from "../components/mascot";

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
        const { user, accessToken: token } = await getClientAuth(supabase);

        if (!user || !token) {
          router.replace("/login");
          return;
        }

        const res = await fetch("/api/gamification/summary", {
          headers: { Authorization: `Bearer ${token}` },
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
      ? "Safe"
      : summary?.streakStatus === "warming"
        ? "Building"
        : "At risk";

  const streakTone =
    summary?.streakStatus === "risk"
      ? "text-rose-300"
      : summary?.streakStatus === "warming"
        ? "text-violet-300"
        : "text-violet-300";

  return (
    <PageShell>
      <Reveal>
        <div className="reveal-item">
          <Mascot
            mood={summary?.streakStatus === "safe" ? "celebrate" : "happy"}
            message="Your streak is a habit engine — protect it with one small win today."
          />
        </div>

        <div className="reveal-item">
          <PageHero
            eyebrow="Momentum"
            title="Daily momentum centre"
            subtitle="Live progress from your schedule and fitness — turn activity into XP and streak safety."
            meta={
              <>
                <span className="stat-chip">{completionPct}% checklist</span>
                <span className="stat-chip">+{earnedXp} XP today</span>
                <span className={`stat-chip ${streakTone}`}>{streakLabel} streak</span>
              </>
            }
          />
        </div>

        <div className="reveal-item grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Checklist", value: loading ? "…" : `${completionPct}%` },
            { label: "XP earned today", value: loading ? "…" : `+${earnedXp}` },
            { label: "Streak", value: loading ? "…" : streakLabel },
            { label: "Consistency", value: loading ? "…" : `${summary?.consistencyScore ?? 0}` },
          ].map((s) => (
            <div key={s.label} className="card-soft p-4 card-hover">
              <p className="eyebrow text-[var(--muted)]">{s.label}</p>
              <p className="font-display text-3xl font-bold mt-2 text-[var(--ink)]">{s.value}</p>
            </div>
          ))}
        </div>

        <section className="reveal-item grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 card-soft p-6">
            <h2 className="section-title text-[var(--ink)]">Today&apos;s power checklist</h2>
            <p className="helper-text mt-1">Generated from your real app activity.</p>

            {loading && (
              <div className="mt-4 space-y-3">
                <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
                <div className="h-16 rounded-xl bg-white/10 animate-pulse" />
              </div>
            )}
            {error && <p className="mt-4 text-rose-300 text-sm">{error}</p>}

            {!loading && !error && (
              <div className="mt-5 space-y-3">
                {(summary?.checklist ?? []).map((item) => (
                  <div
                    key={item.id}
                    className={`p-4 rounded-2xl border transition-all duration-300 ${
                      item.done ? "border-violet-400/30 bg-violet-500/10 shadow-sm" : "border-white/10 bg-white/[0.05] backdrop-blur-xl"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[var(--ink)]">
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${item.done ? "bg-violet-500" : "bg-zinc-300"}`} />
                          {item.label}
                        </p>
                        <p className="text-sm text-[var(--muted)] mt-1">Reward: +{item.xp} XP</p>
                      </div>
                      <span className={`text-sm font-semibold ${item.done ? "text-violet-200" : "text-[var(--muted)]"}`}>
                        {item.done ? "Done" : "Pending"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card-soft p-5 space-y-5">
            <div>
              <h3 className="font-display text-xl font-semibold text-[var(--ink)]">Level progress</h3>
              <p className="text-sm text-[var(--foreground)] mt-1">
                Level {summary?.level ?? 1} · {summary?.xp ?? 0} XP
              </p>
              <div className="mt-3 w-full bg-white/10 rounded-full h-2.5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-700 to-violet-400 transition-all duration-700"
                  style={{ width: `${summary?.levelProgressPct ?? 0}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)] mt-2">{summary?.xpToNextLevel ?? 0} XP to next level</p>
            </div>

            <div className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4">
              <p className="eyebrow text-violet-200">Daily goal</p>
              <p className="text-sm mt-2 text-[var(--ink)]">
                {summary?.dailyGoalDone ?? 0}/{summary?.dailyGoalTarget ?? 0} key actions completed.
              </p>
              <p className="text-xs text-[var(--muted)] mt-2">
                Last workout:{" "}
                {summary?.latestWorkoutAt ? new Date(summary.latestWorkoutAt).toLocaleString() : "No workouts yet"}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/schedule" className="btn-primary w-full">
                Open Schedule
              </Link>
              <Link href="/fitness" className="btn-secondary w-full">
                Open Fitness
              </Link>
              <Link href="/summarize" className="btn-ghost w-full">
                Open Summarizer
              </Link>
            </div>
          </div>
        </section>
      </Reveal>
    </PageShell>
  );
}
