import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/lib/chat/chat-store";
import { getNMessages } from "@/data/supabase/chat";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

import { ChatLoadError } from "./chat-load-error";

const logger = createLogger(`app/chat/[slug]/page.tsx`);

export default async function ChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ draft?: string }>;
}) {
  const { slug: chatId } = await params;
  const { draft } = await searchParams;

  const id = chatId;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(id);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;

    getNMessages(chatId, 5);
  } catch (err) {
    logger.error("ChatPage", `Error while loading chat: ${err}`);

    return <ChatLoadError />;
  }

  return (
    <Page>
      <div className="w-full h-full">
        <Chat chatData={chatData} initialDraft={draft} />
      </div>
    </Page>
  );
}
