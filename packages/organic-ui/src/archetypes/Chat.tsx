import { UIMessage } from "@ai-sdk/react";

import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/data/supabase/chat";
import { createLogger } from "@/lib/logger";
import { Thread } from "@/lib/schemas/chat";
import "server-only";

const logger = createLogger("ChatArchetype");

export default async function ChatArchetype({ chatId }: { chatId: string }) {
  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(chatId);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;
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

  return <Chat chatData={chatData} />;
}
