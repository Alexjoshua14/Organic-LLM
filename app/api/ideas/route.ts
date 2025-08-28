import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";
import { NextResponse } from "next/server";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  console.log(`Recieved Messages: ${JSON.stringify(messages)}`);

  const result = streamText({
    model: openai("gpt-4o"),
    messages: convertToModelMessages(messages),
  });
}
