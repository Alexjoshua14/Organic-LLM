import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/lib/chat/chat-store";
import { getNMessages } from "@/data/supabase/chat";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger(`app/remy/[slug]/page.tsx`);

export default async function RemyPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ initialMessage?: string }>;
}) {
  const { slug: chatId } = await params;
  const { initialMessage } = await searchParams;

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
    logger.error("RemyPage", `Error while loading chat: ${err}`);

    return <div>Chat creation failed</div>;
  }

  return (
    <Page>
      <div className="max-w-[calc(100dvw-2rem)] md:max-w-[calc(100dvw-18rem)] lg:max-w-4xl w-full h-full">
        <Chat chatData={chatData} initialMessage={initialMessage} persona="remy" />
      </div>
    </Page>
  );
}
