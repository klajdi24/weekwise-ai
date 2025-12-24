"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

export default function TestPage() {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) console.error("Session error:", error);
      setUser(session?.user ?? null);
    };

    getSession();

    // Subscribe to changes (login/logout)
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchWorkouts = async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id);

      console.log("Raw data from Supabase:", data);
      console.log("Fetch error:", error);

      if (error) console.error(error);
      setWorkouts(data || []);
      setLoading(false);
    };

    fetchWorkouts();
  }, [user]);

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


