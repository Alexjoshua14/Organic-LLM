import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/arcadia/[slug]/page.tsx");

export default async function ArcadiaChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: chatId } = await params;
  const id = chatId;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(id);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;
  } catch (err) {
    logger.error("ArcadiaChatPage", `Error while loading chat: ${err}`);
    return <div>Chat creation failed</div>;
  }

  return (
    <Page>
      <div className="w-full h-full">
        <Chat chatData={chatData} endpoint="/api/chat" experience="arcadia" />
      </div>
    </Page>
  );
}

