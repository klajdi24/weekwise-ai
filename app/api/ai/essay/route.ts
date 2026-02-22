import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { AiError, badInput, providerError, unauthorized } from "@/lib/ai/errors";
import { consumeQuotaOrThrow, finalizeUsage } from "@/lib/ai/quota";

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

function estimateXp(essayType: EssayType) {
  return essayType === "draft" ? 24 : essayType === "improve" ? 20 : 16;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw unauthorized();

    const userId = userRes.user.id;
    const quota = await consumeQuotaOrThrow(supabase, userId, "essay");

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw providerError("AI is temporarily unavailable (missing OpenAI API key).");

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

    if (!prompt) throw badInput("Essay prompt is required.");

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

    const openai = new OpenAI({ apiKey });
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
      max_tokens: 1000,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) throw providerError("Empty AI response");

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
      throw providerError("AI returned invalid JSON");
    }

    const toStringArray = (v: unknown) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8) : [];

    const output = typeof parsed.output === "string" ? parsed.output.trim() : "";
    if (!output) throw providerError("Essay generation failed");

    const usage = completion.usage;
    await finalizeUsage(supabase, quota.usageId, {
      request_tokens: usage?.prompt_tokens ?? 0,
      response_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      cost_estimate: 0,
    });

    return NextResponse.json({
      title: typeof parsed.title === "string" ? parsed.title : "Essay Assistant Output",
      thesis: typeof parsed.thesis === "string" ? parsed.thesis : "",
      output,
      checklist: toStringArray(parsed.checklist),
      referencesNeeded: toStringArray(parsed.referencesNeeded),
      xpReward: estimateXp(essayType),
      usage: {
        used: quota.used,
        limit: quota.limit,
        remaining: quota.remaining,
        period: quota.period,
        resetAt: quota.resetAt,
        plan: quota.plan,
      },
      remaining: quota.remaining,
      isUnlimitedAi: quota.plan === "pro",
    });
  } catch (error: unknown) {
    if (error instanceof AiError) {
      return NextResponse.json(error.toPayload(), { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Essay generation failed";
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
