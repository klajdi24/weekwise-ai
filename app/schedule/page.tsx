"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabaseClient";
import Mascot from "../components/mascot";

type EventType = "Lecture" | "Assignment" | "Study";

type PlanMode = "balanced" | "deep_focus" | "light_week";

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

interface SubscriptionStatus {
  isPremium: boolean;
  freeLimit: number;
  used: number;
  remaining: number;
  canUseAi: boolean;
  planLabel: string;
  cta: string;
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

const eventColors: Record<EventType, string> = {
  Lecture: "bg-blue-100 text-blue-800 border-blue-200",
  Assignment: "bg-amber-100 text-amber-800 border-amber-200",
  Study: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

export default function SchedulePage() {
  const router = useRouter();
  const supabase = getSupabaseClient();

  const [user, setUser] = useState<User | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<EventType>("Lecture");
  const [day, setDay] = useState("Monday");
  const [startHour, setStartHour] = useState(9);
  const [duration, setDuration] = useState(1);

  const [loadingAI, setLoadingAI] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [applyingPreview, setApplyingPreview] = useState(false);
  const [aiUsageCount, setAiUsageCount] = useState(0);
  const FREE_LIMIT = 3;

  const [statusNote, setStatusNote] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);

  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiPreviewEvents, setAiPreviewEvents] = useState<Event[] | null>(null);
  const [highlightedSessions, setHighlightedSessions] = useState<Record<string, number[]>>({});

  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [aiMode, setAiMode] = useState<PlanMode>("balanced");

  const getAccessTokenOrThrow = useCallback(async () => {
    if (!supabase) throw new Error("App is not configured. Missing Supabase environment variables.");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error("Failed to read session. Please log in again.");
    const token = data?.session?.access_token;
    if (!token) throw new Error("You are not logged in. Please log in again.");
    return token;
  }, [supabase]);

  const refreshSubscription = useCallback(async () => {
    try {
      const token = await getAccessTokenOrThrow();
      const res = await fetch("/api/subscription/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as SubscriptionStatus;
      setSubscription(data);
      setIsPremium(data.isPremium);
      setAiUsageCount(data.used ?? 0);
    } catch {
      // soft fail
    }
  }, [getAccessTokenOrThrow]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) console.error("User fetch error:", userErr);

        if (!userData?.user) {
          setUser(null);
          setIsPremium(false);
          setAiUsageCount(0);
          setLoading(false);
          router.push("/login");
          return;
        }

        setUser(userData.user);

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("is_premium, ai_usage_count")
          .eq("id", userData.user.id)
          .maybeSingle();

        if (profileErr) console.error("Profile fetch error:", profileErr);

        if (!profile) {
          const { error: upsertErr } = await supabase
            .from("profiles")
            .upsert([{ id: userData.user.id, is_premium: false, ai_usage_count: 0 }], { onConflict: "id" });

          if (upsertErr) console.error("Profile create/upsert error:", upsertErr);

          setIsPremium(false);
          setAiUsageCount(0);
        } else {
          setIsPremium(profile.is_premium ?? false);
          setAiUsageCount(profile.ai_usage_count ?? 0);
        }
      } catch (e) {
        console.error("Init error:", e);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [supabase, router]);

  useEffect(() => {
    if (!user) return;

    const fetchEvents = async () => {
      setEventsLoading(true);
      const { data, error } = await supabase.from("events").select("*").eq("user_id", user.id);

      if (error) {
        console.error("Fetch events error:", error);
        setStatusNote({ tone: "error", text: "Could not load schedule events. Please refresh." });
      }
      setEvents((data as Event[]) || []);
      setEventsLoading(false);
    };

    fetchEvents();
    refreshSubscription();
  }, [user, supabase, refreshSubscription]);

  const addEvent = async (newEvent?: Partial<Event>) => {
    if (!user) return;

    if (!newEvent && !title.trim()) {
      setStatusNote({ tone: "error", text: "Add a title first so we can place the event." });
      return;
    }

    const eventToAdd = newEvent
      ? { ...newEvent, user_id: user.id }
      : { user_id: user.id, title: title.trim(), type, day, start_hour: startHour, duration };

    const { data, error } = await supabase.from("events").insert([eventToAdd]).select().single();

    if (error) {
      console.error("Insert event error:", error);
      setStatusNote({ tone: "error", text: "Event could not be added. Try again." });
      return;
    }

    setEvents((prev) => [...prev, data as Event]);
    if (!newEvent) {
      setTitle("");
      setStatusNote({ tone: "success", text: "Event added to your week." });
    }
  };

  const deleteEvent = async (id: number) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    if (error) {
      console.error("Delete event error:", error);
      setStatusNote({ tone: "error", text: "Delete failed. Please try again." });
      return;
    }
    setEvents((prev) => prev.filter((e) => e.id !== id));
    setStatusNote({ tone: "success", text: "Event removed." });
  };

  const generateAISchedule = async () => {
    if (!user) return;

    if (!isPremium && aiUsageCount >= FREE_LIMIT) {
      setStatusNote({ tone: "error", text: "Free AI uses are done. Start the 7-day trial for unlimited AI." });
      return;
    }

    setLoadingAI(true);
    setAiExplanation(null);
    setAiPreviewEvents(null);
    setHighlightedSessions({});

    try {
      const token = await getAccessTokenOrThrow();

      const res = await fetch("/api/ai/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events, mode: aiMode }),
      });

      const data = await res.json();
      if (!res.ok || !data.events) throw new Error(data.error || "AI scheduling failed");

      const previewEvents: Event[] = (data.events || []).map((e: Omit<Event, "id" | "user_id">, idx: number) => ({
        id: -1 * (idx + 1),
        user_id: user.id,
        title: e.title,
        type: e.type,
        day: e.day,
        start_hour: e.start_hour,
        duration: e.duration,
      }));

      setAiPreviewEvents(previewEvents);
      if (data.explanation) setAiExplanation(data.explanation);
      setStatusNote({ tone: "success", text: "AI preview generated. Review and apply if it looks good." });

      const highlights: Record<string, number[]> = {};
      previewEvents.forEach((e) => {
        if (e.type === "Study") {
          if (!highlights[e.day]) highlights[e.day] = [];
          for (let h = 0; h < e.duration; h++) highlights[e.day].push(e.start_hour + h);
        }
      });
      setHighlightedSessions(highlights);

      if (!isPremium) {
        const newCount = aiUsageCount + 1;
        setAiUsageCount(newCount);

        const { error: usageErr } = await supabase.from("profiles").update({ ai_usage_count: newCount }).eq("id", user.id);

        if (usageErr) console.error("AI usage update failed:", usageErr);
      }
      await refreshSubscription();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "AI scheduling failed";
      setStatusNote({ tone: "error", text: message });
    } finally {
      setLoadingAI(false);
    }
  };

  const applyAISchedule = async () => {
    if (!aiPreviewEvents || !user) return;
    setApplyingPreview(true);

    await supabase.from("events").delete().eq("user_id", user.id);

    const inserts = aiPreviewEvents.map((e) => ({
      user_id: user.id,
      title: e.title,
      type: e.type,
      day: e.day,
      start_hour: e.start_hour,
      duration: e.duration,
    }));

    await supabase.from("events").insert(inserts);

    const { data, error } = await supabase.from("events").select("*").eq("user_id", user.id);
    if (error) console.error("Refetch after apply error:", error);
    setEvents((data as Event[]) || []);

    setAiPreviewEvents(null);
    setApplyingPreview(false);
    setStatusNote({ tone: "success", text: "AI schedule applied to your week." });
  };

  const generateAISuggestions = async () => {
    if (!user) return;
    setLoadingSuggestions(true);

    try {
      const token = await getAccessTokenOrThrow();

      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ events }),
      });

      const data = await res.json();
      if (!res.ok || !data.suggestions) throw new Error(data.error || "AI suggestions failed");

      setAiSuggestions(data.suggestions);
      setStatusNote({ tone: "success", text: "Suggestions ready. Tap one to add it." });

      if (!isPremium) {
        const newCount = aiUsageCount + 1;
        setAiUsageCount(newCount);

        const { error: usageErr } = await supabase.from("profiles").update({ ai_usage_count: newCount }).eq("id", user.id);

        if (usageErr) console.error("AI usage update failed:", usageErr);
      }
      await refreshSubscription();
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : "Failed to generate AI suggestions";
      setStatusNote({ tone: "error", text: message });
    } finally {
      setLoadingSuggestions(false);
    }
  };

  if (!supabase) return <p>App is not configured. Missing Supabase environment variables.</p>;
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please log in to view your schedule.</p>;

  const displayedEvents = aiPreviewEvents ?? events;
  const studyBlocks = displayedEvents.filter((e) => e.type === "Study").length;
  const assignmentCount = displayedEvents.filter((e) => e.type === "Assignment").length;
  const aiRemaining = subscription?.remaining ?? Math.max(0, FREE_LIMIT - aiUsageCount);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-violet-100 p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Mascot mood={aiPreviewEvents ? "celebrate" : "focus"} message="Plan your week once, then execute with less stress." />

        <section className="rounded-2xl bg-slate-900 text-white p-6 md:p-8 shadow-xl">
          <h1 className="text-3xl font-bold">📅 Week Planner</h1>
          <p className="text-slate-300 mt-2 max-w-3xl">
            Stay in control with an AI-optimized weekly plan. Add your classes and tasks, then let WeekWise build better study momentum.
          </p>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            <span className="bg-white/10 px-3 py-1 rounded-full">{events.length} total events</span>
            <span className="bg-white/10 px-3 py-1 rounded-full">{studyBlocks} study blocks</span>
            <span className="bg-white/10 px-3 py-1 rounded-full">{assignmentCount} assignments</span>
            <span className="bg-white/10 px-3 py-1 rounded-full">{isPremium ? "Premium AI: Unlimited" : `Free AI left: ${aiRemaining}`}</span>
          </div>

          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <Link href="/fitness" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition">🏋️ Fitness</Link>
            <Link href="/momentum" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition">⚡ Momentum</Link>
            <Link href="/profile" className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition">👤 Profile</Link>
          </div>
        </section>

        {!isPremium && (
          <section className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-fuchsia-900">Free plan: {aiRemaining}/{subscription?.freeLimit ?? FREE_LIMIT} AI actions left</p>
              <p className="text-sm text-fuchsia-800">Start your 7-day Premium trial to unlock unlimited scheduling and suggestions.</p>
            </div>
            <Link href="/pricing" className="rounded-lg bg-fuchsia-600 text-white px-4 py-2 font-semibold hover:bg-fuchsia-700">Start free trial</Link>
          </section>
        )}

        {statusNote && (
          <section
            className={`rounded-xl border px-4 py-3 text-sm ${
              statusNote.tone === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            {statusNote.text}
          </section>
        )}

        <section className="bg-white p-6 rounded-2xl border border-indigo-100 shadow">
          <h2 className="text-xl font-semibold mb-1">Add Event</h2>
          <p className="text-sm text-gray-600 mb-4">Add classes/assignments, then generate an optimized week with AI.</p>

          <div className="mb-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">AI planning mode</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "balanced", label: "Balanced" },
                { key: "deep_focus", label: "Deep Focus" },
                { key: "light_week", label: "Light Week" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setAiMode(m.key as PlanMode)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    aiMode === m.key
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="md:col-span-2 text-sm">
              Title
              <input className="mt-1 w-full border p-2 rounded-lg" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm">
              Type
              <select className="mt-1 w-full border p-2 rounded-lg" value={type} onChange={(e) => setType(e.target.value as EventType)}>
                <option>Lecture</option>
                <option>Assignment</option>
                <option>Study</option>
              </select>
            </label>

            <label className="text-sm">
              Day
              <select className="mt-1 w-full border p-2 rounded-lg" value={day} onChange={(e) => setDay(e.target.value)}>
                {daysOfWeek.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              Start hour
              <input type="number" className="mt-1 w-full border p-2 rounded-lg" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} />
            </label>

            <label className="text-sm">
              Duration (h)
              <input type="number" className="mt-1 w-full border p-2 rounded-lg" min={1} max={12} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            {aiMode === "balanced" && "Balanced: evenly distributes work and study blocks."}
            {aiMode === "deep_focus" && "Deep Focus: prioritizes longer, uninterrupted study sessions."}
            {aiMode === "light_week" && "Light Week: reduces load density and protects breathing room."}
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={() => addEvent()} className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
              Add Event
            </button>

            <button
              onClick={generateAISchedule}
              disabled={loadingAI || (!isPremium && aiRemaining <= 0)}
              className={`px-4 py-2 rounded-lg text-white transition ${
                isPremium || aiRemaining > 0 ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-400 cursor-not-allowed"
              }`}
            >
              {loadingAI ? "Generating preview..." : "Generate AI Schedule"}
            </button>

            <button
              onClick={generateAISuggestions}
              disabled={loadingSuggestions || (!isPremium && aiRemaining <= 0)}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50"
            >
              {loadingSuggestions ? "Generating suggestions..." : "AI Suggestions"}
            </button>
          </div>
        </section>

        {aiPreviewEvents && (
          <section className="bg-violet-50 border border-violet-200 p-5 rounded-2xl">
            <h3 className="font-semibold text-violet-900 mb-2">🤖 AI Schedule Preview</h3>
            {aiExplanation && <p className="text-sm text-violet-800 whitespace-pre-line mb-3">{aiExplanation}</p>}

            <div className="flex gap-3">
              <button
                onClick={applyAISchedule}
                disabled={applyingPreview}
                className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                {applyingPreview ? "Applying..." : "Apply Schedule"}
              </button>
              <button onClick={generateAISchedule} className="bg-amber-500 text-white px-4 py-2 rounded-lg hover:bg-amber-600">
                Regenerate
              </button>
              <button onClick={() => setAiPreviewEvents(null)} className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600">
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
          {daysOfWeek.map((d) => (
            <div key={d} className="bg-white p-4 rounded-2xl border border-gray-100 shadow min-h-[220px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <h3 className="font-bold mb-3 text-slate-800">{d}</h3>

              {eventsLoading ? (
                <div className="space-y-2">
                  <div className="h-10 rounded bg-slate-100 animate-pulse" />
                  <div className="h-10 rounded bg-slate-100 animate-pulse" />
                </div>
              ) : (() => {
                const dayEvents = displayedEvents
                  .filter((e) => e.day === d)
                  .sort((a, b) => a.start_hour - b.start_hour);

                if (dayEvents.length === 0) {
                  return <p className="text-xs text-slate-400 italic">No events yet. Add one or run AI.</p>;
                }

                return dayEvents.map((e) => {
                  const isHighlighted = highlightedSessions[d]?.some(
                    (hour) => hour >= e.start_hour && hour < e.start_hour + e.duration
                  );

                  const canDelete = !aiPreviewEvents;

                  return (
                    <div
                      key={e.id}
                      className={`mb-2 p-2 rounded-lg border flex justify-between items-start gap-2 transition-all duration-300 hover:scale-[1.01] ${
                        isHighlighted ? "bg-violet-200 border-violet-400" : eventColors[e.type]
                      }`}
                    >
                      <div className="text-sm">
                        <p className="font-semibold leading-tight">{e.title}</p>
                        <p className="text-xs opacity-80">{e.start_hour}:00 • {e.duration}h</p>
                      </div>

                      <button
                        onClick={() => {
                          if (!canDelete) return;
                          deleteEvent(e.id);
                        }}
                        className={`text-red-600 font-bold px-2 ${canDelete ? "" : "opacity-40 cursor-not-allowed"}`}
                      >
                        ✕
                      </button>
                    </div>
                  );
                });
              })()}
            </div>
          ))}
        </section>
      </div>

      {aiSuggestions.length > 0 && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-lg max-w-md w-full p-6 relative border border-violet-100">
            <h3 className="font-bold text-xl mb-4 text-violet-800">🤖 AI Suggestions</h3>

            <button
              className="absolute top-3 right-3 text-gray-600 hover:text-gray-900 font-bold text-lg"
              onClick={() => setAiSuggestions([])}
            >
              ✕
            </button>

            <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {aiSuggestions.map((s, idx) => (
                <li
                  key={idx}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-violet-50 transition flex flex-col gap-1"
                  onClick={() => {
                    addEvent(s);
                    setAiSuggestions([]);
                  }}
                >
                  <div className="font-semibold">
                    {s.title} ({s.type})
                  </div>
                  <div className="text-sm text-gray-700">
                    {s.day}, {s.start_hour}:00 - Duration: {s.duration}h
                  </div>
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
