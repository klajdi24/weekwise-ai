import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { AiError, badInput, providerError, unauthorized } from "@/lib/ai/errors";
import { consumeQuotaOrThrow, finalizeUsage } from "@/lib/ai/quota";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const EVENT_TYPES = ["Lecture", "Assignment", "Study"] as const;

type EventType = (typeof EVENT_TYPES)[number];
type DayName = (typeof DAYS)[number];
type PlanMode = "balanced" | "deep_focus" | "light_week";

interface ScheduleEventPayload {
  title: string;
  type: EventType;
  day: DayName;
  start_hour: number;
  duration: number;
}

interface ScheduleResponsePayload {
  events?: unknown;
  explanation?: string;
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function isScheduleEventPayload(value: unknown): value is ScheduleEventPayload {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;

  return (
    typeof record.title === "string" &&
    EVENT_TYPES.includes(record.type as EventType) &&
    DAYS.includes(record.day as DayName) &&
    Number.isInteger(record.start_hour) &&
    Number(record.start_hour) >= 0 &&
    Number(record.start_hour) <= 23 &&
    Number.isFinite(record.duration) &&
    Number(record.duration) > 0
  );
}

function normalizeEvent(input: ScheduleEventPayload): ScheduleEventPayload {
  return {
    title: input.title.trim().slice(0, 80) || "Untitled",
    type: input.type,
    day: input.day,
    start_hour: Math.max(8, Math.min(21, Math.trunc(input.start_hour))),
    duration: Math.max(1, Math.min(4, Math.trunc(input.duration))),
  };
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw unauthorized();
    const userId = userRes.user.id;

    const quota = await consumeQuotaOrThrow(supabase, userId, "schedule");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw providerError("AI is temporarily unavailable (missing OpenAI API key).");

    const { events, mode } = (await req.json()) as { events?: unknown[]; mode?: PlanMode };
    if (!Array.isArray(events)) throw badInput("Invalid events input");
    if (events.length > 200) throw badInput("Too many events. Please keep schedule input under 200 items.");

    const planMode: PlanMode = mode && ["balanced", "deep_focus", "light_week"].includes(mode)
      ? mode
      : "balanced";

    const modeInstruction =
      planMode === "deep_focus"
        ? "Prioritize longer study blocks and fewer context switches."
        : planMode === "light_week"
        ? "Reduce overload and keep energy sustainable with lighter distribution."
        : "Balance workload and recovery across the week.";

    const prompt = `
You are a scheduling assistant for a university student.

PLANNING MODE: ${planMode}
MODE GOAL: ${modeInstruction}

INPUT EVENTS:
${JSON.stringify(events, null, 2)}

RULES:
- Keep lectures fixed
- Add study sessions before assignments
- Avoid overlapping times
- Use realistic hours (8–21)
- Do NOT remove assignments
- Be supportive and student-friendly

OUTPUT JSON ONLY in this format:
{
  "events": [
    {
      "title": string,
      "type": "Lecture" | "Assignment" | "Study",
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "start_hour": number,
      "duration": number
    }
  ],
  "explanation": string
}

No markdown. No extra text.
`;

    if (prompt.length > 22_000) throw badInput("Schedule payload too large.");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 950,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw providerError("Empty AI response");

    let parsed: ScheduleResponsePayload;
    try {
      parsed = JSON.parse(raw) as ScheduleResponsePayload;
    } catch {
      throw providerError("AI returned invalid JSON");
    }

    const cleanedEvents = Array.isArray(parsed.events)
      ? parsed.events.filter(isScheduleEventPayload).map((e) => normalizeEvent(e))
      : [];

    const usage = completion.usage;
    await finalizeUsage(supabase, quota.usageId, {
      request_tokens: usage?.prompt_tokens ?? 0,
      response_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      cost_estimate: 0,
    });

    return NextResponse.json({
      events: cleanedEvents,
      explanation:
        parsed.explanation ||
        "This schedule balances your workload and adds study time ahead of deadlines to reduce stress.",
      usage: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        period: quota.period,
        resetAt: quota.resetAt,
        plan: quota.plan,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toPayload(), { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to generate AI schedule";
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
