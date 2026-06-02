import type { Metadata } from "next";

import { UIMessage } from "ai";
import { cache } from "react";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/lib/chat/chat-store";
import { generateChatTitle } from "@/lib/llm/chat-helpers";
import { updateChatTitle } from "@/data/supabase/chat";
import { resolveChatBrowserTabTitlePrimary } from "@/lib/metadata/resolve-browser-tab-title";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger(`app/chat/[slug]/page.tsx`);

const loadChatForRequest = cache(loadChat);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: chatId } = await params;
  const res = await loadChatForRequest(chatId);

  if (res.error || res.data === null) {
    return tabTitleMetadata(null, "Spark");
  }
  const primary = await resolveChatBrowserTabTitlePrimary({
    experience: "spark",
    thread: res.data.thread,
    messages: res.data.messages,
  });

  return tabTitleMetadata(primary, "Spark");
}

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string; initialMessage?: string }>;
}) {
  const { slug: chatId, initialMessage } = await params;

  const id = chatId;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChatForRequest(id);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;

    if (chatData.thread.title === null && chatData.messages.length >= 2) {
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
      <Chat
        chatData={chatData}
        endpoint="/api/chat/spark"
        initialMessage={initialMessage}
        persona="spark"
      />
    </Page>
  );
}
