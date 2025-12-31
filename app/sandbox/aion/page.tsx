import { UIMessage } from "ai";

import Page from "@/components/layout/page";
import { loadChat } from "@/lib/chat/chat-store";
import { Thread } from "@/lib/schemas/chat";
import { createLogger } from "@/lib/logger";
import { PersistedSchemasContainer } from "./_components/persisted-schemas-container";
import { ChatWrapper } from "./_components/chat-wrapper";
import {
  ListSchema,
  KeyValueSchema,
  CodeBlockSchema,
  RecipeCardSchema,
  TickerSchema,
} from "@/lib/schemas/llm-context";
import { z } from "zod";

const logger = createLogger(`app/sandbox/aion/page.tsx`);

type PersistedSchema =
  | z.infer<typeof ListSchema>
  | z.infer<typeof KeyValueSchema>
  | z.infer<typeof CodeBlockSchema>
  | z.infer<typeof RecipeCardSchema>
  | z.infer<typeof TickerSchema>;

export default async function AionPage() {
  // Hardcoded chat ID for Aion sandbox
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

  // TODO: Load persisted schemas from thread storage
  const persistedSchemas: PersistedSchema[] = [];

  return (
    <Page transparentBackground>
      <div className="w-full h-full flex flex-col">
        {/* Persisted Schemas Container - full width, top portion */}
        <div className="w-full flex-1 border-b border-border overflow-hidden">
          <PersistedSchemasContainer schemas={persistedSchemas} />
        </div>
        {/* Chat Container - 50% width, bottom portion */}
        <div className="w-[50%] flex-1 overflow-hidden">
          <ChatWrapper chatData={chatData} endpoint="/api/ai/aion" persona="aion" />
        </div>
      </div>
    </Page>
  );
}
