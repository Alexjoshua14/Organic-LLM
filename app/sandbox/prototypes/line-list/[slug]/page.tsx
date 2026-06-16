import { UIMessage } from "ai";

import { LineListShell } from "../_components/LineListShell";

import { PageContentFrame } from "@/components/layout/page-content-frame";
import Page from "@/components/layout/page";
import { loadChat } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/line-list/[slug]/page.tsx");

export default async function LineListThreadPage({
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
    logger.error("LineListThreadPage", `Error loading chat: ${err}`);

    return (
      <Page>
        <PageContentFrame maxWidth="2xl">
          <p className="text-destructive">Failed to load line list thread.</p>
        </PageContentFrame>
      </Page>
    );
  }

  return (
    <Page>
      <PageContentFrame className="flex h-full flex-col pb-42" maxWidth="3xl">
        <LineListShell chatData={chatData} />
      </PageContentFrame>
    </Page>
  );
}
