"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import Mascot from "./components/mascot";

interface HomeMomentum {
  xp: number;
  level: number;
  streak: number;
  streakStatus: "safe" | "warming" | "risk";
  streakAdvice: string;
  nextBestAction: string;
}

interface DashboardToday {
  nextEvent: {
    title: string;
    day: string;
    type: string;
    start_hour: number;
    duration: number;
  } | null;
  priorities: Array<{
    id: number;
    title: string;
    day: string;
    type: string;
    startHour: number;
  }>;
  sessionsThisWeek: number;
  workoutsThisWeek: number;
  hasData: boolean;
}

const FOCUS_25 = 25 * 60;
const FOCUS_50 = 50 * 60;

const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Home() {
  const supabase = getSupabaseClient();
  const [momentum, setMomentum] = useState<HomeMomentum | null>(null);
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [timer, setTimer] = useState(FOCUS_25);
  const [running, setRunning] = useState(false);

  const [checkIn, setCheckIn] = useState({ done: 0, moved: 0, blocked: "" });

  useEffect(() => {
    if (!supabase) {
      setLoadError("App is not configured. Missing Supabase environment variables.");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const [{ data: userData }, { data: sessionData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession(),
        ]);

        const token = sessionData?.session?.access_token;
        if (!userData?.user || !token) {
          setLoading(false);
          return;
        }

        const [momentumRes, todayRes] = await Promise.all([
          fetch("/api/gamification/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/dashboard/today", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (momentumRes.ok) {
          const raw = (await momentumRes.json()) as Partial<HomeMomentum>;
          setMomentum({
            xp: raw.xp ?? 0,
            level: raw.level ?? 1,
            streak: raw.streak ?? 0,
            streakStatus: raw.streakStatus ?? "safe",
            streakAdvice: raw.streakAdvice ?? "Keep your streak alive with one focused session.",
            nextBestAction: raw.nextBestAction ?? "Do one 25-minute revision sprint now.",
          });
        }

        if (todayRes.ok) setToday((await todayRes.json()) as DashboardToday);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const streakTone =
    momentum?.streakStatus === "risk"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : momentum?.streakStatus === "warming"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  const timerText = useMemo(() => {
    const mm = String(Math.floor(timer / 60)).padStart(2, "0");
    const ss = String(timer % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [timer]);

  const deadlineRisk = useMemo(() => {
    const priorities = today?.priorities ?? [];
    const assignmentCount = priorities.filter((p) => p.type === "Assignment").length;
    const studyCount = priorities.filter((p) => p.type === "Study").length;

    if (!priorities.length) return { score: 0, label: "No data", hint: "Add assignments and study blocks to see risk." };

    const score = Math.min(100, Math.round(assignmentCount * 22 + Math.max(0, assignmentCount - studyCount) * 18));
    const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
    const hint =
      score >= 70
        ? "You’re assignment-heavy. Add 2+ focused study blocks today."
        : score >= 40
        ? "Moderate pressure. Keep a steady daily revision block."
        : "Healthy pace. Keep consistency to stay ahead.";

    return { score, label, hint };
  }, [today]);

  const examCountdown = useMemo(() => {
    const next = today?.nextEvent;
    if (!next) return "Add your next deadline to unlock countdowns.";

    const now = new Date();
    const currentDay = now.getDay();
    const targetDay = WEEK_DAYS.indexOf(next.day);
    if (targetDay < 0) return `Next item: ${next.title}`;

    const daysUntil = (targetDay - currentDay + 7) % 7;
    return daysUntil === 0
      ? `Today • ${next.title}`
      : `${daysUntil} day${daysUntil === 1 ? "" : "s"} until ${next.title}`;
  }, [today]);

  return (
    <main className="min-h-screen p-6 md:p-10">
      <section className="max-w-6xl mx-auto space-y-6">
        <Mascot mood={running ? "focus" : "happy"} message="Small daily wins beat last-minute panic. Let’s lock your next move." />

        <div className="rounded-2xl p-6 md:p-8 bg-gray-900 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">WeekWise AI</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Today Dashboard</h1>
          <p className="text-gray-300 mt-3 max-w-2xl">Plan in minutes, execute with focus, and protect your streak.</p>
        </div>

        {loadError && (
          <div className="card-soft p-4 border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button onClick={() => window.location.reload()} className="btn-secondary">Retry</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card-soft p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Deadline Intelligence</p>
            <p className="text-xl font-bold mt-1">Risk Score: {deadlineRisk.score}/100 ({deadlineRisk.label})</p>
            <p className="text-sm text-slate-600 mt-1">{deadlineRisk.hint}</p>
            <p className="text-sm text-indigo-700 mt-2 font-semibold">{examCountdown}</p>
            <Link href="/schedule" className="inline-block mt-3 text-indigo-700 text-sm font-semibold">Auto-plan in Schedule →</Link>
          </div>

          <div className="card-soft p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Daily Focus Engine</p>
            <p className="text-4xl font-bold mt-2">{timerText}</p>
            <div className="mt-3 flex gap-2 flex-wrap">
              <button onClick={() => setTimer(FOCUS_25)} className="btn-secondary text-sm">25m</button>
              <button onClick={() => setTimer(FOCUS_50)} className="btn-secondary text-sm">50m</button>
              <button onClick={() => setRunning((v) => !v)} className="btn-primary text-sm">
                {running ? "Pause" : "Start Focus"}
              </button>
              <button
                onClick={() => {
                  setRunning(false);
                  setTimer(FOCUS_25);
                }}
                className="btn-secondary text-sm"
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">Break prompt after each session. One tap to restart.</p>
          </div>

          <div className="card-soft p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Plan My Day</p>
            {today?.priorities?.length ? (
              <ul className="mt-2 space-y-2">
                {today.priorities.slice(0, 3).map((p) => (
                  <li key={p.id} className="text-sm border rounded-lg px-3 py-2 bg-indigo-50/60">
                    <span className="font-semibold">{p.title}</span>
                    <span className="text-slate-600"> • {p.day} {p.startHour}:00</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No priorities yet — add assignment/study events first.</p>
            )}
            <Link href="/schedule" className="inline-block mt-3 text-indigo-700 text-sm font-semibold">Open Schedule →</Link>
          </div>
        </div>

        <div className="card-soft p-5">
          <p className="text-xs uppercase tracking-wide text-slate-500">End-of-day check-in</p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <label className="text-sm">
              Done
              <input
                aria-label="tasks done"
                type="number"
                min={0}
                value={checkIn.done}
                onChange={(e) => setCheckIn((v) => ({ ...v, done: Number(e.target.value) }))}
                className="mt-1 w-full border p-2 rounded-lg"
              />
            </label>
            <label className="text-sm">
              Moved
              <input
                aria-label="tasks moved"
                type="number"
                min={0}
                value={checkIn.moved}
                onChange={(e) => setCheckIn((v) => ({ ...v, moved: Number(e.target.value) }))}
                className="mt-1 w-full border p-2 rounded-lg"
              />
            </label>
            <label className="text-sm md:col-span-2">
              Blocked by
              <input
                aria-label="blocked reason"
                value={checkIn.blocked}
                onChange={(e) => setCheckIn((v) => ({ ...v, blocked: e.target.value }))}
                placeholder="e.g. lab overran / low energy"
                className="mt-1 w-full border p-2 rounded-lg"
              />
            </label>
          </div>
          <p className="text-xs text-slate-500 mt-2">Use this to build consistency reports and smarter reminders.</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-32 rounded-2xl bg-white/80 animate-pulse border" />
            <div className="h-32 rounded-2xl bg-white/80 animate-pulse border" />
            <div className="h-32 rounded-2xl bg-white/80 animate-pulse border" />
          </div>
        ) : (
          momentum && (
            <div className={`rounded-2xl border p-5 shadow ${streakTone}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide opacity-80">Live Momentum Pulse</p>
                  <p className="text-2xl font-bold mt-1">Level {momentum.level} • {momentum.xp} XP • 🔥 {momentum.streak} day streak</p>
                  <p className="text-sm mt-1">{momentum.streakAdvice}</p>
                </div>
                <Link href="/momentum" className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black transition">Open Momentum</Link>
              </div>
              <p className="text-sm mt-3 font-medium">Next best action: {momentum.nextBestAction}</p>
            </div>
          )
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5">
          <FeatureCard title="📚 Academic Schedule" text="View, add, and optimize classes and assignments." href="/schedule" cta="Go to Schedule" color="bg-indigo-600 hover:bg-indigo-700" />
          <FeatureCard title="🏃 Fitness Tracker" text="Log workouts, track steps, and monitor progress." href="/fitness" cta="Go to Fitness" color="bg-emerald-600 hover:bg-emerald-700" />
          <FeatureCard title="📄 PDF Summarizer" text="Upload lecture slides and get concise summaries." href="/summarize" cta="Summarize PDFs" color="bg-violet-600 hover:bg-violet-700" />
          <FeatureCard title="⚡ Momentum" text="Track daily wins, XP and streak risk in one view." href="/momentum" cta="Open Momentum" color="bg-fuchsia-600 hover:bg-fuchsia-700" />
          <FeatureCard title="✍️ Essay Coach" text="Create outlines and improve your own draft quality." href="/essay" cta="Open Essay Coach" color="bg-amber-600 hover:bg-amber-700" />
          <FeatureCard title="👤 Profile" text="Manage your account and preferences." href="/profile" cta="Go to Profile" color="bg-gray-800 hover:bg-black" />
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ title, text, href, cta, color }: { title: string; text: string; href: string; cta: string; color: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow hover:shadow-lg transition">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-gray-600 mb-4">{text}</p>
      <Link href={href}>
        <button className={`${color} text-white px-4 py-2 rounded-lg transition`}>{cta}</button>
      </Link>
    </div>
  );
}
