import type { Metadata } from "next";

import { UIMessage } from "ai";
import { cache } from "react";

import { getThreadArcadiaMultitaskView } from "@/data/supabase/chat";
import { hasSubagentThreadRows } from "@/data/supabase/subagent-threads";
import { ArcadiaMultitaskHost } from "@/app/sandbox/arcadia/_components/multitask-host";
import Page from "@/components/layout/page";
import { Chat } from "@/components/chat/chat";
import { PerfServerPhases } from "@/components/perf/perf-server-phases";
import { loadChat } from "@/lib/chat/chat-store";
import { PERF_PHASES } from "@/lib/perf/journeys";
import {
  createRequestPhaseCollector,
  takeServerPhases,
  timeServerPhase,
} from "@/lib/perf/server-phase";
import { resolveChatBrowserTabTitlePrimary } from "@/lib/metadata/resolve-browser-tab-title";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/arcadia/[slug]/page.tsx");

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

  const parentId = chatData.thread.parent_thread_id;
  const agentId = chatData.thread.subagent_agent_id;
  const orchestratorThreadId = parentId && agentId ? parentId : id;
  const [hasSubagents, parentView] = await Promise.all([
    chatData.thread.owner_id
      ? hasSubagentThreadRows(orchestratorThreadId, chatData.thread.owner_id)
      : Promise.resolve(null),
    orchestratorThreadId !== id
      ? getThreadArcadiaMultitaskView(orchestratorThreadId)
      : Promise.resolve(null),
  ]);
  const initialMultitaskView =
    parentView?.data?.enabled ?? chatData.thread.arcadia_multitask_view === true;

  return (
    <>
      <PerfServerPhases
        journey="to-arcadia"
        phases={[...takeServerPhases(id), ...getPhaseCollector()]}
      />
      <Page>
        <ArcadiaMultitaskHost
          threadId={id}
          orchestratorThreadId={orchestratorThreadId}
          viewingSubagentId={parentId && agentId ? agentId : undefined}
          initialMultitaskView={initialMultitaskView}
          initialHasSubagentThreads={hasSubagents ?? undefined}
        >
          <div className="w-full h-full">
            <Chat chatData={chatData} endpoint="/api/chat" experience="arcadia" />
          </div>
        </ArcadiaMultitaskHost>
      </Page>
    </>
  );
}
