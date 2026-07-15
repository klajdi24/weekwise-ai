"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
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
      const { user: sessionUser } = await getClientAuth(supabase);

      if (active) {
        setUser(sessionUser);
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

  if (!supabase) {
    return (
      <div className="app-surface min-h-full p-6">
        <p className="card-soft p-4 text-rose-700">App is not configured. Missing Supabase environment variables.</p>
      </div>
    );
  }
  if (loadingUser || !user || loadingWorkouts) {
    return (
      <div className="min-h-screen app-surface p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-4 app-layer">
          <div className="h-36 rounded-3xl bg-white/70 animate-pulse" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 rounded-2xl bg-white/70 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen app-surface p-6 md:p-8">
      <AchievementBurst show={showBurst} text="Workout logged! +Momentum" onDone={() => setShowBurst(false)} />
      <div className="max-w-6xl mx-auto space-y-6 app-layer">
        <Mascot mood={showBurst ? "celebrate" : "focus"} message="Train body, sharpen focus. Every workout protects your streak." />
        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-teal-300">Fitness</p>
          <h1 className="page-title text-white mt-2">Energy & training</h1>
          <p className="text-teal-50/75 mt-3 max-w-2xl">Stay physically active to keep study performance sharp and your streak alive.</p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="card-soft card-hover p-4">
            <p className="eyebrow text-slate-500">Workouts</p>
            <p className="font-display text-3xl font-bold mt-2">{workouts.length}</p>
          </div>
          <div className="card-soft card-hover p-4">
            <p className="eyebrow text-slate-500">Total steps</p>
            <p className="font-display text-3xl font-bold mt-2">{totalSteps.toLocaleString()}</p>
          </div>
          <div className="card-soft card-hover p-4">
            <p className="eyebrow text-slate-500">XP</p>
            <p className="font-display text-3xl font-bold mt-2">{summary?.xp ?? 0}</p>
          </div>
          <div className="card-soft card-hover p-4">
            <p className="eyebrow text-slate-500">Streak</p>
            <p className="font-display text-3xl font-bold mt-2">{summary?.streak ?? 0} days</p>
          </div>
        </section>

        <section className="card-soft p-6">
          <h2 className="section-title text-slate-900 mb-4">Add workout</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Workout name"
              className="input-polish p-2.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              type="number"
              min={1}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="input-polish p-2.5"
              placeholder="Duration (min)"
            />
            <input
              type="number"
              min={0}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="input-polish p-2.5"
              placeholder="Steps"
            />
            <button onClick={addWorkout} className="btn-primary">
              Add workout
            </button>
          </div>
          <p className="helper-text mt-3">
            Daily goal progress: {summary?.dailyGoalDone ?? 0}/{summary?.dailyGoalTarget ?? 0}
          </p>
        </section>

        <section className="card-soft p-6">
          <h2 className="section-title text-slate-900 mb-4">Recent workouts</h2>
          {workouts.length === 0 ? (
            <p className="helper-text">No workouts yet. Add your first one and build momentum.</p>
          ) : (
            <ul className="space-y-2">
              {workouts
                .slice()
                .reverse()
                .map((w) => (
                  <li key={w.id} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between bg-slate-50/50">
                    <div>
                      <p className="font-semibold text-slate-900">{w.name}</p>
                      <p className="text-sm text-slate-500">{new Date(w.date).toLocaleString()}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {w.duration}m · {w.steps} steps
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
