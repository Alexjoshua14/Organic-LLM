import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { loadChat } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { AionShell } from "./_components/aion-shell";
import { ArchetypeProvider } from "@/lib/context/archetype-context";

const logger = createLogger(`app/sandbox/aion/page.tsx`);

export default async function AionPage() {
  const id = "3b77ce42-e44b-4cb0-aa53-c4611dcf97f2";

  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;

  try {
    const chatDataRes = await loadChat(id);

    if (chatDataRes.error || chatDataRes.data === null) {
      throw chatDataRes.error;
    }

    chatData = chatDataRes.data;
  } catch (err) {
    logger.error("AionPage", `Error while loading chat: ${err}`);
    return <div>Chat creation failed</div>;
  }

  return (
    <ArchetypeProvider>
      <Page className="overflow-x-auto md:pt-0 pt-10 md:px-0 px-4">
        <AionShell chatData={chatData} />
      </Page>
    </ArchetypeProvider>
  );
}
