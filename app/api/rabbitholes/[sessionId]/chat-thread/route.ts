import { NextResponse } from "next/server";

import { loadRabbitHoleSessionChat } from "@/lib/rabbit-holes/session-chat-thread";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";

export async function GET(
  _req: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  const actor = await requireLlmChatActor();

  if (actor.error != null) {
    return actor.error;
  }

  const { sessionId } = await context.params;
  const result = await loadRabbitHoleSessionChat(sessionId);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    threadId: result.threadId,
    thread: result.chatData.thread,
    messages: result.chatData.messages,
  });
}
