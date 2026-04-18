import { UIMessage } from "ai";
import type { Metadata } from "next";
import { cache } from "react";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { loadChat } from "@/lib/chat/chat-store";
import { resolveChatBrowserTabTitlePrimary } from "@/lib/metadata/resolve-browser-tab-title";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/arcadia/[slug]/page.tsx");

const loadChatForRequest = cache(loadChat);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: chatId } = await params;
  const res = await loadChatForRequest(chatId);
  if (res.error || res.data === null) {
    return tabTitleMetadata(null, "Arcadia");
  }
  const primary = await resolveChatBrowserTabTitlePrimary({
    experience: "arcadia",
    thread: res.data.thread,
    messages: res.data.messages,
  });
  return tabTitleMetadata(primary, "Arcadia");
}

export default async function ArcadiaChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: chatId } = await params;
  const id = chatId;

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChatForRequest(id);

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

