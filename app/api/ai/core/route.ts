import { randomUUID } from "crypto";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { getChatModel } from "@/lib/llm/helpers";
import { createLogger } from "@/lib/logger";
import { ChatRequestSchema, DEFAULT_CHAT_MODEL } from "@/lib/schemas/chat";
import { CHAT_MODEL } from "@/lib/llm/helpers";
import { openai } from "@ai-sdk/openai";
import { auth } from "@clerk/nextjs/server";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  smoothStream,
  consumeStream,
} from "ai";
import { Aion_SYSTEM_INSTRUCTION } from "@/lib/system-prompt/aion";
import { createCoreToolKit } from "@/lib/llm/core/coreToolKit";
// TODO: Make this stream resumable, using some external source to the client for tracking running job
import { createResumableStreamContext } from "resumable-stream";

const logger = createLogger("api/ai/core/route");

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const body = await req.json();

  logger.log("POST", `Received request body: ${JSON.stringify(body)}`);

  const parseResult = ChatRequestSchema.safeParse(body);
  // Grab the selectedModel from either the parsed request body or default to DEFAULT_CHAT_MODEL
  const requestedModel = parseResult.data?.model;
  const selectedModel = requestedModel
    ? getChatModel(requestedModel)
    : DEFAULT_CHAT_MODEL;

  const memoryEnabled = parseResult.data?.memory;

  logger.log(
    "POST",
    `Model selection - Requested: ${JSON.stringify(requestedModel) ?? "none"}, Using: ${JSON.stringify(selectedModel)}`
  );

  if (!parseResult.success) {
    logger.error(
      "POST",
      `Invalid request body: ${parseResult.error.flatten().formErrors.join(", ")}`
    );

    return new Response("Invalid request body", { status: 400 });
  }

  const { message: incomingMessage, id } = parseResult.data;
  const message = incomingMessage as UIMessage;

  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

  if (sbUserIdResult.error || sbUserIdResult.data === null) {
    return new Response("User not found in supabase", { status: 404 });
  }
  const sbUserId = sbUserIdResult.data;

  logger.log("POST", `Received Message: ${JSON.stringify(message)}`);

  // Format system prompt with current date
  const currentDateTime = new Date().toISOString();
  let systemPrompt = Aion_SYSTEM_INSTRUCTION.replace(
    "{{currentDateTime}}",
    currentDateTime
  )
    // Fill in any additional instrucitons
    .replace("{{ADDITIONAL_INSTRUCTIONS}}", "");

  // Convert message to model format
  const messages = convertToModelMessages([message]);

  logger.log(
    "POST",
    `System Prompt: ${systemPrompt.length} characters\n${messages.length} messages being sent to LLM\nModel: ${selectedModel.id}`
  );

  // Create core toolkit with user context
  const tools = createCoreToolKit(sbUserId);

  const result = streamText({
    model: openai(selectedModel.id),
    messages: messages,
    system: systemPrompt,
    experimental_transform: smoothStream({
      delayInMs: 5,
      chunking: "word",
    }),
    maxOutputTokens: CHAT_MODEL.maxOutputTokens,
    tools: tools,
    toolChoice: "required",
    stopWhen: (ctx) => {
      // Stop if stepCount is above 3
      if (ctx.steps.length > 3) return true;

      // Stop if any tool call is to 'navigate'
      for (const step of ctx.steps) {
        if (
          step.toolCalls?.some((toolCall) => toolCall.toolName === "navigate")
        ) {
          return true;
        }
      }

      return false;
    },
    onError({ error }) {
      logger.error("POST", `Stream error: ${error}`);
    },
  });

  return result.toUIMessageStreamResponse({
    originalMessages: [message],
    consumeSseStream: consumeStream,
    onError: (error) => {
      logger.error("POST", `UI stream error: ${error}`);
      if (error instanceof Error) {
        return error.message;
      }
      if (typeof error === "string") {
        return error;
      }
      return "An unexpected error occurred";
    },
    onFinish: async ({ messages }) => {
      logger.log("POST", `Stream finished with ${messages.length} messages`);

      // Check for navigation tool calls in the messages
      // TODO: Save messages to chat store if needed
      // TODO: Handle orchestration results, function invocations, etc.
    },
    generateMessageId: () => randomUUID(),
  });
}
