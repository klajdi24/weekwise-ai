"use client";

import { useState, useEffect } from "react";

interface Workout {
  id: number;
  name: string;
  date: string; // ISO date
  duration: number; // minutes
  steps: number;
}

export default function Fitness() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [steps, setSteps] = useState(0);

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("weekwise-workouts");
    if (saved) setWorkouts(JSON.parse(saved));
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem("weekwise-workouts", JSON.stringify(workouts));
  }, [workouts]);

  const addWorkout = () => {
    if (!name) return;
    const newWorkout: Workout = {
      id: Date.now(),
      name,
      date: new Date().toISOString().split("T")[0],
      duration,
      steps,
    };
    setWorkouts([...workouts, newWorkout]);
    setName("");
    setDuration(30);
    setSteps(0);
  };

  // Weekly summary
  const totalDuration = workouts.reduce((sum, w) => sum + w.duration, 0);
  const totalSteps = workouts.reduce((sum, w) => sum + w.steps, 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-green-600 mb-6">🏃 Fitness Tracker</h1>

      {/* Add Workout */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Add Workout</h2>
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Workout Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border p-2 rounded flex-1"
          />
          <input
            type="number"
            placeholder="Duration (min)"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="border p-2 rounded w-28"
          />
          <input
            type="number"
            placeholder="Steps"
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="border p-2 rounded w-28"
          />
          <button onClick={addWorkout} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition">
            Add
          </button>
        </div>
      </div>

      {/* Workout List */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">My Workouts</h2>
        <ul>
          {workouts.map((w) => (
            <li key={w.id} className="p-2 border-b">
              <strong>{w.date}:</strong> {w.name} - {w.duration} min, {w.steps} steps
            </li>
          ))}
          {workouts.length === 0 && <p className="text-gray-600">No workouts logged yet.</p>}
        </ul>
      </div>

      {/* Weekly Summary */}
      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-4">Weekly Summary</h2>
        <p>Total Exercise: {totalDuration} minutes</p>
        <p>Total Steps: {totalSteps}</p>
      </div>
    </div>
  );
}



