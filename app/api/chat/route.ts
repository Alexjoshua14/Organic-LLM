import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  convertToModelMessages,
  validateUIMessages,
  TypeValidationError,
  createIdGenerator,
} from "ai";
import { NextResponse } from "next/server";
import systemPrompt from "@/lib/system-prompt";
import { loadChat, saveChat } from "@/util/chat-store";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const tools = {};

export async function POST(req: Request) {
  const { message, id }: { message: UIMessage; id: string } = await req.json();

  console.log(`Recieved Message: ${JSON.stringify(message)}`);

  let validatedMessages: UIMessage[];

  try {
    const previousMessages = await loadChat(id);

    validatedMessages = await validateUIMessages({
      messages: [...previousMessages, message],
      tools,
    });
  } catch (err) {
    if (err instanceof TypeValidationError) {
      console.error(`Database messages validation failed: ${err.message}`);
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

  console.log(result);

  return result.toUIMessageStreamResponse({
    originalMessages: validatedMessages,
    onFinish: ({ messages }) => {
      saveChat({ id, messages });
    },
    generateMessageId: createIdGenerator({
      prefix: "msg",
      size: 16,
    }),
  });
}
