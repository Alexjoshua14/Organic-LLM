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
      <Page transparentBackground className="overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <PageContentFrame className="relative z-10 h-full overflow-y-auto pb-0">
          <PageNavBack href="/sandbox/prototypes">← Prototypes</PageNavBack>
          <p className="text-destructive">You need to sign in to use Strata.</p>
        </PageContentFrame>
      </Page>
    );
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
  const ownerId = sbUserIdResult.data;

  if (sbUserIdResult.error || !ownerId) {
    return (
      <Page transparentBackground className="overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <PageContentFrame className="relative z-10 h-full overflow-y-auto pb-0">
          <PageNavBack href="/sandbox/prototypes">← Prototypes</PageNavBack>
          <p className="text-destructive">Could not resolve your profile for Strata.</p>
        </PageContentFrame>
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
    <Page transparentBackground className="overflow-hidden">
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
        <PageContentFrame
          className="relative z-10 flex h-full min-h-0 flex-col overflow-y-auto pb-0"
        >
          <PageNavBack href="/sandbox/prototypes" trailing={<StrataAssistantOpenHint />}>
            ← Prototypes
          </PageNavBack>
          <StrataBrowser dbAvailable={dbAvailable} pages={pages} />
        </PageContentFrame>
      </StrataWorkspace>
    </Page>
  );
}
