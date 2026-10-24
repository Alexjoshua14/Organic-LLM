import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";

import { AionShell } from "./_components/aion-shell";
import { AionPresenceProvider } from "./_components/aion-presence-provider";

import Page from "@/components/layout/page";
import { resolveFeatureThread } from "@/lib/chat/resolve-feature-thread";
import { loadChat, createChat } from "@/lib/chat/chat-store";
import { ArchetypeProvider } from "@/lib/context/archetype-context";
import { createLogger } from "@/lib/logger";
import {
  AION_THREAD_FEATURE,
  AION_THREAD_PATH,
  DEFAULT_AION_THREAD_POLICY,
} from "@/lib/schemas/aion-presence";
import { Thread } from "@/lib/schemas/chat";
import { getSupabaseUserId } from "@/data/supabase/profiles";

const logger = createLogger(`app/sandbox/aion/page.tsx`);

export default async function AionPage() {
  let chatData: { thread: Thread; messages: UIMessage[] } | null = null;
  let threadId: string | null = null;

  try {
    const clerkUser = await auth();

    if (clerkUser?.userId) {
      const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);

      if (sbUserIdResult.data) {
        const resolved = await resolveFeatureThread({
          ownerId: sbUserIdResult.data,
          feature: AION_THREAD_FEATURE,
          path: AION_THREAD_PATH,
          policy: DEFAULT_AION_THREAD_POLICY,
        });

        threadId = resolved.threadId;
      }
    }

    if (!threadId) {
      const created = await createChat();

      if (created.error || !created.data) {
        throw created.error ?? new Error("Failed to create Aion thread");
      }

      threadId = created.data;
    }

    const chatDataRes = await loadChat(threadId);

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
      <AionPresenceProvider initialThreadId={chatData.thread.id}>
        <Page className="overflow-x-auto md:pt-0 pt-10 md:px-0 px-4">
          <AionShell chatData={chatData} />
        </Page>
      </AionPresenceProvider>
    </ArchetypeProvider>
  );
}
