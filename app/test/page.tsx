"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";
import type { User } from "@supabase/supabase-js";
import type { Workout } from "@/lib/types";

export default function TestPage() {
  const supabase = getSupabaseClient();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const init = async () => {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) console.error("Session error:", error);
      if (mounted) {
        setUser(session?.user ?? null);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    let active = true;

    const fetchWorkouts = async () => {
      if (!user) {
        if (active) {
          setWorkouts([]);
          setLoading(false);
        }
        return;
      }

      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id);

      if (error) console.error(error);

      if (active) {
        setWorkouts((data as Workout[]) || []);
        setLoading(false);
      }
    };

    fetchWorkouts();

    return () => {
      active = false;
    };
  }, [user, supabase]);

  if (!supabase) return <p>App is not configured. Missing Supabase environment variables.</p>;
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please log in to see workouts.</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Workouts Test</h1>
      <ul>
        {workouts.map((w) => (
          <li key={w.id}>
            {w.name} - {w.duration} min, {w.steps} steps
          </li>
        ))}
      </ul>
    </div>
  );
}
