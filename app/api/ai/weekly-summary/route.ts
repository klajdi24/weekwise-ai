import { NextResponse } from "next/server";
import OpenAI from "openai";

interface WeeklyEvent {
  day: string;
  start_hour: number;
  duration: number;
  title: string;
  type: string;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "AI is temporarily unavailable (missing OpenAI API key)." },
        { status: 503 }
      );
    }

    const openai = new OpenAI({ apiKey });

    const body = (await req.json()) as { events?: WeeklyEvent[] };
    const events = Array.isArray(body.events) ? body.events : [];

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

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
    });

    return NextResponse.json({
      summary: completion.choices?.[0]?.message?.content || "",
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "AI summary failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
