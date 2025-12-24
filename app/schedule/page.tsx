"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";

type EventType = "Lecture" | "Assignment" | "Study";

interface Event {
  id: number;
  user_id: string;
  title: string;
  type: EventType;
  day: string;
  start_hour: number; // snake_case
  duration: number;
}

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SchedulePage() {
  const [user, setUser] = useState<any>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("Lecture");
  const [day, setDay] = useState("Monday");
  const [startHour, setStartHour] = useState(9); // front-end variable
  const [duration, setDuration] = useState(1);
  const [loadingAI, setLoadingAI] = useState(false);

  // --- Step 1: Get current user ---
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) console.error("User fetch error:", error);
      setUser(data?.user || null);
      setLoadingUser(false);
    };
    fetchUser();
  }, []);

  // --- Step 2: Fetch user's events ---
  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      setLoadingEvents(true);
      const { data, error } = await supabase
        .from<Event>("events")
        .select("*")
        .eq("user_id", user.id);

      if (error) console.error("Error fetching events:", error);
      else setEvents(data || []);
      setLoadingEvents(false);
    };

    fetchEvents();
  }, [user]);

  // --- Step 3: Add event to Supabase ---
const addEvent = async () => {
  if (!title || !user) return;

  const newEvent = {
    user_id: user.id,
    title,
    type,
    day,
    start_hour: startHour,
    duration,
  };

  const { data, error } = await supabase.from("events").insert([newEvent]).select();

  if (error) {
    console.error("Insert error:", error);
    alert("Failed to add event. Check console for details.");
    return;
  }

  // Ensure data[0] has correct keys from DB
  if (data && data.length > 0) {
    setEvents([...events, data[0]]);
  }

  setTitle("");
};



  // --- Step 4: AI Schedule (unchanged) ---
  const generateAISchedule = async () => {
    if (events.length === 0) return;
    setLoadingAI(true);

    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      if (!res.ok) throw new Error("Failed to generate AI schedule");

      const data = await res.json();
      setEvents(data.events);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong with AI scheduling");
    } finally {
      setLoadingAI(false);
    }
  };

  // --- Step 5: Loading & authentication checks ---
  if (loadingUser) return <p>Loading user...</p>;
  if (!user) return <p>Please log in to see your schedule.</p>;
  if (loadingEvents) return <p>Loading events...</p>;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">📅 My Schedule</h1>

      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Add Event</h2>
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Title"
            className="border p-2 rounded flex-1"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value as EventType)} className="border p-2 rounded">
            <option>Lecture</option>
            <option>Assignment</option>
            <option>Study</option>
          </select>
          <select value={day} onChange={(e) => setDay(e.target.value)} className="border p-2 rounded">
            {daysOfWeek.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <input
            type="number"
            min={0}
            max={23}
            value={startHour}
            onChange={(e) => setStartHour(Number(e.target.value))}
            className="border p-2 rounded w-20"
          />
          <input
            type="number"
            min={1}
            max={12}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="border p-2 rounded w-20"
          />
          <button
            onClick={addEvent}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
          >
            Add
          </button>
          <button
            onClick={generateAISchedule}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            {loadingAI ? "Generating..." : "Generate AI Schedule"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {daysOfWeek.map((d) => (
          <div key={d} className="bg-white p-4 rounded-xl shadow min-h-[150px]">
            <h3 className="font-bold mb-2">{d}</h3>
            <ul>
              {events
                .filter((e) => e.day === d)
                .sort((a, b) => a.start_hour - b.start_hour)
                .map((e) => (
                  <li
                    key={e.id}
                    className={`p-1 rounded mb-1 ${
                      e.type === "Lecture"
                        ? "bg-blue-100"
                        : e.type === "Assignment"
                        ? "bg-yellow-100"
                        : "bg-green-100"
                    }`}
                  >
                    <strong>{e.start_hour}:00</strong> - {e.title} ({e.type})
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}









