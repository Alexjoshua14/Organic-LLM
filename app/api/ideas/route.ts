import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

const logger = createLogger(`app/api/ideas/route.ts`);

export async function POST(req: Request) {
  // console.log(`Recieved Messages: ${JSON.stringify(messages)}`);
  // const result = streamText({
  //   model: openai("gpt-4o"),
  //   messages: convertToModelMessages(messages),
  // });
  logger.log("POST", `Recieved req: ${JSON.stringify(req)}`);

  return NextResponse.json({ message: "Hello, world!" });
}
