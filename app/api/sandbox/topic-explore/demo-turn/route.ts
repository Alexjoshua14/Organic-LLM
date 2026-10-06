/**
 * Noesis admin **demo-turn** route — one streamed spark reply, fully isolated.
 *
 * Unlike `/api/chat`, this does NO persistence, memory writes, tool calls, or title
 * generation. It exists purely to trial a spark's (possibly edited) system prompt in
 * the demo overlay, so demo runs never pollute real chat history. Token usage is
 * attached as message metadata (`totalTokens`) for the overlay's live budget counter
 * and recorded via `recordLlmCall` for server metrics.
 */
import { randomUUID } from "crypto";

import { convertToModelMessages, smoothStream, streamText, type UIMessage } from "ai";
import z from "zod";

import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";
import { GENERIC_SERVER_ERROR, logRouteError } from "@/lib/api/client-safe-error";
import { TOPIC_EXPLORE_PROVIDER_OPTIONS } from "@/lib/sandbox/topic-explore-llm";
import { recordLlmCall } from "@/lib/llm/metrics";
import {
  DEMO_DEFAULT_MODEL,
  DEMO_MAX_OUTPUT_TOKENS_PER_TURN,
} from "@/lib/sandbox/noesis/demo/config";
import { createLogger } from "@/lib/logger";

export const maxDuration = 30;

const logger = createLogger("app/api/sandbox/topic-explore/demo-turn/route.ts");

const BodySchema = z.object({
  /** Full running transcript (UIMessages). No server-side history for demos. */
  messages: z.array(z.any()).min(1).max(50),
  /** The spark system prompt under test (possibly edited in the UI). */
  systemPrompt: z.string().min(1).max(8000),
  /** Optional model override (defaults to the ultracheap demo model). */
  model: z.string().optional(),
});

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: Request) {
  const gate = await requireLlmChatActor();

  if (gate.error != null) return gate.error;
  const { sbUserId } = gate.data!;

  let json: unknown;

  try {
    json = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  const parsed = BodySchema.safeParse(json);

  if (!parsed.success) return badRequest("Invalid body");

  const { systemPrompt } = parsed.data;
  const rawMessages = parsed.data.messages as UIMessage[];
  const model = parsed.data.model || DEMO_DEFAULT_MODEL;
  const messages = convertToModelMessages(rawMessages);

  const t0 = performance.now();
  const result = streamText({
    model,
    system: systemPrompt,
    messages,
    experimental_transform: smoothStream({ delayInMs: 15, chunking: "word" }),
    maxOutputTokens: DEMO_MAX_OUTPUT_TOKENS_PER_TURN,
    providerOptions: TOPIC_EXPLORE_PROVIDER_OPTIONS,
    onError({ error }) {
      logger.error("POST", error instanceof Error ? error.message : String(error));
    },
    onFinish({ usage }) {
      recordLlmCall({
        model,
        usage,
        durationMs: performance.now() - t0,
        metadata: { operation: "noesisDemoTurn", contextId: sbUserId },
      });
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: rawMessages,
    generateMessageId: () => randomUUID(),
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return { totalTokens: part.totalUsage?.totalTokens ?? undefined };
      }
    },
    onError: (error) => {
      logRouteError(logger, "POST", error);

      return GENERIC_SERVER_ERROR;
    },
  });
}
