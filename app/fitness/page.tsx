"use client";

import { useState, useEffect } from "react";
import { getSupabaseClient } from "../../lib/supabaseClient";

interface Workout {
  id: number;
  user_id: string;
  name: string;
  date: string;
  duration: number; // in minutes
  steps: number;
}

export default function FitnessPage() {
  // ✅ create the client (needed)
  const supabase = getSupabaseClient();

  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);

  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [steps, setSteps] = useState(2000);

  // --- Step 1: Get current user ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error("User fetch error:", error);
      setUser(data?.user || null);
      setLoadingUser(false);
    };
    fetchUser();
  }, [supabase]);

  // --- Step 2: Fetch user's workouts ---
  useEffect(() => {
    if (!user) return;

    const fetchWorkouts = async () => {
      setLoadingWorkouts(true);

      const { data, error } = await supabase
        .from("workouts")
        .select("*")
        .eq("user_id", user.id);

      if (error) console.error("Error fetching workouts:", error);
      else setWorkouts(((data as Workout[]) || []));

      setLoadingWorkouts(false);
    };

    fetchWorkouts();
  }, [user, supabase]);

  // --- Step 3: Add workout ---
  const addWorkout = async () => {
    if (!name || !user) return;

    const tempWorkout: Workout = {
      id: Date.now(),
      user_id: user.id,
      name,
      date: new Date().toISOString(),
      duration,
      steps,
    };

    setWorkouts([...workouts, tempWorkout]);
    setName("");

    const { data, error } = await supabase
      .from("workouts")
      .insert([
        {
          user_id: user.id,
          name,
          date: tempWorkout.date,
          duration,
          steps,
        },
      ])
      .select();

    if (error) {
      console.error("Insert error:", error);
      alert("Failed to add workout. Check console for details.");
      setWorkouts(workouts);
    } else if (data && data.length > 0) {
      setWorkouts((prev) =>
        prev.map((w) => (w.id === tempWorkout.id ? (data[0] as Workout) : w))
      );
    }
  };

  if (loadingUser) return <p>Loading user...</p>;
  if (!user) return <p>Please log in to see your workouts.</p>;
  if (loadingWorkouts) return <p>Loading workouts...</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">🏋️ Fitness</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Add Workout</h2>
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Workout Name"
            className="border p-2 rounded flex-1"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            type="number"
            min={1}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="border p-2 rounded w-24"
            placeholder="Duration (min)"
          />
          <input
            type="number"
            min={0}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="border p-2 rounded w-24"
            placeholder="Steps"
          />
          <button
            onClick={addWorkout}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Add
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">My Workouts</h2>
        <ul>
          {workouts.map((w) => (
            <li key={w.id} className="p-2 border-b">
              {w.name} - {w.duration} min, {w.steps} steps
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}






