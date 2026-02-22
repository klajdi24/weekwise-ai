"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Workout } from "@/lib/types";
import Mascot from "../components/mascot";
import AchievementBurst from "../components/achievement-burst";

interface GamificationSummary {
  xp: number;
  level: number;
  streak: number;
  dailyGoalTarget: number;
  dailyGoalDone: number;
}

export default function FitnessPage() {
  const supabase = getSupabaseClient();
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [steps, setSteps] = useState(2000);

  const [summary, setSummary] = useState<GamificationSummary | null>(null);
  const [showBurst, setShowBurst] = useState(false);

  useEffect(() => {
    if (!supabase) return;

    let active = true;

    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error("User fetch error:", error);

      if (active) {
        setUser(data?.user || null);
        setLoadingUser(false);
      }
    };

    fetchUser();

    return () => {
      active = false;
    };
  }, [supabase]);

  useEffect(() => {
    if (!loadingUser && !user) router.replace("/login");
  }, [loadingUser, user, router]);

  useEffect(() => {
    let active = true;

    const fetchWorkouts = async () => {
      if (!user) {
        if (active) {
          setWorkouts([]);
          setLoadingWorkouts(false);
        }
        return;
      }

      const { data, error } = await supabase.from("workouts").select("*").eq("user_id", user.id);

      if (error) console.error("Error fetching workouts:", error);

      if (active) {
        setWorkouts((data as Workout[]) || []);
        setLoadingWorkouts(false);
      }
    };

    fetchWorkouts();

    return () => {
      active = false;
    };
  }, [user, supabase]);

  useEffect(() => {
    if (!supabase || !user) return;

    const fetchSummary = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) return;

        const res = await fetch("/api/gamification/summary", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) return;
        const data = (await res.json()) as GamificationSummary;
        setSummary(data);
      } catch (e) {
        console.error("Summary fetch failed", e);
      }
    };

    fetchSummary();
  }, [supabase, user, workouts.length]);

  const addWorkout = async () => {
    if (!supabase || !name.trim() || !user) return;

    const tempWorkout: Workout = {
      id: Date.now(),
      user_id: user.id,
      name: name.trim(),
      date: new Date().toISOString(),
      duration,
      steps,
    };

    setWorkouts((prev) => [...prev, tempWorkout]);
    setName("");

    const { data, error } = await supabase
      .from("workouts")
      .insert([
        {
          user_id: user.id,
          name: tempWorkout.name,
          date: tempWorkout.date,
          duration,
          steps,
        },
      ])
      .select();

    if (error) {
      console.error("Insert error:", error);
      alert("Failed to add workout. Please try again.");
      setWorkouts((prev) => prev.filter((w) => w.id !== tempWorkout.id));
      return;
    }

    if (data && data.length > 0) {
      setWorkouts((prev) => prev.map((w) => (w.id === tempWorkout.id ? (data[0] as Workout) : w)));
      setShowBurst(true);
    }
  };

  const totalSteps = useMemo(() => workouts.reduce((acc, w) => acc + Number(w.steps || 0), 0), [workouts]);

  if (!supabase) return <p>App is not configured. Missing Supabase environment variables.</p>;
  if (loadingUser) return <p>Loading user...</p>;
  if (!user) return <p>Redirecting to login...</p>;
  if (loadingWorkouts) return <p>Loading workouts...</p>;

  return (
    <main className="min-h-screen app-surface p-6 md:p-8">
      <AchievementBurst show={showBurst} text="Workout logged! +Momentum" onDone={() => setShowBurst(false)} />
      <div className="max-w-6xl mx-auto space-y-6">
        <Mascot mood={showBurst ? "celebrate" : "focus"} message="Train body, sharpen focus. Every workout protects your streak." />
        <section className="rounded-2xl bg-slate-900 text-white p-6 md:p-8 shadow-xl">
          <h1 className="text-3xl font-bold">🏋️ Fitness & Energy</h1>
          <p className="text-slate-300 mt-2">Stay physically active to keep your study performance sharp and your streak alive.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/schedule" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition">↔ Schedule</Link>
            <Link href="/momentum" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition">⚡ Momentum</Link>
            <Link href="/profile" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition">👤 Profile</Link>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white card-hover border border-emerald-100 shadow p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Workouts</p>
            <p className="text-3xl font-bold mt-1">{workouts.length}</p>
          </div>
          <div className="rounded-2xl bg-white card-hover border border-emerald-100 shadow p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Total Steps</p>
            <p className="text-3xl font-bold mt-1">{totalSteps.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl bg-white card-hover border border-emerald-100 shadow p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">XP</p>
            <p className="text-3xl font-bold mt-1">{summary?.xp ?? 0}</p>
          </div>
          <div className="rounded-2xl bg-white card-hover border border-emerald-100 shadow p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">Streak</p>
            <p className="text-3xl font-bold mt-1">🔥 {summary?.streak ?? 0}</p>
          </div>
        </section>

        <section className="bg-white p-6 rounded-2xl border border-emerald-100 shadow">
          <h2 className="text-xl font-semibold mb-4">Add Workout</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Workout Name"
              className="border p-2 rounded-lg"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="border p-2 rounded-lg"
              placeholder="Duration (min)"
            />
            <input
              type="number"
              min={0}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="border p-2 rounded-lg"
              placeholder="Steps"
            />
            <button onClick={addWorkout} className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition">
              Add Workout
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Daily goal progress: {summary?.dailyGoalDone ?? 0}/{summary?.dailyGoalTarget ?? 0}
          </p>
        </section>

        <section className="bg-white p-6 rounded-2xl shadow border border-emerald-100">
          <h2 className="text-xl font-semibold mb-4">Recent Workouts</h2>
          {workouts.length === 0 ? (
            <p className="text-slate-500">No workouts yet. Add your first one and build momentum.</p>
          ) : (
            <ul className="space-y-2">
              {workouts
                .slice()
                .reverse()
                .map((w) => (
                  <li key={w.id} className="p-3 border rounded-lg flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{w.name}</p>
                      <p className="text-sm text-slate-500">{new Date(w.date).toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">{w.duration}m • {w.steps} steps</p>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
