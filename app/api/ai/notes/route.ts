import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { AiError, badInput, providerError, unauthorized } from "@/lib/ai/errors";
import { consumeQuotaOrThrow, finalizeUsage } from "@/lib/ai/quota";

type NotesMode = "summarize" | "quiz";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function sanitizeMode(input: unknown): NotesMode {
  return input === "quiz" ? "quiz" : "summarize";
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw unauthorized();

    const userId = userRes.user.id;
    const quota = await consumeQuotaOrThrow(supabase, userId, "notes");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw providerError("AI is temporarily unavailable (missing OpenAI API key).");

    const body = (await req.json()) as { text?: string; mode?: NotesMode; module?: string };
    const text = (body.text || "").trim();
    const moduleName = (body.module || "General").trim();
    const mode = sanitizeMode(body.mode);

    if (text.length < 20) throw badInput("Add more note content (at least ~20 chars).");

    const systemPrompt =
      mode === "quiz"
        ? "You are a university tutor. Return strict JSON with keys: summary (string), bullets (string[]), quizQuestions (string[]), keyTerms (string[]). Produce exactly 5 quiz questions."
        : "You are a university tutor. Return strict JSON with keys: summary (string), bullets (string[]), quizQuestions (string[]), keyTerms (string[]). For summarize mode, keep quizQuestions short and optional.";

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `MODULE: ${moduleName}\nMODE: ${mode}\n\nNOTES:\n${text.slice(0, 12000)}`,
        },
      ],
      max_tokens: 800,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) throw providerError("Empty AI response");

    let parsed: { summary?: string; bullets?: unknown; quizQuestions?: unknown; keyTerms?: unknown };
    try {
      parsed = JSON.parse(raw) as { summary?: string; bullets?: unknown; quizQuestions?: unknown; keyTerms?: unknown };
    } catch {
      throw providerError("AI returned invalid JSON");
    }

    const toArr = (v: unknown, max = 8) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max) : [];

    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    if (!summary) throw providerError("No summary generated");

    const usage = completion.usage;
    await finalizeUsage(supabase, quota.usageId, {
      request_tokens: usage?.prompt_tokens ?? 0,
      response_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      cost_estimate: 0,
    });

    return NextResponse.json({
      summary,
      bullets: toArr(parsed.bullets),
      quizQuestions: toArr(parsed.quizQuestions, 5),
      keyTerms: toArr(parsed.keyTerms),
      xpReward: mode === "quiz" ? 14 : 10,
      usage: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        period: quota.period,
        resetAt: quota.resetAt,
        plan: quota.plan,
      },
      remaining: quota.remaining,
      isUnlimitedAi: quota.plan !== "free",
    });
  } catch (error: unknown) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toPayload(), { status: error.status });
    }
    const message = error instanceof Error ? error.message : "AI notes generation failed";
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
