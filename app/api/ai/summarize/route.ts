import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// ✅ IMPORTANT: use THIS exact path
const pdfParse = require("pdf-parse/lib/pdf-parse.js");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // ✅ This now works
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text || "No text found in PDF";

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "Summarize the following lecture notes." },
        { role: "user", content: text },
      ],
    });

    return NextResponse.json({
      summary: response.choices[0].message?.content || "",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to summarize PDF" },
      { status: 500 }
    );
  }
}


















