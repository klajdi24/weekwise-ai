// app/api/ai/schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createAuthedSupabaseClient } from "@/lib/serverSupabase";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const FREE_LIMIT = 3;

function getBearerToken(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match?.[1] || null;
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Require auth
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized: missing session token" }, { status: 401 });
    }

    const supabase = createAuthedSupabaseClient(token);

    // ✅ Validate token + get user
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userRes?.user) {
      return NextResponse.json({ error: "Unauthorized: invalid session" }, { status: 401 });
    }
    const user = userRes.user;

    // ✅ Premium + usage check (server-side)
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("is_premium, ai_usage_count")
      .eq("id", user.id)
      .single();

    if (profileErr) {
      return NextResponse.json({ error: "Failed to load profile" }, { status: 500 });
    }

    const isPremium = !!profile?.is_premium;
    const usage = Number(profile?.ai_usage_count ?? 0);

    if (!isPremium && usage >= FREE_LIMIT) {
      return NextResponse.json(
        { error: "Free AI uses exhausted. Upgrade to Premium for unlimited scheduling." },
        { status: 402 }
      );
    }

    // ✅ OpenAI key check
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is temporarily unavailable (missing OpenAI API key)." },
        { status: 503 }
      );
    }
    const openai = new OpenAI({ apiKey });

    const { events } = await req.json();
    if (!Array.isArray(events)) {
      return NextResponse.json({ error: "Invalid events input" }, { status: 400 });
    }

    const prompt = `
You are a scheduling assistant for a university student.

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ error: "Empty AI response" }, { status: 500 });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("AI JSON parse error:", raw, err);
      return NextResponse.json({ error: "AI returned invalid JSON" }, { status: 500 });
    }

    const cleanedEvents = Array.isArray(parsed.events)
      ? parsed.events.filter(
          (e: any) =>
            typeof e.title === "string" &&
            ["Lecture", "Assignment", "Study"].includes(e.type) &&
            DAYS.includes(e.day) &&
            Number.isInteger(e.start_hour) &&
            e.start_hour >= 0 &&
            e.start_hour <= 23 &&
            Number.isFinite(e.duration) &&
            e.duration > 0
        )
      : [];

    // ✅ Increment usage after successful call (free users only)
    if (!isPremium) {
      await supabase
        .from("profiles")
        .update({ ai_usage_count: usage + 1 })
        .eq("id", user.id);
    }

    return NextResponse.json({
      events: cleanedEvents,
      explanation:
        parsed.explanation ||
        "This schedule balances your workload and adds study time ahead of deadlines to reduce stress.",
    });
  } catch (err: any) {
    console.error("AI schedule error:", err);
    return NextResponse.json({ error: err?.message || "Failed to generate AI schedule" }, { status: 500 });
  }
}











