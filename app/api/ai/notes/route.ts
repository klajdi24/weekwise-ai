import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";

const FREE_LIMIT = 3;

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
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createAuthedSupabaseClient(token);

    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const userId = userRes.user.id;

    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_premium, ai_usage_count")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 });

    const isPremium = !!profile?.is_premium;
    const currentUsage = Number(profile?.ai_usage_count ?? 0);

    if (!isPremium && currentUsage >= FREE_LIMIT) {
      return NextResponse.json(
        { error: `Free AI limit reached (${FREE_LIMIT}). Upgrade to Premium.`, code: "FREE_LIMIT_REACHED" },
        { status: 403 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "AI unavailable. Missing OpenAI API key." }, { status: 503 });

    const body = (await req.json()) as { text?: string; mode?: NotesMode; module?: string };
    const text = (body.text || "").trim();
    const moduleName = (body.module || "General").trim();
    const mode = sanitizeMode(body.mode);

    if (text.length < 20) {
      return NextResponse.json({ error: "Add more note content (at least ~20 chars)." }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const systemPrompt =
      mode === "quiz"
        ? "You are a university tutor. Return strict JSON with keys: summary (string), bullets (string[]), quizQuestions (string[]), keyTerms (string[]). Produce exactly 5 quiz questions."
        : "You are a university tutor. Return strict JSON with keys: summary (string), bullets (string[]), quizQuestions (string[]), keyTerms (string[]). For summarize mode, keep quizQuestions short and optional.";

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
    });

    const raw = completion.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) return NextResponse.json({ error: "Empty AI response" }, { status: 500 });

    let parsed: { summary?: string; bullets?: unknown; quizQuestions?: unknown; keyTerms?: unknown };
    try {
      parsed = JSON.parse(raw) as { summary?: string; bullets?: unknown; quizQuestions?: unknown; keyTerms?: unknown };
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const toArr = (v: unknown, max = 8) =>
      Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, max) : [];

    const summary = typeof parsed.summary === "string" ? parsed.summary : "";
    if (!summary) return NextResponse.json({ error: "No summary generated" }, { status: 500 });

    if (!isPremium) {
      await supabase.from("profiles").update({ ai_usage_count: currentUsage + 1 }).eq("id", userId);
    }

    return NextResponse.json({
      summary,
      bullets: toArr(parsed.bullets),
      quizQuestions: toArr(parsed.quizQuestions, 5),
      keyTerms: toArr(parsed.keyTerms),
      xpReward: mode === "quiz" ? 14 : 10,
      remaining: isPremium ? null : Math.max(0, FREE_LIMIT - (currentUsage + 1)),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI notes generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
