import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/lib/chat/chat-store";
import { generateChatTitle } from "@/lib/llm/chat-helpers";
import { updateChatTitle } from "@/data/supabase/chat";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger(`app/chat/[slug]/page.tsx`);

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string; initialMessage?: string }>;
}) {
  const { slug: chatId, initialMessage } = await params;

  const id = chatId;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(id);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;

    if (chatData.thread.title === null && chatData.messages.length > 3) {
      const titleRes = await generateChatTitle(id);

      if (titleRes.error) {
        throw titleRes.error;
      }
      chatData.thread.title = titleRes.data;
      await updateChatTitle(id, titleRes.data ?? "");
    }
  } catch (err) {
    logger.error("ChatPage", `Error while loading chat: ${err}`);

    // const id = await createChat().then((res) => res.data ?? "");
    // console.log(`Chat created with ID: ${id}.. Redirecting user..`);
    // if (id === null || id === "") {
    //   console.error("Chat creation failed");
    //   return <div>Chat creation failed</div>;
    // }
    // redirect(`/chat/${id}`);
    return <div>Chat creation failed</div>;
  }

  return (
    <Page>
      <Chat chatData={chatData} initialMessage={initialMessage} />
    </Page>
  );
}
