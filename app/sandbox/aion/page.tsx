import { UIMessage } from "ai";
import { auth } from "@clerk/nextjs/server";
import { unstable_rethrow } from "next/navigation";

import { AionShell } from "./_components/aion-shell";
import { AionPresenceProvider } from "./_components/aion-presence-provider";

import {
  ArcadiaPersistentHost,
  ArcadiaThreadMeta,
} from "@/app/sandbox/arcadia/_components/multitask-host";
import { hasSubagentThreadRows } from "@/data/supabase/subagent-threads";
import { readCoreInputInitialSettings } from "@/lib/core-input/server-settings";
import { coreInputScopes } from "@/lib/core-input/scopes";
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
    unstable_rethrow(err);
    logger.error("AionPage", `Error while loading chat: ${err}`);

    return <div>Chat creation failed</div>;
  }

  const [initialComposerSettings, hasSubagents] = await Promise.all([
    readCoreInputInitialSettings(coreInputScopes.thread("aion", chatData.thread.id)),
    chatData.thread.owner_id
      ? hasSubagentThreadRows(chatData.thread.id, chatData.thread.owner_id)
      : Promise.resolve(false),
  ]);

  return (
    <ArchetypeProvider>
      <AionPresenceProvider initialThreadId={chatData.thread.id}>
        <Page className="overflow-hidden pt-0 px-0">
          <ArcadiaPersistentHost>
            <ArcadiaThreadMeta
              threadId={chatData.thread.id}
              orchestratorThreadId={chatData.thread.id}
              initialMultitaskView={chatData.thread.arcadia_multitask_view === true}
              initialHasSubagentThreads={hasSubagents ?? undefined}
            />
            <AionShell chatData={chatData} initialComposerSettings={initialComposerSettings} />
          </ArcadiaPersistentHost>
        </Page>
      </AionPresenceProvider>
    </ArchetypeProvider>
  );
}
