"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";

interface HomeMomentum {
  xp: number;
  level: number;
  streak: number;
  streakStatus: "safe" | "warming" | "risk";
  streakAdvice: string;
  nextBestAction: string;
}

export default function Home() {
  const supabase = getSupabaseClient();
  const [momentum, setMomentum] = useState<HomeMomentum | null>(null);

  useEffect(() => {
    if (!supabase) return;

    const loadMomentum = async () => {
      const [{ data: userData }, { data: sessionData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.auth.getSession(),
      ]);

      const token = sessionData?.session?.access_token;
      if (!userData?.user || !token) return;

      const res = await fetch("/api/gamification/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return;
      const data = (await res.json()) as HomeMomentum;
      setMomentum(data);
    };

    loadMomentum();
  }, [supabase]);

  const streakTone =
    momentum?.streakStatus === "risk"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : momentum?.streakStatus === "warming"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-emerald-200 bg-emerald-50 text-emerald-900";

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 text-gray-900 p-6 md:p-10">
      <section className="max-w-6xl mx-auto space-y-6">
        <div className="rounded-2xl p-6 md:p-8 bg-gray-900 text-white shadow-xl">
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300">WeekWise AI</p>
          <h1 className="text-3xl md:text-4xl font-bold mt-2">Build momentum every day.</h1>
          <p className="text-gray-300 mt-3 max-w-2xl">
            Plan study blocks, train consistently, summarize faster, and stay motivated with progress-first routines.
          </p>
        </div>

        {momentum && (
          <div className={`rounded-2xl border p-5 shadow ${streakTone}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide opacity-80">Live Momentum Pulse</p>
                <p className="text-2xl font-bold mt-1">Level {momentum.level} • {momentum.xp} XP • 🔥 {momentum.streak} day streak</p>
                <p className="text-sm mt-1">{momentum.streakAdvice}</p>
              </div>
              <Link href="/momentum" className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black transition">
                Open Momentum
              </Link>
            </div>
            <p className="text-sm mt-3 font-medium">Next best action: {momentum.nextBestAction}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-5">
          <div className="bg-white p-6 rounded-2xl border border-indigo-100 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">📚 Academic Schedule</h2>
            <p className="text-gray-600 mb-4">View, add, and optimize classes and assignments.</p>
            <Link href="/schedule">
              <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">Go to Schedule</button>
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">🏃 Fitness Tracker</h2>
            <p className="text-gray-600 mb-4">Log workouts, track steps, and monitor progress.</p>
            <Link href="/fitness">
              <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">Go to Fitness</button>
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-violet-100 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">📄 PDF Summarizer</h2>
            <p className="text-gray-600 mb-4">Upload lecture slides and get concise summaries.</p>
            <Link href="/summarize">
              <button className="bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition">Summarize PDFs</button>
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-fuchsia-100 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">⚡ Momentum</h2>
            <p className="text-gray-600 mb-4">Track daily wins, XP and streak risk in one view.</p>
            <Link href="/momentum">
              <button className="bg-fuchsia-600 text-white px-4 py-2 rounded-lg hover:bg-fuchsia-700 transition">Open Momentum</button>
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-amber-100 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">✍️ Essay Coach</h2>
            <p className="text-gray-600 mb-4">Create outlines, drafts, and improved essays with study checklists.</p>
            <Link href="/essay">
              <button className="bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition">Open Essay Coach</button>
            </Link>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow hover:shadow-lg transition">
            <h2 className="text-xl font-semibold mb-2">👤 Profile</h2>
            <p className="text-gray-600 mb-4">Manage your account and preferences.</p>
            <Link href="/profile">
              <button className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-black transition">Go to Profile</button>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
