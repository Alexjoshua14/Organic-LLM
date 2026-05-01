import type { Metadata } from "next";
import type { UIMessage } from "ai";
import type { StrataPage } from "@/lib/schemas/strata";
import type { Thread } from "@/lib/schemas/chat";

import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

import { StrataAssistantPanel } from "./_components/StrataAssistantPanel";
import { StrataBrowser } from "./_components/StrataBrowser";
import { StrataAssistantOpenHint, StrataWorkspace } from "./_components/StrataWorkspace";

import { ensureStrataAgentThread } from "@/data/supabase/strata-agent";
import { getSupabaseUserId } from "@/data/supabase/profiles";
import { listStrataPagesCached } from "@/data/supabase/strata";
import Page from "@/components/layout/page";
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
        <div className="relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto h-full">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground hover:text-foreground transition-colors select-none"
              href="/sandbox/prototypes"
            >
              ← Prototypes
            </Link>
          </nav>
          <p className="text-destructive">You need to sign in to use Strata.</p>
        </div>
      </Page>
    );
  }

  const sbUserIdResult = await getSupabaseUserId(clerkUser.userId);
  const ownerId = sbUserIdResult.data;

  if (sbUserIdResult.error || !ownerId) {
    return (
      <Page transparentBackground className="overflow-hidden">
        <AdaptiveLiquidChrome dimIntensity={0.45} />
        <div className="relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto h-full">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground hover:text-foreground transition-colors select-none"
              href="/sandbox/prototypes"
            >
              ← Prototypes
            </Link>
          </nav>
          <p className="text-destructive">Could not resolve your profile for Strata.</p>
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
        <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col overflow-y-auto p-6">
          <nav className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link
              className="text-sm text-muted-foreground transition-colors select-none hover:text-foreground"
              href="/sandbox/prototypes"
            >
              ← Prototypes
            </Link>
            <StrataAssistantOpenHint />
          </nav>
          <StrataBrowser dbAvailable={dbAvailable} pages={pages} />
        </div>
      </StrataWorkspace>
    </Page>
  );
}
