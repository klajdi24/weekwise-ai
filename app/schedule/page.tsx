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
  start_hour: number;
  duration: number;
}

interface AISuggestion {
  title: string;
  type: EventType;
  day: string;
  start_hour: number;
  duration: number;
  description: string;
}

const daysOfWeek = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export default function SchedulePage() {
  const [user, setUser] = useState<any>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("Lecture");
  const [day, setDay] = useState("Monday");
  const [startHour, setStartHour] = useState(9);
  const [duration, setDuration] = useState(1);

  const [loadingAI, setLoadingAI] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const FREE_LIMIT = 3;

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiPreviewEvents, setAiPreviewEvents] = useState<Event[] | null>(null);
  const [highlightedSessions, setHighlightedSessions] = useState<Record<string, number[]>>({});

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);

  /* ----------------------- Fetch user + premium ----------------------- */
  useEffect(() => {
    const init = async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        setLoading(false);
        return;
      }

      setUser(userData.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_premium, ai_usage_count")
        .eq("id", userData.user.id)
        .single();

      setIsPremium(profile?.is_premium ?? false);
      setAiUsageCount(profile?.ai_usage_count ?? 0);
      setLoading(false);
    };
    init();
  }, []);

  /* ----------------------- Fetch events ----------------------- */
  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      const { data } = await supabase
        .from<Event>("events")
        .select("*")
        .eq("user_id", user.id);

      setEvents(data || []);
    };

    fetchEvents();
  }, [user]);

  /* ----------------------- Add event ----------------------- */
  const addEvent = async (newEvent?: Partial<Event>) => {
    if (!user) return;
    const eventToAdd = newEvent
      ? { ...newEvent, user_id: user.id }
      : { user_id: user.id, title, type, day, start_hour: startHour, duration };

    const { data, error } = await supabase
      .from("events")
      .insert([eventToAdd])
      .select()
      .single();

    if (error) {
      console.error(error);
      return;
    }

    setEvents((prev) => [...prev, data]);
    if (!newEvent) setTitle("");
  };

  /* ----------------------- Delete event ----------------------- */
  const deleteEvent = async (id: number) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      console.error(error);
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  /* ----------------------- AI Schedule ----------------------- */
  const generateAISchedule = async () => {
    if (!user) return;

    if (!isPremium && aiUsageCount >= FREE_LIMIT) {
      alert("🚀 Free AI uses exhausted. Upgrade to Premium!");
      return;
    }

    setLoadingAI(true);
    setAiExplanation(null);
    setAiPreviewEvents(null);
    setHighlightedSessions({});

    try {
      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      const data = await res.json();
      if (!res.ok || !data.events) {
        throw new Error(data.error || "AI scheduling failed");
      }

      setAiPreviewEvents(data.events || []);
      if (data.explanation) setAiExplanation(data.explanation);

      // Highlight study sessions
      const highlights: Record<string, number[]> = {};
      (data.events || []).forEach((e: Event) => {
        if (e.type === "Study") {
          if (!highlights[e.day]) highlights[e.day] = [];
          for (let h = 0; h < e.duration; h++) {
            highlights[e.day].push(e.start_hour + h);
          }
        }
      });
      setHighlightedSessions(highlights);

      if (!isPremium) {
        const newCount = aiUsageCount + 1;
        setAiUsageCount(newCount);
        await supabase.from("profiles").update({ ai_usage_count: newCount }).eq("id", user.id);
      }
    } catch (err) {
      console.error(err);
      alert("AI scheduling failed");
    } finally {
      setLoadingAI(false);
    }
  };

  /* ----------------------- Apply AI Schedule ----------------------- */
  const applyAISchedule = async () => {
    if (!aiPreviewEvents || !user) return;

    await supabase.from("events").delete().eq("user_id", user.id);
    const inserts = aiPreviewEvents.map((e) => ({ ...e, user_id: user.id }));
    await supabase.from("events").insert(inserts);

    setEvents(aiPreviewEvents);
    setAiPreviewEvents(null);
  };

  /* ----------------------- AI Suggest ----------------------- */
  const generateAISuggestions = async () => {
    if (!user) return;

    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ events }),
      });

      const data = await res.json();
      if (!res.ok || !data.suggestions) {
        throw new Error(data.error || "AI suggestions failed");
      }

      setAiSuggestions(data.suggestions);
    } catch (err) {
      console.error(err);
      alert("Failed to generate AI suggestions");
    }
  };

  /* ----------------------- UI ----------------------- */
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please log in to view your schedule.</p>;

  const displayedEvents = aiPreviewEvents ?? events;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold mb-6">📅 My Schedule</h1>

      {/* ADD EVENT */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold mb-2">Add Event</h2>
        <p className="text-sm text-gray-600 mb-4">
          🤖 <strong>AI Schedule</strong> automatically rearranges your events to balance your week, add study sessions, and avoid overload.
        </p>

        <div className="flex flex-wrap gap-3 items-center">
          <input className="border p-2 rounded" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <select className="border p-2 rounded" value={type} onChange={(e) => setType(e.target.value as EventType)}>
            <option>Lecture</option>
            <option>Assignment</option>
            <option>Study</option>
          </select>
          <select className="border p-2 rounded" value={day} onChange={(e) => setDay(e.target.value)}>
            {daysOfWeek.map((d) => <option key={d}>{d}</option>)}
          </select>
          <input type="number" className="border p-2 rounded w-20" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} />
          <input type="number" className="border p-2 rounded w-20" min={1} max={12} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          <button onClick={() => addEvent()} className="bg-blue-600 text-white px-4 py-2 rounded">Add</button>

          <button onClick={generateAISchedule} className={`px-4 py-2 rounded text-white ${isPremium || aiUsageCount < FREE_LIMIT ? "bg-green-600" : "bg-gray-400 cursor-not-allowed"}`}>
            {loadingAI ? "Generating..." : isPremium ? "Generate AI Schedule" : `Generate AI Schedule (${FREE_LIMIT - aiUsageCount} free uses left)`}
          </button>

          <button onClick={generateAISuggestions} className="px-4 py-2 rounded bg-purple-600 text-white hover:bg-purple-700 transition">
            AI Suggest
          </button>
        </div>

        {!isPremium && <p className="text-sm text-gray-500 mt-3">Free users get {FREE_LIMIT} AI optimizations. Premium = unlimited.</p>}
      </div>

      {/* AI EXPLANATION + Preview Controls */}
      {aiPreviewEvents && (
        <div className="bg-purple-50 border border-purple-200 p-4 rounded-xl mb-6">
          <h3 className="font-semibold text-purple-800 mb-2">🤖 AI Schedule Preview</h3>
          {aiExplanation && <p className="text-sm text-purple-700 whitespace-pre-line mb-3">{aiExplanation}</p>}
          <div className="flex gap-3">
            <button onClick={applyAISchedule} className="bg-green-600 text-white px-4 py-2 rounded">Apply Schedule</button>
            <button onClick={generateAISchedule} className="bg-yellow-500 text-white px-4 py-2 rounded">Regenerate</button>
            <button onClick={() => setAiPreviewEvents(null)} className="bg-gray-400 text-white px-4 py-2 rounded">Cancel</button>
          </div>
        </div>
      )}

      {/* WEEK GRID */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {daysOfWeek.map((d) => (
          <div key={d} className="bg-white p-4 rounded-xl shadow min-h-[150px]">
            <h3 className="font-bold mb-2">{d}</h3>
            {displayedEvents
              .filter((e) => e.day === d)
              .sort((a, b) => a.start_hour - b.start_hour)
              .map((e) => {
                const isHighlighted = highlightedSessions[d]?.some((hour) => hour >= e.start_hour && hour < e.start_hour + e.duration);
                return (
                  <div key={e.id} className={`mb-1 p-1 rounded flex justify-between items-center ${isHighlighted ? "bg-purple-200 border-purple-400 border" : e.type === "Lecture" ? "bg-blue-100" : e.type === "Assignment" ? "bg-yellow-100" : "bg-green-100"}`}>
                    <div><strong>{e.start_hour}:00</strong> {e.title}</div>
                    <button onClick={() => deleteEvent(e.id)} className="text-red-600 font-bold px-2">✕</button>
                  </div>
                );
              })}
          </div>
        ))}
      </div>

      {/* ----------------------- AI Suggestions Modal ----------------------- */}
      {aiSuggestions.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 relative">
            <h3 className="font-bold text-xl mb-4 text-purple-800">🤖 AI Suggestions</h3>

            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900 font-bold text-lg"
              onClick={() => setAiSuggestions([])}
            >
              ✕
            </button>

            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {aiSuggestions.map((s, idx) => (
                <li
                  key={idx}
                  className="border rounded p-3 cursor-pointer hover:bg-purple-100 transition flex flex-col gap-1"
                  onClick={() => {
                    addEvent(s);
                    setAiSuggestions([]);
                  }}
                >
                  <div className="font-semibold">{s.title} ({s.type})</div>
                  <div className="text-sm text-gray-700">{s.day}, {s.start_hour}:00 - Duration: {s.duration}h</div>
                  <div className="text-xs text-gray-500 italic">{s.description}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

























