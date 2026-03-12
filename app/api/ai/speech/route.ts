import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { auth } from "@clerk/nextjs/server";

import { getSupabaseUserId } from "@/data/supabase/profiles";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { createLogger } from "@/lib/logger";
import { recordLlmCall } from "@/lib/llm/metrics";

// Allow responses up to 30 seconds
export const maxDuration = 30;

const logger = createLogger(`app/api/speech/route.ts`);

// Speech-friendly system prompt that encourages natural, conversational responses
const speechSystemPrompt = `You are a helpful AI assistant optimized for text-to-speech output. Your responses should be:

- Natural and conversational, as if speaking to someone directly
- Free of special characters, symbols, or formatting that don't translate well to speech
- Clear and well-paced with natural pauses (use commas and periods appropriately)
- Avoid acronyms unless commonly spoken (say "artificial intelligence" not "A.I.")
- Use contractions naturally (you're, it's, don't) to sound more conversational
- Keep sentences at a reasonable length for natural speech rhythm
- Avoid parenthetical asides or complex nested clauses
- When mentioning numbers, spell them out in a speech-friendly way
- Use "and" instead of "&" and spell out other symbols
- Be engaging and warm in tone, as if having a friendly conversation

Remember: someone will be listening to your response, not reading it. Make it sound natural and pleasant to hear.`;

export async function POST(req: Request) {
  try {
    const { message }: { message: string } = await req.json();

    logger.log("POST", `Received message for speech generation, length: ${message?.length ?? 0}`);

    if (
      !message ||
      typeof message !== "string" ||
      message.trim().length === 0
    ) {
      return Response.json(
        { error: "Message is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const clerkUser = await auth();
    if (!clerkUser?.userId) {
      return new Response("Unauthorized", { status: 401 });
    }
    const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
    if (sbUserIdResult.error || sbUserIdResult.data === null) {
      return new Response("User not found in supabase", { status: 404 });
    }
    const sbUserId = sbUserIdResult.data;

    const messageLimitResult = await checkLlmMessageLimit(sbUserId);
    if (!messageLimitResult.success) {
      return Response.json(
        { error: messageLimitResult.error ?? "Too many requests" },
        { status: 429 },
      );
    }

    const start = performance.now();
    const result = await generateText({
      model: openai("gpt-4o-mini"), // Using a faster model for speech generation
      messages: [
        {
          role: "system",
          content: speechSystemPrompt,
        },
        {
          role: "user",
          content: message,
        },
      ],
      maxOutputTokens: 500, // Reasonable limit for speech responses
      temperature: 0.7, // Slightly creative but consistent
    });
    const durationMs = performance.now() - start;

    recordLlmCall({
      model: "gpt-4o-mini",
      usage: result.usage,
      durationMs,
      metadata: { operation: "speech-route", route: "/api/ai/speech" },
    });

    logger.log(
      "POST",
      `Generated speech-friendly response: ${result.text.substring(0, 100)}...`,
    );

    return Response.json({
      text: result.text,
      usage: result.usage,
      finishReason: result.finishReason,
    });
  } catch (error) {
    logger.error("POST", `Error generating speech response: ${error}`);

    return Response.json(
      { error: "Failed to generate speech-friendly response" },
      { status: 500 },
    );
  }
}
