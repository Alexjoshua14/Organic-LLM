import { randomUUID } from "crypto";
import { auth } from "@clerk/nextjs/server";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  convertToModelMessages,
  UIMessage,
} from "ai";
import { openai } from "@ai-sdk/openai";

import { loadChat, saveChat } from "@/lib/chat/chat-store";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { createLogger } from "@/lib/logger";
import { parseWineCount, extractWines } from "@/lib/llm/sommelier";

export const maxDuration = 30;

const logger = createLogger("app/api/prototypes/wine-line-list/route.ts");

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .map((p) => (p.type === "text" ? (p as { text: string }).text : ""))
    .join("")
    .trim();
}

export async function POST(req: Request) {
  const body = await req.json();
  const { message: incomingMessage, id } = body as { message: UIMessage; id: string };

  const message = incomingMessage as UIMessage;
  if (!message?.parts?.length || !id) {
    return new Response(
      JSON.stringify({ error: "Missing message or thread id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
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

  const messageLimitResult = await checkLlmMessageLimit(sbUserIdResult.data);
  if (!messageLimitResult.success) {
    return new Response(
      JSON.stringify({ error: messageLimitResult.error ?? "Too many requests" }),
      { status: 429, headers: { "Content-Type": "application/json" } },
    );
  }

  const loadResult = await loadChat(id);
  const existingMessages: UIMessage[] =
    loadResult.data?.messages ?? [];
  const validatedMessages: UIMessage[] = [...existingMessages, message];

  saveChat({ chatId: id, messages: validatedMessages }).catch((err) => {
    logger.error("POST", `Failed to save user message: ${err}`);
  });

  const assistantMessageId = randomUUID();
  const userText = getTextFromMessage(message);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({
        type: "data-aiAction",
        data: { action: "processing", message: "Heard you, generating..." },
        transient: true,
      });

      let count = 1;
      try {
        count = await parseWineCount(userText);
      } catch {
        count = 1;
      }

      const wines = await extractWines(userText, count);
      writer.write({
        type: "data-wineLineList",
        data: { wines },
      });

      const result = streamText({
        model: openai("gpt-4o-mini"),
        messages: convertToModelMessages(validatedMessages),
        system: "Reply with only: Here are the suggestions.",
        maxOutputTokens: 20,
        onError({ error }) {
          logger.error("POST", `Stream error: ${error}`);
        },
      });

      writer.merge(
        result.toUIMessageStream({
          generateMessageId: () => assistantMessageId,
          onFinish: async ({ messages }) => {
            try {
              await saveChat({ chatId: id, messages });
            } catch (err) {
              logger.error("POST", `Error saving chat: ${err}`);
            }
          },
        }),
      );
    },
  });

  return createUIMessageStreamResponse({ stream });
}
