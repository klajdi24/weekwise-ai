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
    // ✅ Avoid module-scope OpenAI init to prevent build-time crashes
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
You are an AI assistant that suggests additional events (lectures, assignments, or study sessions) to help a university student manage their week.

INPUT EVENTS:
${JSON.stringify(events, null, 2)}

RULES:
- Suggest up to 3 new events
- Keep existing events unchanged
- Use realistic hours (8–21)
- Include a short description of why the suggestion is helpful

OUTPUT JSON ONLY in this format:
{
  "suggestions": [
    {
      "title": string,
      "type": "Lecture" | "Assignment" | "Study",
      "day": "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      "start_hour": number,
      "duration": number,
      "description": string
    }
  ]
}
No markdown, no extra text.
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

    const cleanedSuggestions = Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter(
          (s: any) =>
            typeof s.title === "string" &&
            ["Lecture", "Assignment", "Study"].includes(s.type) &&
            DAYS.includes(s.day) &&
            Number.isInteger(s.start_hour) &&
            s.start_hour >= 0 &&
            s.start_hour <= 23 &&
            Number.isFinite(s.duration) &&
            s.duration > 0 &&
            typeof s.description === "string"
        )
      : [];

    return NextResponse.json({ suggestions: cleanedSuggestions });
  } catch (err: any) {
    console.error("AI suggest error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to generate AI suggestions" },
      { status: 500 }
    );
  }
}



