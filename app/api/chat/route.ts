import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { NextResponse } from "next/server";
import systemPrompt from "@/lib/system-prompt";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  console.log(`Recieved Messages: ${JSON.stringify(messages)}`);

  const result = streamText({
    model: openai("gpt-4o"),
    messages: convertToModelMessages(messages),
    system: systemPrompt,
  });

  console.log(result);

  return result.toUIMessageStreamResponse();
}
