"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

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

const FOCUS_SECONDS = 25 * 60;

export default function Home() {
  const supabase = getSupabaseClient();
  const [momentum, setMomentum] = useState<HomeMomentum | null>(null);
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [timer, setTimer] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    const loadData = async () => {
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      const token = sessionData?.session?.access_token;
      if (!userData?.user || !token) return;

      const [momentumRes, todayRes] = await Promise.all([
        fetch("/api/gamification/summary", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/dashboard/today", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (momentumRes.ok) setMomentum((await momentumRes.json()) as HomeMomentum);
      if (todayRes.ok) setToday((await todayRes.json()) as DashboardToday);
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

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 text-gray-900 p-6 md:p-10">
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl p-6 md:p-8 bg-gray-900 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">WeekWise AI</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Today Dashboard</h1>
          <p className="text-gray-300 mt-3 max-w-2xl">Know your next move, lock focus blocks, and protect your streak.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-2xl bg-white border border-indigo-100 shadow p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Next Class / Deadline</p>
            {today?.nextEvent ? (
              <>
                <p className="text-xl font-bold mt-1">{today.nextEvent.title}</p>
                <p className="text-sm text-slate-600 mt-1">
                  {today.nextEvent.day} • {today.nextEvent.start_hour}:00 • {today.nextEvent.type}
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No upcoming items yet. Add one in Schedule.</p>
            )}
            <Link href="/schedule" className="inline-block mt-3 text-indigo-700 text-sm font-semibold">Open Schedule →</Link>
          </div>

          <div className="rounded-2xl bg-white border border-indigo-100 shadow p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Top 3 Priorities</p>
            {today?.priorities?.length ? (
              <ul className="mt-2 space-y-2">
                {today.priorities.map((p) => (
                  <li key={p.id} className="text-sm border rounded-lg px-3 py-2 bg-indigo-50/60">
                    <span className="font-semibold">{p.title}</span>
                    <span className="text-slate-600"> • {p.day} {p.startHour}:00</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500 mt-2">No priorities yet — add assignment/study events.</p>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-indigo-100 shadow p-5">
            <p className="text-xs uppercase tracking-wide text-slate-500">Focus Timer Quick Start</p>
            <p className="text-4xl font-bold mt-2">{timerText}</p>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setRunning((v) => !v)} className="px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                {running ? "Pause" : "Start"}
              </button>
              <button
                onClick={() => {
                  setRunning(false);
                  setTimer(FOCUS_SECONDS);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-2">25-minute focus sprint.</p>
          </div>
        </div>

        {momentum && (
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
