// file: /app/api/ai/schedule/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { events } = await req.json();

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "No events provided" }, { status: 400 });
    }

    const prompt = `
You are a friendly AI assistant for a university student.
The student has these events:
${JSON.stringify(events, null, 2)}

Generate a weekly schedule that:
- Includes all lectures and assignments
- Adds study sessions before assignments
- Suggests reasonable times (morning, afternoon, evening)
- Avoids overlapping events
- Returns JSON ONLY: array of objects {id:number, title:string, type:"Lecture"|"Assignment"|"Study", day:"Monday"-"Sunday", startHour:0-23, duration:number of hours}
- Validate that JSON is valid and complete.
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    const aiResponse = completion.choices[0].message?.content;

    let aiEvents = [];
    try {
      aiEvents = JSON.parse(aiResponse || "[]");
    } catch (err) {
      console.error("Failed to parse AI response:", aiResponse);
      return NextResponse.json({ error: "AI returned invalid schedule" }, { status: 500 });
    }

    return NextResponse.json({ events: aiEvents });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate AI schedule" }, { status: 500 });
  }
}

