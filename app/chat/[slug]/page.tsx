import type { Metadata } from "next";

import { UIMessage } from "ai";
import { cache } from "react";

import { ChatLoadError } from "./chat-load-error";

import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { PerfServerPhases } from "@/components/perf/perf-server-phases";
import { loadChat } from "@/lib/chat/chat-store";
import { PERF_PHASES } from "@/lib/perf/journeys";
import { createRequestPhaseCollector, timeServerPhase } from "@/lib/perf/server-phase";
import { getNMessages } from "@/data/supabase/chat";
import { resolveChatBrowserTabTitlePrimary } from "@/lib/metadata/resolve-browser-tab-title";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger(`app/chat/[slug]/page.tsx`);

const getPhaseCollector = createRequestPhaseCollector;

const loadChatForRequest = cache(async (id: string) =>
  timeServerPhase(getPhaseCollector(), PERF_PHASES.serverLoadChat, () => loadChat(id))
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug: chatId } = await params;
  const res = await loadChatForRequest(chatId);

  if (res.error || res.data === null) {
    return tabTitleMetadata(null, "Chat");
  }
  const primary = await resolveChatBrowserTabTitlePrimary({
    experience: "chat",
    thread: res.data.thread,
    messages: res.data.messages,
  });

  return tabTitleMetadata(primary, "Chat");
}

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
    const chatDataRes = await loadChatForRequest(id);

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
    <>
      <PerfServerPhases journey="to-chat" phases={getPhaseCollector()} />
      <Page>
        <div className="w-full h-full">
          <Chat chatData={chatData} initialDraft={draft} />
        </div>
      </Page>
    </>
  );
}
