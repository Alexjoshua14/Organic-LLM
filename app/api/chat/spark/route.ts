import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  validateUIMessages,
  TypeValidationError,
  createIdGenerator,
  smoothStream,
} from "ai";
import {
  extractOpsEnvelopeFromText,
  stripOpsFence,
  applyOps,
} from "@/lib/llm/organicStateProtocol";
import { getState, saveState } from "@/lib/supabase/organicStateStore";

// import systemPrompt from "@/lib/system-prompt";
import {
  getContextAndMessagesChatPrompt,
  loadChat,
  saveChat,
} from "@/lib/chat/chat-store";
import { ensureChatHasTitle, updateChatSummary } from "@/lib/llm/chat-helpers";
import { createLogger } from "@/lib/logger";
// import SYSTEM_PROMPT from "@/lib/system-prompt";
import SYSTEM_PROMPT from "@/lib/system-prompt";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const tools = {};

const logger = createLogger(`app/api/chat/route.ts`);

let systemPrompt = SYSTEM_PROMPT;

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  logger.log("POST", `Recieved Message. Processing now...`);

  let validatedMessages: UIMessage[];

  try {
    const chatContextResult = await getContextAndMessagesChatPrompt(
      id,
      10,
      "spark" as const
    );

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
    } else {
      throw err;
    }
  }

  logger.log(
    "POST",
    `
    System Prompt: ${systemPrompt.length} characters
    System Prompt: ${systemPrompt}
    \n\n--------------------------------\n\n
    ${validatedMessages.length} messages being sent to LLM
    `
  );

  logger.log("POST", `Sending messages to LLM...`);
  const start = performance.now();

  const result = streamText({
    model: openai("gpt-5-mini"),
    messages: convertToModelMessages(validatedMessages),
    system: systemPrompt,
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
      if (lastMessage.role === "assistant") {
        // Convert the message content to string - UIMessage content can be string or array
        const assistantText = JSON.stringify(lastMessage);
        logger.log(
          "POST",
          `Processing message for ops: ${assistantText.substring(0, 200)}...`
        );

        const startOps = performance.now();

        const env = extractOpsEnvelopeFromText(assistantText);
        if (env) {
          logger.log("POST", `Extracted ops envelope: ${JSON.stringify(env)}`);
          const current = await getState(id);
          const next = await applyOps(current, env);
          await saveState(id, next);
        }
        const endOps = performance.now();
        logger.log(
          "POST",
          `Ops processed in ${endOps - startOps} milliseconds`
        );

        console.log("--------------------------------");
        console.log("ASSISTANT_RAW_START");
        console.log(assistantText);
        console.log("ASSISTANT_RAW_END");
        console.log("OPS_ENV_EXTRACTED:", JSON.stringify(env, null, 2));
        console.log("--------------------------------");

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
