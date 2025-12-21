import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { events } = await req.json();

    const prompt = `
You are an AI scheduling assistant for a university student.
The student has the following events in the week:
${JSON.stringify(events, null, 2)}

Generate a weekly schedule that:
- Includes all lectures and assignments
- Adds study sessions before assignments
- Suggests reasonable times (morning, afternoon, evening)
- Avoids overlapping events
- Returns the schedule as a JSON array of objects with keys: id, title, type, day, startHour, duration
`;

    const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: prompt }],
});


    const aiResponse = completion.choices[0].message?.content;

    let aiEvents = [];
    try {
      aiEvents = JSON.parse(aiResponse || "[]");
    } catch (err) {
      console.error("Failed to parse AI response:", aiResponse);
    }

    return NextResponse.json({ events: aiEvents });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to generate AI schedule" }, { status: 500 });
  }
}
