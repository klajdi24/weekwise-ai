"use client";

import { useState } from "react";

type EventType = "Lecture" | "Assignment" | "Study";

interface Event {
  id: number;
  title: string;
  type: EventType;
  day: string; // "Monday", "Tuesday", etc.
  startHour: number; // 0-23
  duration: number; // in hours
}

const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function SchedulePage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("Lecture");
  const [day, setDay] = useState("Monday");
  const [startHour, setStartHour] = useState(9);
  const [duration, setDuration] = useState(1);
  const [loading, setLoading] = useState(false);

  const addEvent = () => {
    if (!title) return;
    const newEvent: Event = {
      id: Date.now(),
      title,
      type,
      day,
      startHour,
      duration,
    };
    setEvents([...events, newEvent]);
    setTitle("");
  };

  const generateAISchedule = async () => {
    if (events.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      if (!res.ok) throw new Error("Failed to generate AI schedule");

      const data = await res.json();
      // data.events should be an array of Event objects from AI
      setEvents(data.events);
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Something went wrong with AI scheduling");
    } finally {
      setLoading(false);
    }
  };

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
          <button onClick={addEvent} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
            Add
          </button>
          <button
            onClick={generateAISchedule}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition"
          >
            {loading ? "Generating..." : "Generate AI Schedule"}
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
                .sort((a, b) => a.startHour - b.startHour)
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
                    <strong>{e.startHour}:00</strong> - {e.title} ({e.type})
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}







