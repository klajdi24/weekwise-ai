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

type EssayTone = "academic" | "clear" | "persuasive";
type EssayType = "outline" | "draft" | "improve";

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function sanitizeTone(input: unknown): EssayTone {
  return input === "clear" || input === "persuasive" ? input : "academic";
}

function sanitizeType(input: unknown): EssayType {
  return input === "draft" || input === "improve" ? input : "outline";
}

function validateWordCount(input: unknown) {
  const count = Number(input);
  if (!Number.isFinite(count)) return 700;
  return Math.max(200, Math.min(2500, Math.round(count)));
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userRes.user.id;
    const [subscription, used] = await Promise.all([
      getSubscriptionSnapshot(supabase, userId),
      getAiUsageToday(supabase, userId),
    ]);

    if (!subscription.isUnlimitedAi && used >= FREE_DAILY_AI_LIMIT) {
      await trackEvent(supabase, userId, "paywall_viewed", { feature: "ai_essay", trigger: "daily_limit" });
      return NextResponse.json(
        { error: `Daily free AI limit reached (${FREE_DAILY_AI_LIMIT}/day). Start your 7-day Pro trial.`, code: "FREE_LIMIT_REACHED" },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI unavailable. Missing OpenAI API key." }, { status: 503 });
    }

    const body = (await req.json()) as {
      prompt?: string;
      context?: string;
      essayType?: EssayType;
      tone?: EssayTone;
      wordCount?: number;
    };

    const prompt = (body.prompt || "").trim();
    const context = (body.context || "").trim();
    const essayType = sanitizeType(body.essayType);
    const tone = sanitizeTone(body.tone);
    const wordCount = validateWordCount(body.wordCount);

    if (!prompt) {
      return NextResponse.json({ error: "Essay prompt is required." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const typeInstruction =
      essayType === "draft"
        ? "Produce a strong first draft with introduction, body paragraphs, and conclusion."
        : essayType === "improve"
        ? "Improve and rewrite for better clarity, argument quality, and structure."
        : "Produce a detailed structured outline with thesis, paragraph goals, evidence, and counterargument.";

    const toneInstruction =
      tone === "clear"
        ? "Use clear and simple language suitable for undergraduate readers."
        : tone === "persuasive"
        ? "Use persuasive rhetoric while remaining academically credible."
        : "Use academic tone and precise argumentation.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.45,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a university writing coach. Return strict JSON with keys: title (string), thesis (string), output (string), checklist (string[]), referencesNeeded (string[]).",
        },
        {
          role: "user",
          content: `TASK: ${essayType}\nPROMPT: ${prompt}\nCONTEXT: ${context || "None provided"}\nWORD COUNT TARGET: ${wordCount}\nSTYLE: ${typeInstruction} ${toneInstruction}\n\nImportant: do not fabricate citations; instead suggest what evidence should be researched.`,
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) return NextResponse.json({ error: "Empty AI response" }, { status: 500 });

    let parsed: {
      title?: string;
      thesis?: string;
      output?: string;
      checklist?: unknown;
      referencesNeeded?: unknown;
    };

    try {
      parsed = JSON.parse(raw) as {
        title?: string;
        thesis?: string;
        output?: string;
        checklist?: unknown;
        referencesNeeded?: unknown;
      };
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const toStringArray = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8) : [];

    const output = typeof parsed.output === "string" ? parsed.output.trim() : "";
    if (!output) return NextResponse.json({ error: "Essay generation failed" }, { status: 500 });

    await consumeAiAction(supabase, userId, "essay");
    await trackEvent(supabase, userId, "summary_generated", { mode: essayType, source: "essay" });

    const remaining = subscription.isUnlimitedAi ? null : Math.max(0, FREE_DAILY_AI_LIMIT - (used + 1));

    return NextResponse.json({
      title: typeof parsed.title === "string" ? parsed.title : "Essay Assistant Output",
      thesis: typeof parsed.thesis === "string" ? parsed.thesis : "",
      output,
      checklist: toStringArray(parsed.checklist),
      referencesNeeded: toStringArray(parsed.referencesNeeded),
      xpReward: essayType === "draft" ? 24 : essayType === "improve" ? 20 : 16,
      remaining,
      isUnlimitedAi: subscription.isUnlimitedAi,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Essay generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
