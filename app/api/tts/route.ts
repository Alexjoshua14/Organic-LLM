import { openai } from "@ai-sdk/openai";
import { experimental_generateSpeech as generateSpeech } from "ai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const { audio } = await generateSpeech({
    model: openai.speech("gpt-4o-mini-tts"),
    text,
    voice: "nova",
  });

  console.log(audio);

  return NextResponse.json({ data: audio });
}
