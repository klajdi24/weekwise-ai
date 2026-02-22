import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { AiError, badInput, providerError, unauthorized } from "@/lib/ai/errors";
import { consumeQuotaOrThrow, finalizeUsage } from "@/lib/ai/quota";

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
    if (!token) throw unauthorized();

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw unauthorized();
    const userId = userRes.user.id;

    const quota = await consumeQuotaOrThrow(supabase, userId, "suggest");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw providerError("AI is temporarily unavailable (missing OpenAI API key).");

    const { events } = (await req.json()) as { events?: unknown[] };
    if (!Array.isArray(events)) throw badInput("Invalid events input");
    if (events.length > 200) throw badInput("Too many events. Please keep schedule input under 200 items.");

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

    if (prompt.length > 20_000) throw badInput("Input too large for suggestions");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
      max_tokens: 700,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) throw providerError("Empty AI response");

    let parsed: { suggestions?: unknown };
    try {
      parsed = JSON.parse(raw) as { suggestions?: unknown };
    } catch {
      throw providerError("AI returned invalid JSON");
    }

    const cleanedSuggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter(isSuggestionPayload)
      : [];

    const usage = completion.usage;
    await finalizeUsage(supabase, quota.usageId, {
      request_tokens: usage?.prompt_tokens ?? 0,
      response_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      cost_estimate: 0,
    });

    return NextResponse.json({
      suggestions: cleanedSuggestions,
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
    const message = error instanceof Error ? error.message : "Failed to generate AI suggestions";
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
