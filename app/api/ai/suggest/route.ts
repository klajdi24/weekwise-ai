import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import {
  FREE_DAILY_AI_LIMIT,
  consumeAiAction,
  getAiUsageToday,
  getSubscriptionSnapshot,
  trackEvent,
} from "@/lib/subscription";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const EVENT_TYPES = ["Lecture", "Assignment", "Study"] as const;

type EventType = (typeof EVENT_TYPES)[number];
type DayName = (typeof DAYS)[number];

interface SuggestionPayload {
  title: string;
  type: EventType;
  day: DayName;
  start_hour: number;
  duration: number;
  description: string;
}

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function isSuggestionPayload(value: unknown): value is SuggestionPayload {
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
    Number(record.duration) > 0 &&
    typeof record.description === "string"
  );
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized: missing session token" }, { status: 401 });
    }

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized: invalid session" }, { status: 401 });
    }
    const userId = userRes.user.id;

    const [subscription, used] = await Promise.all([
      getSubscriptionSnapshot(supabase, userId),
      getAiUsageToday(supabase, userId),
    ]);

    if (!subscription.isUnlimitedAi && used >= FREE_DAILY_AI_LIMIT) {
      await trackEvent(supabase, userId, "paywall_viewed", { feature: "ai_suggestions", trigger: "daily_limit" });
      return NextResponse.json(
        { error: "Daily free AI limit reached (5/day). Start your 7-day Pro trial for unlimited AI.", code: "FREE_LIMIT_REACHED" },
        { status: 402 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is temporarily unavailable (missing OpenAI API key)." },
        { status: 503 }
      );
    }
    const openai = new OpenAI({ apiKey });

    const { events } = (await req.json()) as { events?: unknown[] };
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid events input" }, { status: 400 });
    }

    const prompt = `
You are an AI assistant that suggests additional events (lectures, assignments, or study sessions) to help a university student manage their week.

INPUT EVENTS:
${JSON.stringify(events, null, 2)}

RULES:
- Suggest up to 3 new events
- Keep existing events unchanged
- Use realistic hours (8–21)
- Include a short description of why the suggestion is helpful

OUTPUT JSON ONLY in this format:
{
  "suggestions": [
    {
      "title": string,
      "type": "Lecture" | "Assignment" | "Study",
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "start_hour": number,
      "duration": number,
      "description": string
    }
  ]
}
No markdown, no extra text.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    let parsed: { suggestions?: unknown };
    try {
      parsed = JSON.parse(raw) as { suggestions?: unknown };
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const cleanedSuggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter(isSuggestionPayload)
      : [];

    await consumeAiAction(supabase, userId, "suggest");
    await trackEvent(supabase, userId, "day_plan_generated", { suggestionsCount: cleanedSuggestions.length });

    const remaining = subscription.isUnlimitedAi ? null : Math.max(0, FREE_DAILY_AI_LIMIT - (used + 1));

    return NextResponse.json({ suggestions: cleanedSuggestions, remaining, isUnlimitedAi: subscription.isUnlimitedAi });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to generate AI suggestions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
