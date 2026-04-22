"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { AnatomyHero } from "@/components/showcase/AnatomyHero";
import { ConversationRail } from "@/components/showcase/ConversationRail";
import { ShowcaseFooter } from "@/components/showcase/ShowcaseFooter";
import { StageMiniMap } from "@/components/showcase/StageMiniMap";
import { StageRail } from "@/components/showcase/StageRail";
import Page from "@/components/layout/page";
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
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
          <nav className="mb-6">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground select-none"
              href="/showcase"
            >
              ← Showcase
            </Link>
          </nav>

          <AnatomyHero prompt={demoTrace.prompt} thesis={THESIS} />

          <div className="lg:grid lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10 lg:items-start">
            <ConversationRail className="w-full" trace={demoTrace} />

            <div className="mt-10 flex min-w-0 flex-col gap-6 lg:mt-0 lg:flex-row lg:gap-8">
              <StageMiniMap
                activeIndex={activeStage}
                className="hidden shrink-0 lg:block lg:sticky lg:top-20 lg:w-44 lg:self-start"
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

          <ShowcaseFooter />
        </div>
      </div>
    </Page>
  );
}
