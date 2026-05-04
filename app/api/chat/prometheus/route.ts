import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  createIdGenerator,
  LanguageModel,
  smoothStream,
} from "ai";

// import systemPrompt from "@/lib/system-prompt";
import { saveChat } from "@/lib/chat/chat-store";
import { GUARDRAIL_MAX_OUTPUT_TOKENS } from "@/lib/llm/helpers";
import { ensureChatHasTitle } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
import { getContext } from "@/lib/llm/context";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const model: LanguageModel = openai("gpt-5-mini");

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  logger.log(
    "POST",
    `Received message metadata: id=${message.id ?? "unknown"} role=${message.role} parts=${message.parts?.length ?? 0}`
  );

  const res = await getContext({ chatId: id, message, persona: "prometheus" });

  if (res.error) {
    logger.error("POST", `Error getting context: ${res.error}`);

    return new Response("Error getting context", { status: 500 });
  } else if (res.data === null) {
    logger.error("POST", `Error getting context: Context is null`);

    return new Response("Error getting context", { status: 500 });
  }

  const { prompt, messages } = res.data;

  const result = streamText({
    model: model,
    system: prompt,
    messages: convertToModelMessages(messages),
    maxOutputTokens: GUARDRAIL_MAX_OUTPUT_TOKENS,
    experimental_transform: smoothStream({
      delayInMs: 20, // optional: defaults to 10ms
      chunking: "word", // optional: defaults to 'word'
    }),
  });

  logger.log("POST", `Stream started, messageCount: ${messages.length}`);

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
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
