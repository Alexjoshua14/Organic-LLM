import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { loadChat } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { LineListShell } from "../_components/LineListShell";

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
        <div className="mx-auto w-full max-w-2xl px-6 py-12">
          <p className="text-destructive">Failed to load line list thread.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <div className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <LineListShell chatData={chatData} />
      </div>
    </Page>
  );
}
