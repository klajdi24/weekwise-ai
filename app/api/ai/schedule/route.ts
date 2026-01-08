import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export async function POST(req: NextRequest) {
  try {
    // ✅ Do NOT initialize OpenAI at module scope (prevents build crashes)
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

    return NextResponse.json({
      events: cleanedEvents,
      explanation:
        parsed.explanation ||
        "This schedule balances your workload and adds study time ahead of deadlines to reduce stress.",
    });
  } catch (err: any) {
    console.error("AI schedule error:", err);
    // ✅ Pass through a useful error message if OpenAI returns 429, etc.
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI schedule" },
      { status: 500 }
    );
  }
}










