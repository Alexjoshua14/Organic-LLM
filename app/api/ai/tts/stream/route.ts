import { openai } from "@ai-sdk/openai";
import { elevenlabs } from "@ai-sdk/elevenlabs";
import { experimental_generateSpeech as generateSpeech, SpeechModel } from "ai";
import { NextRequest } from "next/server";

import { createLogger } from "@/lib/logger";

const logger = createLogger("app/api/tts/stream/route.ts");

function uint8ArrayToRecord(uint8Array: Uint8Array): Record<number, number> {
  const out: Record<number, number> = {};
  for (let i = 0; i < uint8Array.length; i++) {
    out[i] = uint8Array[i]!;
  }
  return out;
}

const availableSpeechModels: SpeechModel[] = [
  openai.speech("gpt-4o-mini-tts"),
  elevenlabs.speech("eleven_multilingual_v2"),
  elevenlabs.speech("eleven_flash_v2_5"),
  elevenlabs.speech("eleven_v3"),
];

/**
 * POST /api/ai/tts/stream
 * 
 * Generates TTS with server-sent events for progress updates.
 * Client receives progress events during generation.
 */
export async function POST(req: NextRequest) {
  const start = performance.now();
  
  const {
    text,
    model,
    segmentId,
    segmentIndex,
    totalSegments,
  }: {
    text: string;
    model: string;
    segmentId?: string;
    segmentIndex?: number;
    totalSegments?: number;
  } = await req.json();

  if (!text || typeof text !== "string") {
    return new Response(JSON.stringify({ error: "Text is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Find speech model
  let speechModel: SpeechModel;
  if (!model || typeof model !== "string") {
    speechModel = availableSpeechModels[0];
  } else {
    speechModel = availableSpeechModels.find((m) => m.modelId === model) || availableSpeechModels[0];
  }

  // Estimate generation time based on model and text length
  const charCount = text.length;
  const charsPerSecond = speechModel.modelId.includes("flash") ? 1200 : 
                         speechModel.modelId.includes("gpt") ? 800 : 400;
  const estimatedMs = Math.ceil((charCount / charsPerSecond) * 1000);

  // Create a streaming response with progress updates
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial progress
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "progress",
          progress: 0,
          stage: "starting",
          estimatedMs,
          segmentId,
          segmentIndex,
          totalSegments,
        })}\n\n`));

        // Start generation
        const generationStart = performance.now();
        
        // Send progress updates periodically
        const progressInterval = setInterval(() => {
          const elapsed = performance.now() - generationStart;
          const progress = Math.min((elapsed / estimatedMs) * 100, 95);
          
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: "progress",
            progress: Math.round(progress),
            stage: "generating",
            elapsedMs: Math.round(elapsed),
            estimatedMs,
            remainingMs: Math.max(0, Math.round(estimatedMs - elapsed)),
            segmentId,
          })}\n\n`));
        }, 500);

        // Generate audio
        let audio;
        try {
          if (speechModel.provider === "elevenlabs.speech") {
            const result = await generateSpeech({
              model: speechModel,
              text,
              voice: "pFZP5JQG7iQjIQuC4Bku",
            });
            audio = result.audio;
          } else {
            const result = await generateSpeech({
              model: speechModel,
              text,
              voice: "nova",
            });
            audio = result.audio;
          }
        } finally {
          clearInterval(progressInterval);
        }

        const generationEnd = performance.now();
        const actualDurationMs = Math.round(generationEnd - generationStart);

        // Send completion with audio data
        const audioData = uint8ArrayToRecord(audio.uint8Array);
        const audioAny = audio as unknown as {
          format?: string;
          mimeType?: string;
          mediaType?: string;
        };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "complete",
          progress: 100,
          stage: "complete",
          actualDurationMs,
          segmentId,
          audioData,
          format: audioAny.format || "mp3",
          mediaType: audioAny.mimeType || audioAny.mediaType || "audio/mpeg",
        })}\n\n`));

        logger.log(
          "TTS Stream",
          `Generation completed in ${actualDurationMs}ms (estimated: ${estimatedMs}ms)`
        );

        controller.close();
      } catch (error) {
        logger.error("TTS Stream", `Generation failed: ${error}`);
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Generation failed",
          segmentId,
        })}\n\n`));
        
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
