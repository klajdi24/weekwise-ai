import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { AiError, badInput, providerError, unauthorized } from "@/lib/ai/errors";
import { consumeQuotaOrThrow, finalizeUsage } from "@/lib/ai/quota";

interface WeeklyEvent {
  day: string;
  start_hour: number;
  duration: number;
  title: string;
  type: string;
}

const MAX_EVENTS = 120;

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    const supabase = createAuthedSupabaseClient(token);
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw unauthorized();

    const userId = userRes.user.id;
    const quota = await consumeQuotaOrThrow(supabase, userId, "weekly-summary");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw providerError("AI is temporarily unavailable (missing OpenAI API key).");

    const body = (await req.json()) as { events?: WeeklyEvent[] };
    const events = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS) : [];

    const prompt = `
You are a productivity coach.

Here is a user's weekly schedule:
${events
  .map((e) => `${e.day} at ${e.start_hour}:00 for ${e.duration}h - ${e.title} (${e.type})`)
  .join("\n")}

Give:
1. A short summary of how balanced or busy the week is
2. 2–3 actionable suggestions
Keep it concise and friendly.
`;

    if (prompt.length > 18_000) throw badInput("Schedule payload too large for weekly summary.");

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      max_tokens: 450,
    });

    const content = completion.choices?.[0]?.message?.content || "";
    if (!content) throw providerError("Empty AI response");

    const usage = completion.usage;
    const requestTokens = usage?.prompt_tokens ?? 0;
    const responseTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? requestTokens + responseTokens;

    await finalizeUsage(supabase, quota.usageId, {
      request_tokens: requestTokens,
      response_tokens: responseTokens,
      total_tokens: totalTokens,
      cost_estimate: 0,
    });

    return NextResponse.json({
      summary: content,
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
    const message = error instanceof Error ? error.message : "AI summary failed";
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
