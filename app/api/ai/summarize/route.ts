import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";
import { AiError, badInput, providerError, unauthorized } from "@/lib/ai/errors";
import { consumeQuotaOrThrow, finalizeUsage } from "@/lib/ai/quota";
import { getUserPlan, type Plan } from "@/lib/ai/entitlements";

interface PdfParseResult {
  text?: string;
}

type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

type SummaryMode = "quick" | "exam" | "deep";
type SummaryFormat = "paragraph" | "bullets" | "flashcards";

const PLAN_FILE_LIMIT_MB: Record<Plan, number> = {
  free: 10,
  pro: 25,
  unlimited: 50,
};

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

function sanitizeMode(input: string | null): SummaryMode {
  if (input === "exam" || input === "deep") return input;
  return "quick";
}

function sanitizeFormat(input: string | null): SummaryFormat {
  if (input === "paragraph" || input === "flashcards") return input;
  return "bullets";
}

function truncateText(input: string, max = 15000) {
  return input.length > max ? `${input.slice(0, max)}\n\n[Content truncated for summary quality and safety.]` : input;
}

function estimateXp(mode: SummaryMode, format: SummaryFormat) {
  const modeBoost = mode === "deep" ? 18 : mode === "exam" ? 15 : 10;
  const formatBoost = format === "flashcards" ? 10 : format === "bullets" ? 6 : 4;
  return modeBoost + formatBoost;
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) throw unauthorized();

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) throw unauthorized();

    const userId = userRes.user.id;
    const planSnapshot = await getUserPlan(supabase, userId);
    const maxMb = PLAN_FILE_LIMIT_MB[planSnapshot.plan] ?? 10;
    const maxBytes = maxMb * 1024 * 1024;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw providerError("AI is temporarily unavailable (missing OpenAI API key).");

    const formData = await req.formData();
    const file = formData.get("file");
    const mode = sanitizeMode((formData.get("mode") as string | null) ?? null);
    const format = sanitizeFormat((formData.get("format") as string | null) ?? null);

    if (!(file instanceof File)) throw badInput("No file uploaded. Please choose a PDF file.");
    const fileMb = Number((file.size / (1024 * 1024)).toFixed(2));
    if (file.size > maxBytes) {
      return NextResponse.json(
        {
          ok: false,
          code: "FILE_TOO_LARGE",
          message: "Uploaded PDF exceeds your plan limit.",
          maxMb,
          plan: planSnapshot.plan,
          fileMb,
        },
        { status: 413 },
      );
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) throw badInput("Only .pdf files are supported");
    if (file.type && file.type !== "application/pdf") throw badInput("Uploaded file is not a valid PDF.");

    const quota = await consumeQuotaOrThrow(supabase, userId, "summarize");

    const buffer = Buffer.from(await file.arrayBuffer());

    let pdfData: PdfParseResult;
    try {
      const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
      const pdfParse = pdfParseModule.default as PdfParseFn;
      pdfData = await pdfParse(buffer);
    } catch {
      throw badInput("Could not read this PDF. The file may be corrupt or password-protected.");
    }

    const text = truncateText((pdfData.text || "").trim());

    if (!text) throw badInput("No readable text found in this PDF.");

    const modeInstruction =
      mode === "deep"
        ? "Give nuanced explanation, potential pitfalls, and conceptual links between topics."
        : mode === "exam"
        ? "Focus on exam-relevant points, likely question areas, and memory cues."
        : "Keep it short and practical for quick review.";

    const formatInstruction =
      format === "paragraph"
        ? "Return concise paragraph summary style."
        : format === "flashcards"
        ? "Return flashcard-friendly Q/A style points where useful."
        : "Return bullet-heavy structure with clear sectioning.";

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content:
            "You summarize university lecture material. Respond as strict JSON only with keys: summary (string), keyPoints (string[]), actionItems (string[]), quizQuestions (string[]).",
        },
        {
          role: "user",
          content: `MODE: ${mode}\nFORMAT: ${format}\nGUIDANCE: ${modeInstruction} ${formatInstruction}\n\nSOURCE TEXT:\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
      max_tokens: 900,
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) throw providerError("Empty AI response");

    let parsed: {
      summary?: string;
      keyPoints?: unknown;
      actionItems?: unknown;
      quizQuestions?: unknown;
    };

    try {
      parsed = JSON.parse(raw) as {
        summary?: string;
        keyPoints?: unknown;
        actionItems?: unknown;
        quizQuestions?: unknown;
      };
    } catch {
      throw providerError("AI returned invalid JSON");
    }

    const toStringArray = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 8) : [];

    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const keyPoints = toStringArray(parsed.keyPoints);
    const actionItems = toStringArray(parsed.actionItems);
    const quizQuestions = toStringArray(parsed.quizQuestions);

    if (!summary) throw providerError("Summary generation failed.");

    const usage = completion.usage;
    await finalizeUsage(supabase, quota.usageId, {
      request_tokens: usage?.prompt_tokens ?? 0,
      response_tokens: usage?.completion_tokens ?? 0,
      total_tokens: usage?.total_tokens ?? 0,
      cost_estimate: 0,
    });

    const xpReward = estimateXp(mode, format);

    return NextResponse.json({
      summary,
      keyPoints,
      actionItems,
      quizQuestions,
      mode,
      format,
      xpReward,
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
    const message = error instanceof Error ? error.message : "Failed to summarize PDF";
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR", message }, { status: 500 });
  }
}
