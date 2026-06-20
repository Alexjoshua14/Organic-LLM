import type { Metadata } from "next";
import type { UIMessage } from "ai";
import type { Thread } from "@/lib/schemas/chat";

import { cache } from "react";

import { StrataPageClient } from "../_components/StrataPageClient";

import Page from "@/components/layout/page";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { ensureStrataAgentThread } from "@/data/supabase/strata-agent";
import { getStrataPageByIdCached } from "@/data/supabase/strata";
import { loadChat } from "@/lib/chat/chat-store";
import { resolveStrataBrowserTabTitlePrimary } from "@/lib/metadata/resolve-browser-tab-title";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";
import { buildStrataPageDefaults, STRATA_DEFAULT_UNTITLED_TITLE } from "@/lib/schemas/strata";
import { createLogger } from "@/lib/logger";

const logger = createLogger("app/sandbox/prototypes/strata/[slug]/page.tsx");

const loadStrataForRequest = cache(
  async (
    slug: string
  ): Promise<{
    pageData: Awaited<ReturnType<typeof getStrataPageByIdCached>>;
    dbAvailable: boolean;
  }> => {
    try {
      const pageData = await getStrataPageByIdCached(slug);

      return { pageData, dbAvailable: true };
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        logger.error("loadStrataForRequest", "Failed to load page from Supabase", err);
      }

      return { pageData: null, dbAvailable: false };
    }
  }
);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { pageData } = await loadStrataForRequest(slug);
  const initial = pageData ?? buildStrataPageDefaults(slug, STRATA_DEFAULT_UNTITLED_TITLE);
  const primary = await resolveStrataBrowserTabTitlePrimary(initial);

  return tabTitleMetadata(primary, "Strata");
}

export default async function StrataPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { pageData, dbAvailable } = await loadStrataForRequest(slug);

  const initialData = pageData ?? buildStrataPageDefaults(slug, STRATA_DEFAULT_UNTITLED_TITLE);

  let pageAgentChatData: { thread: Thread; messages: UIMessage[] } | null = null;
  const canLoadAgent =
    dbAvailable &&
    initialData.page.owner_id !== "local-device" &&
    !initialData.page.owner_id.startsWith("local-");

  if (canLoadAgent) {
    try {
      const threadId = await ensureStrataAgentThread(initialData.page.owner_id, {
        kind: "page",
        pageId: initialData.page.id,
      });
      const res = await loadChat(threadId);

      if (!res.error && res.data) pageAgentChatData = res.data;
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        logger.error("StrataPage", "Failed to load page assistant thread", err);
      }
      pageAgentChatData = null;
    }
  }

  return (
    <Page transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} dimIntensityFull={0.62} />
      <div className="relative z-10 flex h-full min-h-0 w-full flex-col">
        <StrataPageClient
          dbAvailable={dbAvailable}
          initialData={initialData}
          pageAgentChatData={pageAgentChatData}
        />
      </div>
    </Page>
  );
}
