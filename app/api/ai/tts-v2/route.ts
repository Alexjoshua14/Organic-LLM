import { createHash } from "crypto";

import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

import { createLogger } from "@/lib/logger";
import { transformTextToSpeechFriendlyV2 } from "@/lib/llm/text-to-speech";
import { stripSpeechTags } from "@/lib/tts/speech-tags";
import { createTtsV2AudioCache } from "@/lib/tts/tts-v2-audio-cache";
import type { TTSModel } from "@/lib/tts/token-calculator";

const logger = createLogger("app/api/ai/tts-v2/route.ts");

// let availableSpeechModels: SpeechModel[] = [
//   openai.speech("gpt-4o-mini-tts"),
//   elevenlabs.speech("eleven_multilingual_v2"),
//   elevenlabs.speech("eleven_flash_v2_5"),
//   elevenlabs.speech("eleven_v3"),
// ];

const VOICE_ID = "19STyYD15bswVz51nqLf";
const MODEL_ID = "eleven_v3" satisfies TTSModel;

// In-memory LRU cache for TTS NDJSON streams (per server instance, max 128 entries).
const TTS_AUDIO_CACHE_MAX_ENTRIES = 128;
const CACHE_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const CACHE_MAX_AGE_SEC = Math.floor(CACHE_TTL / 1000);
const audioCache = createTtsV2AudioCache(TTS_AUDIO_CACHE_MAX_ENTRIES, CACHE_TTL);

// Generate cache key from text and options
function getCacheKey(text: string, skipTransform: boolean): string {
  const key = `${text}:${skipTransform ? "raw" : "processed"}:${MODEL_ID}:${VOICE_ID}`;

  return createHash("sha256").update(key).digest("hex");
}

// Helper to replay cached stream
function createCachedStream(cachedData: string): ReadableStream {
  const encoder = new TextEncoder();
  const lines = cachedData
    .trim()
    .split("\n")
    .filter((line) => line.trim());

  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(line + "\n"));
      }
      controller.close();
    },
  });
}

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

  logger.log("TTS Route", `Parameters obtained in ${parametersObtained - start} milliseconds`);

  const elevenlabs = new ElevenLabsClient({
    apiKey: process.env.ELEVENLABS_API_KEY,
  });

  let speechFriendlyText = text;

  if (skipTransform === undefined || !skipTransform) {
    const speechFriendlyTextStartGeneration = performance.now();

    try {
      // speechFriendlyText = await transformTextToSpeechFriendly(text);
      speechFriendlyText = await transformTextToSpeechFriendlyV2(text);
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

  const textForTTS = stripSpeechTags(speechFriendlyText);

  // Generate cache key based on final speech-friendly text (after stripping tags)
  const cacheKey = getCacheKey(textForTTS, skipTransform ?? false);

  // Check cache first (TTL + LRU touch handled inside helper)
  const cached = audioCache.get(cacheKey);

  if (cached) {
    logger.log("TTS Route", "Returning cached audio stream");

    return new Response(createCachedStream(cached.streamData), {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-control": `public, max-age=${CACHE_MAX_AGE_SEC}`,
        Connection: "keep-alive",
      },
    });
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
    // Collect all chunks for caching
    const streamChunks: string[] = [];

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const audioStream = await elevenlabs.textToSpeech.streamWithTimestamps(VOICE_ID, {
            modelId: MODEL_ID,
            text: textForTTS,
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

            streamChunks.push(jsonLine);
            controller.enqueue(encoder.encode(jsonLine));
          }

          // Cache the complete stream after collection
          const completeStream = streamChunks.join("");

          audioCache.set(cacheKey, {
            streamData: completeStream,
            timestamp: Date.now(),
          });

          // --- TEST FIXTURE LOG ---
          // Copy the JSON below into tests/fixtures/elevenlabs-stream-response.json
          // to use real ElevenLabs data in the test suite.
          if (process.env.LOG_TTS_FIXTURE === "1") {
            const fixtureChunks = streamChunks.map((line) => JSON.parse(line.trim()));

            logger.log(
              "TTS_FIXTURE",
              `\n--- START ELEVENLABS STREAM FIXTURE (${fixtureChunks.length} chunks) ---\n` +
                JSON.stringify(
                  {
                    _meta: {
                      text: textForTTS,
                      model: MODEL_ID,
                      voiceId: VOICE_ID,
                      chunkCount: fixtureChunks.length,
                      capturedAt: new Date().toISOString(),
                    },
                    chunks: fixtureChunks,
                  },
                  null,
                  2
                ) +
                `\n--- END ELEVENLABS STREAM FIXTURE ---\n`
            );
          }

          controller.close();
        } catch (err) {
          controller.error(err);
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
