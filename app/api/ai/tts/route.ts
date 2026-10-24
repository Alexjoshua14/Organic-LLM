import { openai } from "@ai-sdk/openai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { generateSpeech as generateSpeech } from "ai";
import { NextRequest, NextResponse } from "next/server";

import { requireTtsActor } from "@/lib/api/tts-gate";
import { createLogger } from "@/lib/logger";
import { isElevenLabsV3SpeechModelId } from "@/lib/tts/elevenlabs-v3-speech";
import { stripSpeechTags } from "@/lib/tts/speech-tags";

const logger = createLogger("app/api/tts/route.ts");

const availableSpeechModels = [
  openai.speech("gpt-4o-mini-tts"),
  elevenlabs.speech("eleven_multilingual_v2"),
  elevenlabs.speech("eleven_flash_v2_5"),
  elevenlabs.speech("eleven_v3"),
];

const DEFAULT_ELEVENLABS_VOICE_ID = "19STyYD15bswVz51nqLf";

export async function POST(req: NextRequest) {
  const start = performance.now();
  const {
    text,
    model,
    voiceId,
    skipTransform,
    timestamps,
  }: {
    text: string;
    model?: string;
    voiceId?: string;
    skipTransform?: boolean;
    timestamps?: "word";
  } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const resolvedModel =
    model && typeof model === "string"
      ? (availableSpeechModels.find((m) => m.modelId === model) ?? null)
      : null;
  const speechModel = resolvedModel ?? availableSpeechModels[0]!;

  if (speechModel.provider === "elevenlabs.speech" && !process.env.ELEVENLABS_API_KEY?.trim()) {
    return NextResponse.json(
      {
        error:
          "ELEVENLABS_API_KEY is not configured. Add your ElevenLabs API key to synthesize audio.",
      },
      { status: 503 }
    );
  }

  const ttsGate = await requireTtsActor(text.length);

  if (ttsGate.error != null) {
    return ttsGate.error;
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

  const resolvedElevenLabsVoice =
    typeof voiceId === "string" && voiceId.trim().length > 0 && voiceId.trim() !== "default"
      ? voiceId.trim()
      : DEFAULT_ELEVENLABS_VOICE_ID;

  try {
    if (speechModel.provider === "elevenlabs.speech") {
      const { audio } = await generateSpeech({
        model: speechModel,
        text: textForTTS,
        voice: resolvedElevenLabsVoice,
      });

      return NextResponse.json({ data: audio });
    } else {
      const { audio } = await generateSpeech({
        model: speechModel,
        text: textForTTS,
        voice: "marin",
      });

      return NextResponse.json({ data: audio });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate speech";

    logger.error("TTS Route", `Error generating speech: ${message}`);

    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    const speechModelEndGeneration = performance.now();

    logger.log(
      "TTS Route",
      `Speech model generation completed in ${speechModelEndGeneration - speechModelStartGeneration} milliseconds`
    );
  }
}
