import { NextRequest, NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { transformTextToSpeechFriendlyV2 } from "@/lib/llm/text-to-speech";

const logger = createLogger("app/api/tts/transform/route.ts");

/**
 * POST /api/ai/tts/transform
 *
 * Transforms text to be speech-friendly without generating audio.
 * This allows users to preview and edit the transformation before
 * committing to expensive TTS generation.
 */
export async function POST(req: NextRequest) {
  const start = performance.now();

  const { text }: { text: string } = await req.json();

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  const parametersObtained = performance.now();

  logger.log(
    "Transform Route",
    `Parameters obtained in ${parametersObtained - start} milliseconds`
  );

  try {
    const transformStart = performance.now();
    const transformedText = await transformTextToSpeechFriendlyV2(text);
    const transformEnd = performance.now();

    logger.log(
      "Transform Route",
      `Text transformation completed in ${transformEnd - transformStart} milliseconds`
    );

    return NextResponse.json({
      transformedText,
      originalLength: text.length,
      transformedLength: transformedText.length,
      processingTimeMs: Math.round(transformEnd - transformStart),
    });
  } catch (error) {
    logger.error("Transform Route", `Error transforming text: ${error}`);

    return NextResponse.json({ error: "Failed to transform text" }, { status: 500 });
  }
}
