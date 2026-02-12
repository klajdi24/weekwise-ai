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

interface PdfParseResult {
  text?: string;
}

type PdfParseFn = (buffer: Buffer) => Promise<PdfParseResult>;

type SummaryMode = "quick" | "exam" | "deep";
type SummaryFormat = "paragraph" | "bullets" | "flashcards";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

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
      await trackEvent(supabase, userId, "paywall_viewed", { feature: "ai_summarize", trigger: "daily_limit" });
      return NextResponse.json(
        {
          error: `Daily free AI limit reached (${FREE_DAILY_AI_LIMIT}/day). Start your 7-day Pro trial for unlimited summaries.`,
          code: "FREE_LIMIT_REACHED",
        },
        { status: 403 }
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

    const formData = await req.formData();
    const file = formData.get("file");
    const mode = sanitizeMode((formData.get("mode") as string | null) ?? null);
    const format = sanitizeFormat((formData.get("format") as string | null) ?? null);

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No PDF uploaded" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: "PDF is too large. Max size is 10MB." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "Only .pdf files are supported" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const pdfParseModule = await import("pdf-parse");
    const pdfParse = (pdfParseModule.default as PdfParseFn) || (pdfParseModule as unknown as PdfParseFn);

    const pdfData = await pdfParse(buffer);
    const text = truncateText((pdfData.text || "").trim());

    if (!text) {
      return NextResponse.json({ error: "No readable text found in this PDF." }, { status: 400 });
    }

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
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) return NextResponse.json({ error: "Empty AI response" }, { status: 500 });

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
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const toStringArray = (value: unknown) =>
      Array.isArray(value) ? value.filter((v): v is string => typeof v === "string" && v.trim().length > 0).slice(0, 8) : [];

    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
    const keyPoints = toStringArray(parsed.keyPoints);
    const actionItems = toStringArray(parsed.actionItems);
    const quizQuestions = toStringArray(parsed.quizQuestions);

    if (!summary) {
      return NextResponse.json({ error: "Summary generation failed." }, { status: 500 });
    }

    await consumeAiAction(supabase, userId, "summarize");
    await trackEvent(supabase, userId, "summary_generated", { mode, format, source: "pdf" });

    const xpReward = estimateXp(mode, format);
    const remaining = subscription.isUnlimitedAi ? null : Math.max(0, FREE_DAILY_AI_LIMIT - (used + 1));

    return NextResponse.json({
      summary,
      keyPoints,
      actionItems,
      quizQuestions,
      mode,
      format,
      xpReward,
      remaining,
      isUnlimitedAi: subscription.isUnlimitedAi,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to summarize PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
