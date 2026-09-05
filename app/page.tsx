"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth, apiFetch } from "@/lib/authClient";
import Mascot from "./components/mascot";
import PageShell, { PageHero } from "./components/page-shell";
import Reveal from "./components/reveal";
import Logo from "./components/logo";
import ToolRail from "./components/tool-rail";

interface HomeMomentum {
  xp: number;
  level: number;
  streak: number;
  streakStatus: "safe" | "warming" | "risk";
  streakAdvice: string;
  nextBestAction: string;
}

interface DashboardToday {
  nextEvent: {
    title: string;
    day: string;
    type: string;
    start_hour: number;
    duration: number;
  } | null;
  priorities: Array<{
    id: number;
    title: string;
    day: string;
    type: string;
    startHour: number;
  }>;
  sessionsThisWeek: number;
  workoutsThisWeek: number;
  hasData: boolean;
}

const FOCUS_25 = 25 * 60;
const FOCUS_50 = 50 * 60;
const WEEK_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function Home() {
  const supabase = getSupabaseClient();
  const [momentum, setMomentum] = useState<HomeMomentum | null>(null);
  const [today, setToday] = useState<DashboardToday | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const [timer, setTimer] = useState(FOCUS_25);
  const [focusBase, setFocusBase] = useState(FOCUS_25);
  const [running, setRunning] = useState(false);
  const [sessionDone, setSessionDone] = useState(false);

  const [checkIn, setCheckIn] = useState({ done: 0, moved: 0, blocked: "" });
  const [checkInSaved, setCheckInSaved] = useState(false);

  useEffect(() => {
    if (!supabase) {
      setLoadError("App is not configured. Missing Supabase environment variables.");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      setLoading(true);
      setLoadError(null);

      try {
        const { user, accessToken: token } = await getClientAuth(supabase);

        if (!user || !token) {
          setSignedIn(false);
          setLoading(false);
          return;
        }

        setSignedIn(true);

        const [momentumRes, todayRes] = await Promise.all([
          apiFetch("/api/gamification/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          apiFetch("/api/dashboard/today", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (momentumRes.status === 401 || todayRes.status === 401) {
          await supabase.auth.signOut();
          setSignedIn(false);
          setLoadError("Your session expired. Please sign in again.");
          return;
        }

        if (momentumRes.ok) {
          const raw = (await momentumRes.json()) as Partial<HomeMomentum>;
          setMomentum({
            xp: raw.xp ?? 0,
            level: raw.level ?? 1,
            streak: raw.streak ?? 0,
            streakStatus: raw.streakStatus ?? "safe",
            streakAdvice: raw.streakAdvice ?? "Keep your streak alive with one focused session.",
            nextBestAction: raw.nextBestAction ?? "Do one 25-minute revision sprint now.",
          });
        }

        if (todayRes.ok) setToday((await todayRes.json()) as DashboardToday);
      } catch (e: unknown) {
        setLoadError(e instanceof Error ? e.message : "Could not load dashboard.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setSessionDone(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ww-checkin");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { date: string; done: number; moved: number; blocked: string };
      const todayKey = new Date().toISOString().slice(0, 10);
      if (parsed.date === todayKey) {
        setCheckIn({ done: parsed.done, moved: parsed.moved, blocked: parsed.blocked });
        setCheckInSaved(true);
      }
    } catch {
      // ignore
    }
  }, []);

  const timerText = useMemo(() => {
    const mm = String(Math.floor(timer / 60)).padStart(2, "0");
    const ss = String(timer % 60).padStart(2, "0");
    return `${mm}:${ss}`;
  }, [timer]);

  const timerProgress = useMemo(() => {
    const base = focusBase || FOCUS_25;
    return Math.max(0, Math.min(1, 1 - timer / base));
  }, [timer, focusBase]);

  const deadlineRisk = useMemo(() => {
    const priorities = today?.priorities ?? [];
    const assignmentCount = priorities.filter((p) => p.type === "Assignment").length;
    const studyCount = priorities.filter((p) => p.type === "Study").length;

    if (!priorities.length) return { score: 0, label: "No data", hint: "Add assignments and study blocks to see risk." };

    const score = Math.min(100, Math.round(assignmentCount * 22 + Math.max(0, assignmentCount - studyCount) * 18));
    const label = score >= 70 ? "High" : score >= 40 ? "Medium" : "Low";
    const hint =
      score >= 70
        ? "You're assignment-heavy. Add 2+ focused study blocks today."
        : score >= 40
          ? "Moderate pressure. Keep a steady daily revision block."
          : "Healthy pace. Keep consistency to stay ahead.";

    return { score, label, hint };
  }, [today]);

  const examCountdown = useMemo(() => {
    const next = today?.nextEvent;
    if (!next) return "Add your next deadline to unlock countdowns.";

    const now = new Date();
    const currentDay = now.getDay();
    const targetDay = WEEK_DAYS.indexOf(next.day);
    if (targetDay < 0) return `Next item: ${next.title}`;

    const daysUntil = (targetDay - currentDay + 7) % 7;
    return daysUntil === 0
      ? `Today · ${next.title}`
      : `${daysUntil} day${daysUntil === 1 ? "" : "s"} until ${next.title}`;
  }, [today]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  }, []);

  const saveCheckIn = () => {
    const todayKey = new Date().toISOString().slice(0, 10);
    localStorage.setItem(
      "ww-checkin",
      JSON.stringify({ date: todayKey, ...checkIn })
    );
    setCheckInSaved(true);
  };

  if (!loading && !signedIn && !loadError) {
    return (
      <PageShell>
        <Reveal>
          <div className="reveal-item hero-panel min-h-[70vh] flex flex-col justify-between p-8 md:p-12 relative overflow-hidden">
            <div className="absolute inset-0 opacity-90 pointer-events-none">
              <div className="absolute -right-16 top-10 w-[420px] h-[420px] rounded-full bg-violet-500/30 blur-3xl" />
              <div className="absolute -left-20 bottom-0 w-[360px] h-[360px] rounded-full bg-fuchsia-500/20 blur-3xl" />
            </div>

            <div className="relative z-[1]">
              <Logo href={null} tone="onLight" markClassName="h-12 w-12" className="mb-8" />
              <p className="eyebrow">Student Momentum OS</p>
              <h1 className="mt-4 font-display text-4xl md:text-6xl font-semibold text-[var(--ink)] max-w-xl leading-[1.05]">
                Your week, under control.
              </h1>
              <p className="mt-5 text-lg text-[var(--muted)] max-w-md">
                Plan in minutes, protect your streak, and study with calm focus — built for uni life.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary text-base px-6 py-3">
                  Create account
                </Link>
                <Link href="/login" className="btn-dark text-base px-6 py-3">
                  Sign in
                </Link>
              </div>
            </div>

            <div className="relative z-[1] mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              {[
                { t: "Smart schedule", d: "AI plans around lectures & deadlines" },
                { t: "Focus engine", d: "Timed sprints that stick" },
                { t: "Live momentum", d: "XP, streaks & next best action" },
              ].map((item) => (
                <div key={item.t} className="rounded-2xl border border-[var(--line)] bg-white/[0.05] backdrop-blur-xl px-4 py-3 backdrop-blur-sm">
                  <p className="font-display font-semibold text-[var(--ink)]">{item.t}</p>
                  <p className="text-sm text-[var(--muted)] mt-1">{item.d}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Reveal>
        <div className="reveal-item">
          <PageHero
            eyebrow={greeting}
            title="What should you do next?"
            subtitle={momentum?.nextBestAction ?? "Start a focus sprint, then lock your week in Schedule."}
            actions={
              <Link href="/schedule" className="btn-dark">
                Open schedule
              </Link>
            }
            meta={
              momentum ? (
                <>
                  <span className="stat-chip">Level {momentum.level}</span>
                  <span className="stat-chip">{momentum.xp} XP</span>
                  <span className="stat-chip">{momentum.streak}-day streak</span>
                </>
              ) : undefined
            }
          >
            <div className="mt-5">
              <Mascot
                compact
                mood={running ? "focus" : sessionDone ? "celebrate" : "happy"}
                message={
                  sessionDone
                    ? "Session complete — take a short break, then one more sprint if you can."
                    : "Small daily wins beat last-minute panic."
                }
              />
            </div>
          </PageHero>
        </div>

        {loadError && (
          <div className="reveal-item card-soft p-4 border-rose-400/35 bg-rose-500/12 text-rose-200 text-sm flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button type="button" onClick={() => window.location.reload()} className="btn-secondary">
              Retry
            </button>
          </div>
        )}

        {momentum && (
          <div className="reveal-item next-action flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow text-violet-200">Next best action</p>
              <p className="font-display text-lg font-semibold text-[var(--ink)] mt-1">{momentum.nextBestAction}</p>
              <p className="helper-text mt-1">{momentum.streakAdvice}</p>
            </div>
            <Link href="/momentum" className="btn-primary">
              Open Momentum
            </Link>
          </div>
        )}

        {sessionDone && (
          <div className="reveal-item card-soft p-4 border-violet-400/30 bg-violet-500/10 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-violet-200">Nice work — break for 5 minutes?</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setSessionDone(false);
                  setTimer(5 * 60);
                  setFocusBase(5 * 60);
                  setRunning(true);
                }}
              >
                Start 5m break
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => {
                  setSessionDone(false);
                  setTimer(FOCUS_25);
                  setFocusBase(FOCUS_25);
                  setRunning(true);
                }}
              >
                Another 25m
              </button>
            </div>
          </div>
        )}

        <div className="reveal-item grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-5 card-soft p-5">
            <p className="eyebrow text-[var(--muted)]">Focus</p>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="timer-ring h-28 w-28 rounded-full grid place-items-center shrink-0"
                style={{
                      background: `radial-gradient(circle at center, #171123 58%, transparent 59%), conic-gradient(from -90deg, #a78bfa ${timerProgress * 360}deg, rgba(255,255,255,0.1) 0)`,
                }}
              >
                <p className="font-sans text-2xl font-bold tabular-nums text-[var(--ink)]">{timerText}</p>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusBase(FOCUS_25);
                      setTimer(FOCUS_25);
                      setSessionDone(false);
                    }}
                    className={`text-sm py-1.5 px-3 ${focusBase === FOCUS_25 ? "btn-primary" : "btn-secondary"}`}
                  >
                    25m
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFocusBase(FOCUS_50);
                      setTimer(FOCUS_50);
                      setSessionDone(false);
                    }}
                    className={`text-sm py-1.5 px-3 ${focusBase === FOCUS_50 ? "btn-primary" : "btn-secondary"}`}
                  >
                    50m
                  </button>
                </div>
                <button type="button" onClick={() => setRunning((v) => !v)} className="btn-primary text-sm">
                  {running ? "Pause" : "Start focus"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setFocusBase(FOCUS_25);
                    setTimer(FOCUS_25);
                    setSessionDone(false);
                  }}
                  className="btn-ghost text-sm py-1.5"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-4 card-soft p-5">
            <p className="eyebrow text-[var(--muted)]">Today</p>
            {today?.priorities?.length ? (
              <ul className="mt-3 space-y-2">
                {today.priorities.slice(0, 3).map((p) => (
                  <li key={p.id} className="text-sm border border-violet-400/30 rounded-xl px-3 py-2.5 bg-violet-500/10">
                    <span className="font-semibold text-[var(--ink)]">{p.title}</span>
                    <span className="text-[var(--muted)]"> · {p.day} {p.startHour}:00</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text mt-3">No priorities yet. Add a lecture or assignment to see your day.</p>
            )}
            <Link href="/schedule" className="inline-block mt-4 text-violet-200 text-sm font-semibold hover:underline">
              Plan the week →
            </Link>
          </div>

          <div className="lg:col-span-3 card-soft p-5">
            <p className="eyebrow text-[var(--muted)]">Deadline risk</p>
            <p className="font-display text-3xl font-bold mt-2 text-[var(--ink)]">
              {deadlineRisk.score}
              <span className="text-base font-medium text-[var(--muted)]"> /100</span>
            </p>
            <p className="text-sm font-semibold text-[var(--foreground)] mt-1">{deadlineRisk.label}</p>
            <p className="helper-text mt-2">{deadlineRisk.hint}</p>
            <p className="text-sm text-violet-200 mt-3 font-semibold">{examCountdown}</p>
          </div>
        </div>

        <details className="reveal-item card-soft p-5 checkin-fold">
          <summary className="flex items-center justify-between gap-3">
            <span>
              <span className="eyebrow text-[var(--muted)] block">End of day</span>
              <span className="font-display text-lg text-[var(--ink)]">Check-in</span>
            </span>
            {checkInSaved && <span className="text-xs font-semibold text-violet-200 bg-violet-500/10 px-2.5 py-1 rounded-full">Saved</span>}
          </summary>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
            <label className="text-sm font-medium text-[var(--foreground)]">
              Done
              <input
                aria-label="tasks done"
                type="number"
                min={0}
                value={checkIn.done}
                onChange={(e) => {
                  setCheckInSaved(false);
                  setCheckIn((v) => ({ ...v, done: Number(e.target.value) }));
                }}
                className="mt-1 w-full input-polish p-2.5"
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)]">
              Moved
              <input
                aria-label="tasks moved"
                type="number"
                min={0}
                value={checkIn.moved}
                onChange={(e) => {
                  setCheckInSaved(false);
                  setCheckIn((v) => ({ ...v, moved: Number(e.target.value) }));
                }}
                className="mt-1 w-full input-polish p-2.5"
              />
            </label>
            <label className="text-sm font-medium text-[var(--foreground)] md:col-span-2">
              Blocked by
              <input
                aria-label="blocked reason"
                value={checkIn.blocked}
                onChange={(e) => {
                  setCheckInSaved(false);
                  setCheckIn((v) => ({ ...v, blocked: e.target.value }));
                }}
                placeholder="e.g. lab overran / low energy"
                className="mt-1 w-full input-polish p-2.5"
              />
            </label>
          </div>
          <button type="button" onClick={saveCheckIn} className="btn-secondary text-sm mt-4">
            Save check-in
          </button>
        </details>

        {loading && (
          <div className="reveal-item grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 rounded-2xl bg-white/[0.05] backdrop-blur-xl animate-pulse border border-white/10" />
            <div className="h-24 rounded-2xl bg-white/[0.05] backdrop-blur-xl animate-pulse border border-white/10" />
            <div className="h-24 rounded-2xl bg-white/[0.05] backdrop-blur-xl animate-pulse border border-white/10" />
          </div>
        )}

        <div className="reveal-item">
          <ToolRail />
        </div>
      </Reveal>
    </PageShell>
  );
}

