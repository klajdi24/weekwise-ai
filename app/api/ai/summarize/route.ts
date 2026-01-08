import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ✅ IMPORTANT: use THIS exact path
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

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

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const pdfData = await pdfParse(buffer);
    const text = pdfData.text || "No text found in PDF";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Summarize the following lecture notes." },
        { role: "user", content: text },
      ],
      temperature: 0.4,
    });

    return NextResponse.json({
      summary: response.choices?.[0]?.message?.content || "",
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Failed to summarize PDF" },
      { status: 500 }
    );
  }
}



















