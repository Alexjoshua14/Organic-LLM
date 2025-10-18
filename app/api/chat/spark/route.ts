import { openai, OpenAIProvider } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  TypeValidationError,
  createIdGenerator,
  smoothStream,
} from "ai";

import {
  extractOpsEnvelopeFromText,
  applyOps,
} from "@/lib/llm/organicStateProtocol";
import { getState, saveState } from "@/lib/supabase/organicStateStore";

// import systemPrompt from "@/lib/system-prompt";
import {
  getContextAndMessagesChatPrompt,
  saveChat,
} from "@/lib/chat/chat-store";
import {
  ensureChatHasTitle,
  estimateTokenCount,
  updateChatSummary,
} from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
// import SYSTEM_PROMPT from "@/lib/system-prompt";
import SYSTEM_PROMPT from "@/lib/system-prompt";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Limits preprocessing time to stated amount,
const MAX_PREPOCESSING_TIME = 7_000;

// Brute force way to enable/disable extensive logging
const minimize_logging = true;

// const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

let systemPrompt = SYSTEM_PROMPT;
const model: Parameters<OpenAIProvider>[0] = "gpt-5";

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  logger.log("POST", `Recieved Message. Processing now...`);

  let validatedMessages: UIMessage[];

  const start_preprocessing_time = performance.now();

  try {
    const chatContextPromise = getContextAndMessagesChatPrompt(
      id,
      10,
      "spark" as const
    );

    const preprocess_limit = setTimeout(() => {
      throw new Error("Preprocessing time limit exceeded");
    }, MAX_PREPOCESSING_TIME);

    const chatContextResult = await chatContextPromise;

    clearTimeout(preprocess_limit);

    if (chatContextResult.error) {
      logger.error(
        "POST",
        `Error getting chat context: ${chatContextResult.error}`
      );
      validatedMessages = [message];
    } else {
      validatedMessages = [
        ...(chatContextResult.data?.messages ?? []),
        message,
      ];
      if (chatContextResult.data?.prompt) {
        systemPrompt = chatContextResult.data?.prompt;
      }
    }

    // const previousMessages = await loadChat(id).then(
    //   (res) => res.data?.messages ?? [],
    // );

    // validatedMessages = await validateUIMessages({
    //   messages: [...previousMessages, message],
    //   tools,
    // });
  } catch (err) {
    if (err instanceof TypeValidationError) {
      logger.error(
        "POST",
        `Database messages validation failed: ${err.message}`
      );
      validatedMessages = [message];
    } else if (
      err instanceof Error &&
      err.message === "Preprocessing time limit exceeded"
    ) {
      logger.error(
        "POST",
        `\n\n\nPreprocessing time limit exceeded: ${err.message}\n\n`
      );
      validatedMessages = [message];
    } else {
      throw err;
    }
  }

  const systemPromptTokens = await estimateTokenCount(systemPrompt);

  logger.log(
    "POST",
    `
    System Prompt: ${systemPrompt.length} characters\n`,
    `System Prompt ${systemPromptTokens} tokens\n`,
    minimize_logging ? "" : `System Prompt: ${systemPrompt}\n`,
    `\n\n--------------------------------\n\n`,
    `${validatedMessages.length} messages being sent to LLM`
  );

  const end_preprocessing_time = performance.now();
  logger.log(
    "POST",
    `Preprocessing time: ${end_preprocessing_time - start_preprocessing_time} milliseconds`
  );

  logger.log("POST", `Sending messages to LLM...`);
  const start = performance.now();

  const result = streamText({
    model: openai("gpt-5-mini"),
    messages: convertToModelMessages(validatedMessages),
    system: systemPrompt,
    tools: {
      web_search_preview: openai.tools.webSearchPreview({}),
    },
    experimental_transform: smoothStream({
      delayInMs: 20, // optional: defaults to 10ms
      chunking: "word", // optional: defaults to 'word'
    }),
  });

  const end = performance.now();

  logger.log(
    "POST",
    `Messages sent to LLM in ${end - start} milliseconds returning stream now...`
  );

  // logger.log("POST", `Result: ${JSON.stringify(result)}`);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    messageMetadata: ({ part }) => {
      switch (part.type) {
        case "start":
          return {
            createdAt: new Date().getTime(),
            model: model,
          };
        case "finish":
          logger.log(
            "POST",
            `Finish message: ${JSON.stringify(part, null, 2)}`
          );

          return {
            totalTokens: part.totalUsage?.totalTokens ?? undefined,
          };
      }
    },
    onFinish: async ({ messages }) => {
      await saveChat({ chatId: id, messages });
      if (messages.length > 3 && messages.length < 5) {
        ensureChatHasTitle(id);
      }
      await updateChatSummary(id);

      // Process organic state operations from the final assistant message
      const lastMessage = messages[messages.length - 1];
      const endStream = performance.now();

      logger.log(
        "POST",
        `Time from initial request recieved to stream complete: ${endStream - start} milliseconds`
      );

      /** Ensure this only run on AI messages */
      if (lastMessage.role === "assistant") {
        // Convert the message content to string - UIMessage content can be string or array
        const assistantText = lastMessage.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("");

        logger.log("POST", `Processing message for ops: ${assistantText}...`);

        const startOps = performance.now();

        const env = extractOpsEnvelopeFromText(assistantText);

        if (env) {
          logger.log(
            "POST",
            `Extracted ops envelope: ${JSON.stringify(env, null, 2)}`
          );
          const current = await getState(id);
          const next = await applyOps(current, env);

          await saveState(id, next);
        }
        const endOps = performance.now();

        logger.log(
          "POST",
          `Ops processed in ${endOps - startOps} milliseconds`
        );

        logger.log("POST", "--------------------------------");
        // logger.log("POST", "ASSISTANT_RAW_START");
        // logger.log("POST", JSON.stringify(assistantText, null, 2));
        // logger.log("POST", "ASSISTANT_RAW_END");
        logger.log(
          "POST",
          `OPS_ENV_EXTRACTED: ${JSON.stringify(env, null, 2)}`
        );
        logger.log("POST", "--------------------------------");

        logger.log(
          "POST",
          `Time from stream complete to ops processed: ${endOps - endStream} milliseconds`
        );
      }
      const endOnFinish = performance.now();

      logger.log(
        "POST",
        `Time from initial request recieved to stream's onFinish complete: ${endOnFinish - start} milliseconds`
      );
    },
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
  });
}
