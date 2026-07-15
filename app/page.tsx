"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "@/lib/supabaseClient";
import { getClientAuth } from "@/lib/authClient";
import Mascot from "./components/mascot";
import PageShell, { PageHero } from "./components/page-shell";
import Reveal from "./components/reveal";
import Logo from "./components/logo";

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
          fetch("/api/gamification/summary", {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch("/api/dashboard/today", {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

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

  const streakTone =
    momentum?.streakStatus === "risk"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : momentum?.streakStatus === "warming"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-teal-200 bg-teal-50 text-teal-950";

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
            <div className="absolute inset-0 opacity-40 pointer-events-none">
              <div className="absolute -right-16 top-10 w-[420px] h-[420px] rounded-full bg-teal-400/30 blur-3xl" />
              <div className="absolute -left-20 bottom-0 w-[360px] h-[360px] rounded-full bg-sky-400/20 blur-3xl" />
            </div>

            <div className="relative z-[1]">
              <Logo href={null} tone="light" markClassName="h-12 w-12" className="mb-8" />
              <p className="eyebrow text-teal-300">Student Momentum OS</p>
              <h1 className="mt-4 font-display text-4xl md:text-6xl font-bold text-white max-w-xl leading-[1.05]">
                Your week, under control.
              </h1>
              <p className="mt-5 text-lg text-teal-50/75 max-w-md">
                Plan in minutes, protect your streak, and study with calm focus — built for uni life.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="btn-primary text-base px-6 py-3">
                  Sign in to start
                </Link>
                <Link href="/pricing" className="btn-dark text-base px-6 py-3">
                  See plans
                </Link>
              </div>
            </div>

            <div className="relative z-[1] mt-12 grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
              {[
                { t: "Smart schedule", d: "AI plans around lectures & deadlines" },
                { t: "Focus engine", d: "Timed sprints that stick" },
                { t: "Live momentum", d: "XP, streaks & next best action" },
              ].map((item) => (
                <div key={item.t} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="font-display font-semibold text-white">{item.t}</p>
                  <p className="text-sm text-teal-100/60 mt-1">{item.d}</p>
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
          <Mascot
            mood={running ? "focus" : sessionDone ? "celebrate" : "happy"}
            message={
              sessionDone
                ? "Session complete — take a short break, then one more sprint if you can."
                : "Small daily wins beat last-minute panic. Lock your next move."
            }
          />
        </div>

        <div className="reveal-item">
          <PageHero
            eyebrow="Today"
            title="Your command centre"
            subtitle="Plan in minutes, execute with focus, and protect your streak."
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
                  <span className="stat-chip">{momentum.streak} day streak</span>
                </>
              ) : undefined
            }
          />
        </div>

        {loadError && (
          <div className="reveal-item card-soft p-4 border-rose-200 bg-rose-50 text-rose-800 text-sm flex items-center justify-between gap-3">
            <span>{loadError}</span>
            <button type="button" onClick={() => window.location.reload()} className="btn-secondary">
              Retry
            </button>
          </div>
        )}

        {sessionDone && (
          <div className="reveal-item card-soft p-4 border-teal-200 bg-teal-50 flex flex-wrap items-center justify-between gap-3">
            <p className="font-semibold text-teal-950">Nice work — break for 5 minutes?</p>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setSessionDone(false);
                  setTimer(5 * 60);
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
                  setRunning(true);
                }}
              >
                Another 25m
              </button>
            </div>
          </div>
        )}

        <div className="reveal-item grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card-soft card-hover p-5">
            <p className="eyebrow text-slate-500">Deadline intelligence</p>
            <p className="section-title mt-2">
              Risk {deadlineRisk.score}
              <span className="text-slate-400 font-medium text-lg"> /100 · {deadlineRisk.label}</span>
            </p>
            <p className="helper-text mt-2">{deadlineRisk.hint}</p>
            <p className="text-sm text-teal-800 mt-3 font-semibold">{examCountdown}</p>
            <Link href="/schedule" className="inline-block mt-4 text-teal-700 text-sm font-semibold hover:underline">
              Auto-plan in Schedule →
            </Link>
          </div>

          <div className="card-soft card-hover p-5 flex flex-col">
            <p className="eyebrow text-slate-500">Daily focus engine</p>
            <div className="mt-3 flex items-center gap-4">
              <div
                className="timer-ring h-24 w-24 rounded-full grid place-items-center shrink-0 shadow-inner"
                style={{
                  background: `radial-gradient(circle at center, #fff 58%, transparent 59%), conic-gradient(from -90deg, #14b8a6 ${timerProgress * 360}deg, #e2e8f0 0)`,
                }}
              >
                <p className="font-display text-2xl font-bold tabular-nums text-slate-900">{timerText}</p>
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => {
                      setFocusBase(FOCUS_25);
                      setTimer(FOCUS_25);
                      setSessionDone(false);
                    }}
                    className="btn-secondary text-sm py-1.5 px-3"
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
                    className="btn-secondary text-sm py-1.5 px-3"
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

          <div className="card-soft card-hover p-5">
            <p className="eyebrow text-slate-500">Plan my day</p>
            {today?.priorities?.length ? (
              <ul className="mt-3 space-y-2">
                {today.priorities.slice(0, 3).map((p) => (
                  <li key={p.id} className="text-sm border border-teal-100 rounded-xl px-3 py-2.5 bg-teal-50/50">
                    <span className="font-semibold text-slate-800">{p.title}</span>
                    <span className="text-slate-500"> · {p.day} {p.startHour}:00</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="helper-text mt-3">No priorities yet — add assignment or study events first.</p>
            )}
            <Link href="/schedule" className="inline-block mt-4 text-teal-700 text-sm font-semibold hover:underline">
              Open Schedule →
            </Link>
          </div>
        </div>

        <div className="reveal-item card-soft card-hover p-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="eyebrow text-slate-500">End-of-day check-in</p>
            {checkInSaved && <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full">Saved for today</span>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
            <label className="text-sm font-medium text-slate-700">
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
            <label className="text-sm font-medium text-slate-700">
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
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
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
        </div>

        {loading ? (
          <div className="reveal-item grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-28 rounded-2xl bg-white/80 animate-pulse border border-slate-100" />
            <div className="h-28 rounded-2xl bg-white/80 animate-pulse border border-slate-100" />
            <div className="h-28 rounded-2xl bg-white/80 animate-pulse border border-slate-100" />
          </div>
        ) : (
          momentum && (
            <div className={`reveal-item rounded-2xl border p-5 shadow-sm ${streakTone}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="eyebrow opacity-80">Live momentum</p>
                  <p className="font-display text-2xl font-bold mt-1">
                    Level {momentum.level} · {momentum.xp} XP · {momentum.streak}-day streak
                  </p>
                  <p className="text-sm mt-1 opacity-90">{momentum.streakAdvice}</p>
                </div>
                <Link href="/momentum" className="btn-primary">
                  Open Momentum
                </Link>
              </div>
              <p className="text-sm mt-3 font-medium">Next best action: {momentum.nextBestAction}</p>
            </div>
          )
        )}

        <div className="reveal-item">
          <p className="section-title text-slate-900 mb-4">Tools</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <FeatureCard
              title="Academic Schedule"
              text="View, add, and optimize classes and assignments."
              href="/schedule"
              cta="Go to Schedule"
            />
            <FeatureCard
              title="Fitness Tracker"
              text="Log workouts, track steps, and monitor progress."
              href="/fitness"
              cta="Go to Fitness"
            />
            <FeatureCard
              title="PDF Summarizer"
              text="Upload lecture slides and get concise summaries."
              href="/summarize"
              cta="Summarize PDFs"
            />
            <FeatureCard
              title="Momentum"
              text="Track daily wins, XP and streak risk in one view."
              href="/momentum"
              cta="Open Momentum"
            />
            <FeatureCard
              title="Essay Coach"
              text="Create outlines and improve your draft quality."
              href="/essay"
              cta="Open Essay Coach"
            />
            <FeatureCard
              title="Profile"
              text="Manage your account, badges, and plan."
              href="/profile"
              cta="Go to Profile"
            />
          </div>
        </div>
      </Reveal>
    </PageShell>
  );
}

function FeatureCard({ title, text, href, cta }: { title: string; text: string; href: string; cta: string }) {
  return (
    <Link href={href} className="card-soft card-hover p-5 block group">
      <div className="feature-icon mb-3">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 className="font-display text-lg font-semibold text-slate-900 group-hover:text-teal-800 transition-colors">{title}</h2>
      <p className="text-slate-600 text-sm mt-1.5 mb-4">{text}</p>
      <span className="text-teal-700 text-sm font-semibold">{cta} →</span>
    </Link>
  );
}
