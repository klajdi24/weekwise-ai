"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient } from "../../lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import { extractAiError, isPlanLimitError, type AiClientErrorPayload } from "@/lib/ai/client";
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
  remaining: number | null;
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
  Lecture: "bg-sky-500/15 text-sky-200 border-sky-400/30",
  Assignment: "bg-violet-500/15 text-violet-200 border-violet-400/30",
  Study: "bg-emerald-500/15 text-emerald-200 border-emerald-400/30",
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
  const [modeAnimation, setModeAnimation] = useState(false);

  const modeTone: Record<PlanMode, string> = {
    balanced: "from-violet-500/25 via-fuchsia-500/10 to-transparent",
    deep_focus: "from-violet-500/30 via-indigo-500/15 to-transparent",
    light_week: "from-fuchsia-500/20 via-violet-500/15 to-transparent",
  };

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
        const { user: sessionUser } = await getClientAuth(supabase);

        if (!sessionUser) {
          setUser(null);
          setIsPremium(false);
          setAiUsageCount(0);
          setLoading(false);
          router.push("/login");
          return;
        }

        setUser(sessionUser);

        const { data: profile, error: profileErr } = await supabase
          .from("profiles")
          .select("is_premium, ai_usage_count")
          .eq("id", sessionUser.id)
          .maybeSingle();

        if (profileErr) console.error("Profile fetch error:", profileErr);

        if (!profile) {
          const { error: upsertErr } = await supabase
            .from("profiles")
            .upsert([{ id: sessionUser.id, is_premium: false, ai_usage_count: 0 }], { onConflict: "id" });

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

      const data = (await res.json()) as { events?: Event[]; explanation?: string } & AiClientErrorPayload;
      if (!res.ok || !data.events) {
        const message = extractAiError(data, "AI scheduling failed");
        throw new Error(isPlanLimitError(data) ? `${message} Upgrade in Pricing to continue.` : message);
      }

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

      const data = (await res.json()) as { suggestions?: AISuggestion[] } & AiClientErrorPayload;
      if (!res.ok || !data.suggestions) {
        const message = extractAiError(data, "AI suggestions failed");
        throw new Error(isPlanLimitError(data) ? `${message} Upgrade in Pricing to continue.` : message);
      }

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

  const handleModeSelect = (mode: PlanMode) => {
    setAiMode(mode);
    setModeAnimation(true);
    window.setTimeout(() => setModeAnimation(false), 420);
  };

  if (!supabase) return <p>App is not configured. Missing Supabase environment variables.</p>;
  if (loading) return <p>Loading...</p>;
  if (!user) return <p>Please log in to view your schedule.</p>;

  const displayedEvents = aiPreviewEvents ?? events;
  const studyBlocks = displayedEvents.filter((e) => e.type === "Study").length;
  const assignmentCount = displayedEvents.filter((e) => e.type === "Assignment").length;
  const aiRemaining = subscription?.remaining ?? Math.max(0, FREE_LIMIT - aiUsageCount);

  return (
    <div className="min-h-screen app-surface p-5 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6 app-layer">
        <Mascot mood={aiPreviewEvents ? "celebrate" : "focus"} message="Plan your week once, then execute with less stress." />

        <section className="hero-panel p-6 md:p-8">
          <p className="eyebrow text-violet-300">Schedule</p>
          <h1 className="page-title mt-2">Week planner</h1>
          <p className="text-[var(--muted)] mt-3 max-w-3xl">
            Stay in control with an AI-optimized weekly plan. Add classes and tasks, then let WeekWise build study momentum.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="stat-chip">{events.length} events</span>
            <span className="stat-chip">{studyBlocks} study blocks</span>
            <span className="stat-chip">{assignmentCount} assignments</span>
            <span className="stat-chip">{isPremium ? "Premium AI · Unlimited" : `Free AI left · ${aiRemaining}`}</span>
          </div>
        </section>

        {!isPremium && (
          <section className="rounded-2xl border border-violet-400/30 bg-violet-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-violet-200">Free plan: {aiRemaining}/{subscription?.freeLimit ?? FREE_LIMIT} AI actions left</p>
              <p className="text-sm text-violet-200">Start your 7-day Premium trial to unlock unlimited scheduling and suggestions.</p>
            </div>
            <Link href="/pricing" className="btn-primary">Start free trial</Link>
          </section>
        )}

        {statusNote && (
          <section
            className={`rounded-xl border px-4 py-3 text-sm ${
              statusNote.tone === "success"
                ? "bg-emerald-500/12 border-emerald-400/30 text-emerald-200"
                : "bg-rose-500/12 border-rose-400/30 text-rose-200"
            }`}
          >
            {statusNote.text}
          </section>
        )}

        <section className={`card-soft p-6 relative overflow-hidden ${modeAnimation ? "mode-card-animate mode-glow" : ""}`}>
          <div className={`absolute inset-0 bg-gradient-to-r ${modeTone[aiMode]} transition-all duration-700 pointer-events-none`} />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.48),transparent_55%)] pointer-events-none" />
          <div className="relative z-10">
          <h2 className="section-title text-[var(--ink)] mb-1">Add event</h2>
          <p className="helper-text mb-4">Add classes/assignments, then generate an optimized week with AI.</p>

          <div className="mb-4">
            <p className="eyebrow text-[var(--muted)] mb-2">AI planning mode</p>
            <div className="flex flex-wrap gap-2">
              {[
                { key: "balanced", label: "Balanced", active: "bg-[var(--brand)] border-[var(--brand)] text-white", idle: "hover:border-violet-400/50" },
                { key: "deep_focus", label: "Deep Focus", active: "bg-[var(--ink)] border-[var(--ink)] text-white", idle: "hover:border-white/25" },
                { key: "light_week", label: "Light Week", active: "bg-violet-500/25 border-violet-400/30 text-violet-200", idle: "hover:border-violet-400/50" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => handleModeSelect(m.key as PlanMode)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-all duration-300 ${
                    aiMode === m.key
                      ? `${m.active} shadow-lg`
                      : `bg-white/[0.05] backdrop-blur-xl text-[var(--foreground)] border-white/10 ${m.idle}`
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <label className="md:col-span-2 text-sm font-medium text-[var(--foreground)]">
              Title
              <input className="mt-1 w-full input-polish p-2.5" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className="text-sm font-medium text-[var(--foreground)]">
              Type
              <select className="mt-1 w-full input-polish p-2.5" value={type} onChange={(e) => setType(e.target.value as EventType)}>
                <option>Lecture</option>
                <option>Assignment</option>
                <option>Study</option>
              </select>
            </label>

            <label className="text-sm font-medium text-[var(--foreground)]">
              Day
              <select className="mt-1 w-full input-polish p-2.5" value={day} onChange={(e) => setDay(e.target.value)}>
                {daysOfWeek.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-[var(--foreground)]">
              Start hour
              <input type="number" className="mt-1 w-full input-polish p-2.5" min={0} max={23} value={startHour} onChange={(e) => setStartHour(Number(e.target.value))} />
            </label>

            <label className="text-sm font-medium text-[var(--foreground)]">
              Duration (h)
              <input type="number" className="mt-1 w-full input-polish p-2.5" min={1} max={12} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </label>
          </div>

          <p className="text-xs text-[var(--muted)] mt-1">
            {aiMode === "balanced" && "Balanced: evenly distributes work and study blocks."}
            {aiMode === "deep_focus" && "Deep Focus: prioritizes longer, uninterrupted study sessions."}
            {aiMode === "light_week" && "Light Week: reduces load density and protects breathing room."}
          </p>

          <div className="flex flex-wrap gap-3 mt-4">
            <button onClick={() => addEvent()} className="btn-primary">
              Add Event
            </button>

            <button
              onClick={generateAISchedule}
              disabled={loadingAI || (!isPremium && aiRemaining <= 0)}
              className="btn-accent disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAI ? "Generating preview..." : "Generate AI Schedule"}
            </button>

            <button
              onClick={generateAISuggestions}
              disabled={loadingSuggestions || (!isPremium && aiRemaining <= 0)}
              className="btn-secondary disabled:opacity-50"
            >
              {loadingSuggestions ? "Generating suggestions..." : "AI Suggestions"}
            </button>
          </div>
          </div>
        </section>

        {aiPreviewEvents && (
          <section className="bg-violet-500/10 border border-violet-400/30 p-5 rounded-2xl">
            <h3 className="font-semibold text-violet-200 mb-2">AI schedule preview</h3>
            {aiExplanation && <p className="text-sm text-violet-200 whitespace-pre-line mb-3">{aiExplanation}</p>}

            <div className="flex gap-3">
              <button
                onClick={applyAISchedule}
                disabled={applyingPreview}
                className="btn-accent disabled:opacity-60"
              >
                {applyingPreview ? "Applying..." : "Apply Schedule"}
              </button>
              <button onClick={generateAISchedule} className="btn-secondary">
                Regenerate
              </button>
              <button onClick={() => setAiPreviewEvents(null)} className="btn-secondary">
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
          {daysOfWeek.map((d) => (
            <div key={d} className="bg-white/[0.05] backdrop-blur-xl p-4 rounded-2xl border border-white/10 shadow min-h-[220px] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <h3 className="font-bold mb-3 text-[var(--ink)]">{d}</h3>

              {eventsLoading ? (
                <div className="space-y-2">
                  <div className="h-10 rounded bg-white/10 animate-pulse" />
                  <div className="h-10 rounded bg-white/10 animate-pulse" />
                </div>
              ) : (() => {
                const dayEvents = displayedEvents
                  .filter((e) => e.day === d)
                  .sort((a, b) => a.start_hour - b.start_hour);

                if (dayEvents.length === 0) {
                  return <p className="text-xs text-[var(--muted)] italic">No events yet. Add one or run AI.</p>;
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
                        isHighlighted ? "bg-violet-500/25 border-violet-400/30" : eventColors[e.type]
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
                        className={`text-rose-300 font-bold px-2 ${canDelete ? "" : "opacity-40 cursor-not-allowed"}`}
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
          <div className="bg-[var(--surface-solid)] rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-violet-400/30">
            <h3 className="font-bold text-xl mb-4 text-violet-200">AI suggestions</h3>

            <button
              className="absolute top-3 right-3 text-[var(--foreground)] hover:text-[var(--ink)] font-bold text-lg"
              onClick={() => setAiSuggestions([])}
            >
              ✕
            </button>

            <ul className="space-y-3 max-h-96 overflow-y-auto pr-1">
              {aiSuggestions.map((s, idx) => (
                <li
                  key={idx}
                  className="border rounded-lg p-3 cursor-pointer hover:bg-violet-500/15 transition flex flex-col gap-1"
                  onClick={() => {
                    addEvent(s);
                    setAiSuggestions([]);
                  }}
                >
                  <div className="font-semibold">
                    {s.title} ({s.type})
                  </div>
                  <div className="text-sm text-[var(--foreground)]">
                    {s.day}, {s.start_hour}:00 - Duration: {s.duration}h
                  </div>
                  <div className="text-xs text-[var(--muted)] italic">{s.description}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
