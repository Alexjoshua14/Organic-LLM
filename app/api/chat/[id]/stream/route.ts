import { auth } from "@clerk/nextjs/server";
import { UI_MESSAGE_STREAM_HEADERS } from "ai";
import { after } from "next/server";
import { createResumableStreamContext } from "resumable-stream";

import { createLogger } from "@/lib/logger";
import { readChat } from "@/lib/chat/chat-store";

const logger = createLogger("app/api/chat/[id]/stream/route.ts");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const clerkUser = await auth();

  if (!clerkUser || !clerkUser.userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;

  const chatRes = await readChat(id);

  if (chatRes.error) {
    logger.error("GET", `Error reading chat: ${chatRes.error.message}`);

    return new Response(null, { status: 500 });
  } else if (chatRes.data === null) {
    logger.error("GET", `Error reading chat: Chat is null`);

    return new Response(null, { status: 500 });
  }

  const chat = chatRes.data;

  if (chat.thread.active_stream_id == null) {
    // no content response when there is no active stream
    return new Response(null, { status: 204 });
  }

  const streamContext = createResumableStreamContext({
    waitUntil: after,
  });

  return new Response(await streamContext.resumeExistingStream(chat.thread.active_stream_id), {
    headers: UI_MESSAGE_STREAM_HEADERS,
  });
}
