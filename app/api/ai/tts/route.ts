import { openai } from "@ai-sdk/openai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { experimental_generateSpeech as generateSpeech, SpeechModel } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { isElevenLabsV3SpeechModelId } from "@/lib/tts/elevenlabs-v3-speech";
import { stripSpeechTags } from "@/lib/tts/speech-tags";

const logger = createLogger("app/api/tts/route.ts");

let availableSpeechModels: SpeechModel[] = [
  openai.speech("gpt-4o-mini-tts"),
  elevenlabs.speech("eleven_multilingual_v2"),
  elevenlabs.speech("eleven_flash_v2_5"),
  elevenlabs.speech("eleven_v3"),
];

export async function POST(req: NextRequest) {
  const start = performance.now();
  const {
    text,
    model,
    skipTransform,
    timestamps,
  }: {
    text: string;
    model: string;
    skipTransform?: boolean;
    timestamps?: "word";
  } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const parametersObtained = performance.now();

  logger.log("TTS Route", `Parameters obtained in ${parametersObtained - start} milliseconds`);

  let speechFriendlyText = text;

  if (skipTransform === undefined || !skipTransform) {
    const speechFriendlyTextStartGeneration = performance.now();

    try {
      // speechFriendlyText = await transformTextToSpeechFriendly(text);
      // TODO: Uncomment this when ready
      // speechFriendlyText = await transformTextToSpeechFriendlyV2(text);
      logger.log("TTS Route", `Speech-friendly text length: ${speechFriendlyText?.length ?? 0}`);
    } catch (error) {
      const e = error instanceof Error ? error : new Error(String(error));

      logger.error("TTS Route", `Error transforming text: ${e.name}`);
    } finally {
      const speechFriendlyTextEndGeneration = performance.now();

      logger.log(
        "TTS Route",
        `Speech-friendly text generation completed in ${speechFriendlyTextEndGeneration - speechFriendlyTextStartGeneration} milliseconds`
      );
    }
  }

  const resolvedModel =
    model && typeof model === "string"
      ? (availableSpeechModels.find((m) => m.modelId === model) ?? null)
      : null;
  const speechModel: SpeechModel = resolvedModel ?? availableSpeechModels[0]!;

  logger.log(
    "TTS Route",
    `Using model: ${speechModel.modelId}, from provider: ${speechModel.provider}`
  );

  const speechModelStartGeneration = performance.now();

  /** Eleven v3 interprets inline `[tag]` audio cues; strip only angle-bracket tags (not SSML breaks for v3). */
  const textForTTS = stripSpeechTags(speechFriendlyText);

  if (isElevenLabsV3SpeechModelId(speechModel.modelId)) {
    logger.log("TTS Route", "Eleven v3: preserving square-bracket audio tags in input.");
  }

  try {
    if (speechModel.provider === "elevenlabs.speech") {
      const { audio } = await generateSpeech({
        model: speechModel,
        text: textForTTS,
        voice: "19STyYD15bswVz51nqLf",
      });

      return NextResponse.json({ data: audio });

      // Convert Uint8Array to array for JSON serialization
      // const audioData = Array.from(audio.uint8Array);
      // const mimeType = audio.format || "mpeg";

      // return NextResponse.json({ data: audio });
    } else {
      const { audio } = await generateSpeech({
        model: speechModel,
        text: textForTTS,
        voice: "marin",
      });

      return NextResponse.json({ data: audio });
    }
  } finally {
    const speechModelEndGeneration = performance.now();

    logger.log(
      "TTS Route",
      `Speech model generation completed in ${speechModelEndGeneration - speechModelStartGeneration} milliseconds`
    );
  }
}
