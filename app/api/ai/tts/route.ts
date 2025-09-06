import { openai } from "@ai-sdk/openai";
import { experimental_generateSpeech as generateSpeech } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { transformTextToSpeechFriendly } from "@/lib/llm/text-to-speech";

const logger = createLogger("app/api/tts/route.ts");

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  let speechFriendlyText = text;

  try {
    speechFriendlyText = await transformTextToSpeechFriendly(text);
    logger.log("TTS Route", `Speech-friendly text: ${speechFriendlyText}`);
  } catch (error) {
    logger.error("TTS Route", `Error transforming text: ${error}`);
  }

  const { audio } = await generateSpeech({
    model: openai.speech("gpt-4o-mini-tts"),
    text: speechFriendlyText,
    voice: "nova",
  });

  logger.log("POST", "Generated audio:", audio);

  return NextResponse.json({ data: audio });
}
