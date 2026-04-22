import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import z from "zod";

import { generateStrataElaboratedSpeechSummaryScript } from "@/lib/llm/strata-elaborated-speech-summary";
import { createLogger } from "@/lib/logger";
import { markdownToTtsPlainText } from "@/lib/strata/elaborated-tts";

export const maxDuration = 60;

const logger = createLogger("app/api/prototypes/strata/elaborated-speech-summary/route.ts");

const BodySchema = z.object({
  elaboratedMarkdown: z.string(),
  pageId: z.string().min(1).optional(),
  /** When `eleven_v3`, the script may include ElevenLabs v3 square-bracket audio tags for pacing. */
  ttsModel: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const user = await auth();
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const elaboratedPlain = markdownToTtsPlainText(parsed.data.elaboratedMarkdown);
  if (!elaboratedPlain) {
    return NextResponse.json({ error: "Elaborated section is empty" }, { status: 400 });
  }

  const result = await generateStrataElaboratedSpeechSummaryScript({
    elaboratedPlain,
    contextId: parsed.data.pageId,
    ttsModelId: parsed.data.ttsModel,
  });

  if (result.error || result.data == null) {
    const message = result.error?.message ?? "Failed to generate speech script";
    logger.error("POST", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ script: result.data });
}
