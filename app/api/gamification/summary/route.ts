import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function toLevel(xp: number) {
  return Math.max(1, Math.floor(Math.sqrt(xp / 120)) + 1);
}

function safeIsoDate(input: string | null | undefined) {
  if (!input) return null;
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = userRes.user.id;

    const [{ data: events }, { data: workouts }, { data: profile }] = await Promise.all([
      supabase.from("events").select("id, type").eq("user_id", userId),
      supabase.from("workouts").select("id, steps, date").eq("user_id", userId),
      supabase.from("profiles").select("is_premium").eq("id", userId).maybeSingle(),
    ]);

    const eventCount = events?.length ?? 0;
    const studyCount = (events ?? []).filter((e) => e.type === "Study").length;
    const workoutCount = workouts?.length ?? 0;
    const totalSteps = (workouts ?? []).reduce((acc, w) => acc + Number(w.steps || 0), 0);

    const latestWorkoutDate = (workouts ?? [])
      .map((w) => safeIsoDate(w.date as string | null | undefined))
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const xp = eventCount * 10 + studyCount * 15 + workoutCount * 20 + Math.min(200, Math.floor(totalSteps / 500));
    const level = toLevel(xp);
    const levelFloor = Math.pow(level - 1, 2) * 120;
    const levelCeil = Math.pow(level, 2) * 120;
    const levelProgressPct = Math.max(0, Math.min(100, Math.round(((xp - levelFloor) / (levelCeil - levelFloor)) * 100)));
    const xpToNextLevel = Math.max(0, levelCeil - xp);

    const badges = [
      { id: "starter", label: "Starter", unlocked: xp >= 100 },
      { id: "planner", label: "Planner", unlocked: eventCount >= 10 },
      { id: "focus", label: "Focus Builder", unlocked: studyCount >= 6 },
      { id: "athlete", label: "Energy Keeper", unlocked: workoutCount >= 6 },
    ];

    const streak = Math.min(21, Math.floor((eventCount + workoutCount) / 3));
    const streakStatus = streak >= 7 ? "safe" : streak >= 3 ? "warming" : "risk";
    const consistencyScore = Math.min(100, Math.round((studyCount * 8 + workoutCount * 10 + eventCount * 2) / 3));

    const dailyGoalTarget = 3;
    const dailyGoalDone = Math.min(dailyGoalTarget, Math.floor((studyCount + workoutCount) / 2));

    const checklist = [
      {
        id: "study_block",
        label: "Complete one focused study block",
        done: studyCount >= 1,
        xp: 35,
      },
      {
        id: "schedule_plan",
        label: "Plan tomorrow in Schedule",
        done: eventCount >= 3,
        xp: 25,
      },
      {
        id: "movement_log",
        label: "Log movement in Fitness",
        done: workoutCount >= 1,
        xp: 20,
      },
    ];

    return NextResponse.json({
      xp,
      level,
      levelProgressPct,
      xpToNextLevel,
      consistencyScore,
      streak,
      streakStatus,
      dailyGoalTarget,
      dailyGoalDone,
      badges,
      checklist,
      latestWorkoutAt: latestWorkoutDate?.toISOString() ?? null,
      isPremium: !!profile?.is_premium,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load gamification summary";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
