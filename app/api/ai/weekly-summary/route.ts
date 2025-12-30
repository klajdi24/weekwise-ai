import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { events } = await req.json();

    const prompt = `
You are a productivity coach.

Here is a user's weekly schedule:
${events
  .map(
    (e: any) =>
      `${e.day} at ${e.start_hour}:00 for ${e.duration}h - ${e.title} (${e.type})`
  )
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
      summary: completion.choices[0].message.content,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "AI summary failed" },
      { status: 500 }
    );
  }
}
