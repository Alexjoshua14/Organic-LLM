import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { loadChat } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { AionShell } from "./_components/aion-shell";

const logger = createLogger(`app/sandbox/aion/page.tsx`);

export default async function AionPage() {
  const id = "f11aac23-ca87-4a79-a5a9-5c7115abec2b";

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
    <Page className="overflow-x-auto">
      <AionShell chatData={chatData} />
    </Page>
  );
}
