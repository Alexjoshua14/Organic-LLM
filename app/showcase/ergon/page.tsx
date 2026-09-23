import type { Metadata } from "next";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { ErgonShowcaseStage } from "@/components/showcase/ergon/ErgonShowcaseStage";
import { ShowcaseHero } from "@/components/showcase/ShowcaseHero";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Ergon live board"),
  description:
    "Scripted replay of Organic LLM’s Ergon kanban: the model builds a board in chat, rearranges it, then summons a filtered next-up view — no live API calls.",
};

const THESIS =
  "A scripted Arcadia conversation in Ergon style: the model builds a live kanban board in the thread, rearranges it as you report progress, then summons a filtered “what’s next” view. Bundled data only — no model, TTS, or database calls.";

export default function ErgonShowcasePage() {
  return (
    <Page liquidChromeBackground transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <PageContentFrame
        className="relative z-10 flex h-full flex-col overflow-hidden pb-0"
        maxWidth="7xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pb-16">
          <PageNavBack href="/showcase">← Showcase</PageNavBack>

          <ShowcaseHero thesis={THESIS} title="Ergon live board" />

          <ErgonShowcaseStage />
        </div>
      </PageContentFrame>
    </Page>
  );
}
