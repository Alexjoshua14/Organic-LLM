import { openai, OpenAIProvider } from "@ai-sdk/openai";
import { elevenlabs, ElevenLabsProvider } from "@ai-sdk/elevenlabs";
import { experimental_generateSpeech as generateSpeech, SpeechModel } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { transformTextToSpeechFriendly } from "@/lib/llm/text-to-speech";

const logger = createLogger("app/api/tts/route.ts");

let availableSpeechModels: SpeechModel[] = [
  openai.speech("gpt-4o-mini-tts"),
  elevenlabs.speech("eleven_multilingual_v2"),
  elevenlabs.speech("eleven_flash_v2_5"),
];

export async function POST(req: NextRequest) {
  const { text, model }: { text: string; model: string } = await req.json();

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

  let speechModel: SpeechModel = openai.speech("gpt-4o-mini-tts");

  if (!model || typeof model !== "string") {
    speechModel = availableSpeechModels[0];
  } else {
    try {
      speechModel = availableSpeechModels.find(
        (m) => m.modelId === model
      ) as SpeechModel;
    } catch (error) {
      logger.error("TTS Route", `Error finding model: ${error}`);
      speechModel = availableSpeechModels[0];
    }
  }

  logger.log(
    "TTS Route",
    `Using model: ${speechModel.modelId}, from provider: ${speechModel.provider}`
  );

  if (speechModel.provider === "elevenlabs.speech") {
    const { audio } = await generateSpeech({
      model: speechModel,
      text: speechFriendlyText,
      voice: "pFZP5JQG7iQjIQuC4Bku",
    });
    return NextResponse.json({ data: audio });
  } else {
    const { audio } = await generateSpeech({
      model: speechModel,
      text: speechFriendlyText,
      voice: "nova",
    });
    return NextResponse.json({ data: audio });
  }

  // const { audio } = await generateSpeech({
  //   model: speechModel,
  //   text: speechFriendlyText,
  //   voice: "nova",
  // });

  // logger.log("POST", "Generated audio:", audio);

  // return NextResponse.json({ data: audio });
}
