import { readFileSync } from "fs";
import path from "path";

import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  validateUIMessages,
  TypeValidationError,
  createIdGenerator,
} from "ai";

// import systemPrompt from "@/lib/system-prompt";
import { loadChat, saveChat } from "@/lib/chat/chat-store";
import { ensureChatHasTitle } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  const systemPrompt = readFileSync(
    path.join(process.cwd(), "lib/system-prompt/", "prompt-v0.txt"),
    "utf-8",
  );

  logger.log("POST", `Recieved Message: ${JSON.stringify(message)}`);

  let validatedMessages: UIMessage[];

  try {
    const previousMessages = await loadChat(id).then(
      (res) => res.data?.messages ?? [],
    );

    validatedMessages = await validateUIMessages({
      messages: [...previousMessages, message],
      tools,
    });
  } catch (err) {
    if (err instanceof TypeValidationError) {
      logger.error(
        "POST",
        `Database messages validation failed: ${err.message}`,
      );
      validatedMessages = [];
    } else {
      throw err;
    }
  }

  const result = streamText({
    model: openai("gpt-5-nano"),
    messages: convertToModelMessages(validatedMessages),
    system: systemPrompt,
  });

  logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onFinish: ({ messages }) => {
      saveChat({ chatId: id, messages });
      if (messages.length > 3 && messages.length < 5) {
        ensureChatHasTitle(id);
      }
    },
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
  });
}
