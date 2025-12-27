import { openai } from "@ai-sdk/openai";
import { experimental_generateSpeech as generateSpeech, SpeechModel } from "ai";
import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { createLogger } from "@/lib/logger";
import { transformTextToSpeechFriendlyV2 } from "@/lib/llm/text-to-speech";

const logger = createLogger("app/api/tts/route.ts");

// let availableSpeechModels: SpeechModel[] = [
//   openai.speech("gpt-4o-mini-tts"),
//   elevenlabs.speech("eleven_multilingual_v2"),
//   elevenlabs.speech("eleven_flash_v2_5"),
//   elevenlabs.speech("eleven_v3"),
// ];

const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

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
    return NextResponse.json(
      { error: "Text is required" },
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }

  const parametersObtained = performance.now();

  logger.log(
    "TTS Route",
    `Parameters obtained in ${parametersObtained - start} milliseconds`
  );

  const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  let speechFriendlyText = text;

  if (skipTransform === undefined || !skipTransform) {
    const speechFriendlyTextStartGeneration = performance.now();

    try {
      // speechFriendlyText = await transformTextToSpeechFriendly(text);
      speechFriendlyText = await transformTextToSpeechFriendlyV2(text);
      logger.log("TTS Route", `Speech-friendly text: ${speechFriendlyText}`);
    } catch (error) {
      logger.error("TTS Route", `Error transforming text: ${error}`);
    } finally {
      const speechFriendlyTextEndGeneration = performance.now();

      logger.log(
        "TTS Route",
        `Speech-friendly text generation completed in ${speechFriendlyTextEndGeneration - speechFriendlyTextStartGeneration} milliseconds`
      );
    }
  }

  // let speechModel: SpeechModel = ;

  // if (!model || typeof model !== "string") {
  //   speechModel = availableSpeechModels[0];
  // } else {
  //   try {
  //     speechModel = availableSpeechModels.find(
  //       (m) => m.modelId === model
  //     ) as SpeechModel;
  //   } catch (error) {
  //     logger.error("TTS Route", `Error finding model: ${error}`);
  //     speechModel = availableSpeechModels[0];
  //   }
  // }

  // logger.log(
  //   "TTS Route",
  //   `Using model: ${speechModel.modelId}, from provider: ${speechModel.provider}`
  // );

  const speechModelStartGeneration = performance.now();

  try {
    const readable = new ReadableStream({
      async start(controller) {
        try {
          const audioStream =
            await elevenlabs.textToSpeech.streamWithTimestamps(VOICE_ID, {
              modelId: "eleven_multilingual_v2",
              text: speechFriendlyText,
              outputFormat: "mp3_44100_128",
              voiceSettings: {
                stability: 0,
                similarityBoost: 1.0,
                useSpeakerBoost: true,
                speed: 1.0,
              },
            });

          const encoder = new TextEncoder();

          for await (const chunk of audioStream) {
            const jsonLine = JSON.stringify(chunk) + "\n";
            controller.enqueue(encoder.encode(jsonLine));
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } finally {
    const speechModelEndGeneration = performance.now();

    logger.log(
      "TTS Route",
      `Speech model generation completed in ${speechModelEndGeneration - speechModelStartGeneration} milliseconds`
    );
  }
}
