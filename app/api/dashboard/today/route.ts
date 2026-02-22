import { NextRequest, NextResponse } from "next/server";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function dayIndex(day: string) {
  const idx = DAYS.indexOf(day);
  return idx === -1 ? 99 : idx;
}

function currentDayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
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

    const [{ data: events }, { data: workouts }] = await Promise.all([
      supabase.from("events").select("id,title,type,day,start_hour,duration").eq("user_id", userId),
      supabase.from("workouts").select("id,date").eq("user_id", userId),
    ]);

    const nowDay = currentDayIndex();

    const sorted = (events ?? [])
      .slice()
      .sort((a, b) => {
        const ad = dayIndex(String(a.day));
        const bd = dayIndex(String(b.day));
        const aScore = ad < nowDay ? ad + 7 : ad;
        const bScore = bd < nowDay ? bd + 7 : bd;
        if (aScore !== bScore) return aScore - bScore;
        return Number(a.start_hour || 0) - Number(b.start_hour || 0);
      });

    const nextEvent = sorted[0] ?? null;

    const priorities = sorted
      .filter((e) => e.type === "Assignment" || e.type === "Study")
      .slice(0, 3)
      .map((e) => ({
        id: e.id,
        title: e.title,
        day: e.day,
        type: e.type,
        startHour: e.start_hour,
      }));

    const sessionsThisWeek = (events ?? []).filter((e) => e.type === "Study").length;
    const workoutsThisWeek = workouts?.length ?? 0;

    return NextResponse.json({
      nextEvent,
      priorities,
      sessionsThisWeek,
      workoutsThisWeek,
      hasData: (events?.length ?? 0) > 0,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load dashboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
