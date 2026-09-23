"use client";

import { useCallback, useState } from "react";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { ConversationRail } from "@/components/showcase/ConversationRail";
import { ShowcaseHero } from "@/components/showcase/ShowcaseHero";
import { ShowcaseOverview } from "@/components/showcase/ShowcaseOverview";
import { StageMiniMap } from "@/components/showcase/StageMiniMap";
import { StageRail } from "@/components/showcase/StageRail";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { demoTrace } from "@/lib/showcase/demo-trace";

const THESIS =
  "A transparent walkthrough of one assistant turn: how Organic LLM packs context, routes tools, streams tokens, and renders the same structured UI you see in chat — using a recorded trace, not a live model call.";

export default function AnatomyShowcasePage() {
  const [activeStage, setActiveStage] = useState(0);
  const onActiveStageChange = useCallback((index: number) => {
    setActiveStage(index);
  }, []);

  const miniStages = demoTrace.stages.map((s) => ({ id: s.id, title: s.title }));

  return (
    <Page
      liquidChromeBackground
      transparentBackground
      className="items-stretch justify-start overflow-hidden"
    >
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="6xl">
          <PageNavBack href="/showcase">← Showcase</PageNavBack>

          <ShowcaseOverview placement="intro" />

          <ShowcaseHero thesis={THESIS} title="Anatomy of a Response" />

          <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:items-start lg:gap-10">
            <ConversationRail className="w-full" trace={demoTrace} />

            <div className="mt-10 flex min-w-0 flex-col gap-6 lg:mt-0 lg:flex-row lg:gap-8">
              <StageMiniMap
                activeIndex={activeStage}
                className="hidden shrink-0 lg:sticky lg:top-20 lg:block lg:w-44 lg:self-start"
                orientation="vertical"
                stages={miniStages}
              />

              <div className="min-w-0 flex-1">
                <StageMiniMap
                  activeIndex={activeStage}
                  className="mb-2 lg:hidden"
                  orientation="horizontal"
                  stages={miniStages}
                />
                <StageRail onActiveStageChange={onActiveStageChange} stages={demoTrace.stages} />
              </div>
            </div>
          </div>
        </PageContentFrame>
      </div>
    </Page>
  );
}
