import type { Metadata } from "next";
import type { UIMessage } from "ai";
import type { StrataPage } from "@/lib/schemas/strata";
import type { Thread } from "@/lib/schemas/chat";

import { auth } from "@clerk/nextjs/server";

import { StrataAssistantPanel } from "./_components/StrataAssistantPanel";
import { StrataBrowser } from "./_components/StrataBrowser";
import { StrataAssistantOpenHint, StrataWorkspace } from "./_components/StrataWorkspace";

import { ensureStrataAgentThread } from "@/data/supabase/strata-agent";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { listStrataPagesCached } from "@/data/supabase/strata";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { loadChat } from "@/lib/chat/chat-store";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/strata/page.tsx");

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Strata"),
};

export default async function StrataBrowserPage() {
  const clerkUser = await auth();

  if (!clerkUser?.userId) {
    return (
      <Page transparentBackground className="items-stretch justify-start overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto">
          <PageContentFrame>
            <PageNavBack href="/sandbox/prototypes">← Prototypes</PageNavBack>
            <p className="text-destructive">You need to sign in to use Strata.</p>
          </PageContentFrame>
        </div>
      </Page>
    );
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
  const ownerId = sbUserIdResult.data;

  if (sbUserIdResult.error || !ownerId) {
    return (
      <Page transparentBackground className="items-stretch justify-start overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto">
          <PageContentFrame>
            <PageNavBack href="/sandbox/prototypes">← Prototypes</PageNavBack>
            <p className="text-destructive">Could not resolve your profile for Strata.</p>
          </PageContentFrame>
        </div>
      </Page>
    );
  }

  let dbAvailable = true;
  let pages: StrataPage[] = [];

  try {
    pages = await listStrataPagesCached(ownerId);
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      logger.error("StrataBrowserPage", "Failed to list pages from Supabase", err);
    }
    dbAvailable = false;
  }

  let hubAgentChatData: { thread: Thread; messages: UIMessage[] } | null = null;

  if (dbAvailable) {
    try {
      const hubThreadId = await ensureStrataAgentThread(ownerId, { kind: "hub" });
      const res = await loadChat(hubThreadId);

      if (!res.error && res.data) hubAgentChatData = res.data;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        logger.error("StrataBrowserPage", "Failed to load hub assistant thread", err);
      }
      hubAgentChatData = null;
    }
  }

  return (
    <Page transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <StrataWorkspace
        agentPanelTitle="Strata hub"
        agentPanel={
          <StrataAssistantPanel
            chatData={hubAgentChatData}
            emptyHint="Sign in with Strata storage available to use the hub assistant (threads load from Supabase)."
            experience="strata_hub"
          />
        }
      >
        <div className="relative z-10 flex h-full min-h-0 w-full flex-col overflow-y-auto">
          <PageContentFrame className="flex min-h-0 flex-col pb-0">
            <PageNavBack href="/sandbox/prototypes" trailing={<StrataAssistantOpenHint />}>
              ← Prototypes
            </PageNavBack>
            <StrataBrowser dbAvailable={dbAvailable} pages={pages} />
          </PageContentFrame>
        </div>
      </StrataWorkspace>
    </Page>
  );
}
