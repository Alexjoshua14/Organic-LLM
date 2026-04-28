import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";

import { MemoryIngestShell } from "../_components/MemoryIngestShell";

import Page from "@/components/layout/page";
import { loadChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/memory-ingest/[slug]/page.tsx");

export default async function MemoryIngestThreadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug: chatId } = await params;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(chatId);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;
  } catch (err) {
    logger.error("MemoryIngestThreadPage", `Error loading chat: ${err}`);

    return (
      <Page>
        <div className="mx-auto w-full max-w-md px-6 py-12 text-destructive">
          Failed to load memory ingest thread.
        </div>
      </Page>
    );
  }

  return <MemoryIngestShell chatData={chatData} />;
}
