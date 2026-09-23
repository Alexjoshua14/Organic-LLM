import type { Metadata } from "next";

import { ErgonBoardLab } from "./_components/ErgonBoardLab";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Ergon living board"),
};

export default function ErgonPrototypePage() {
  return (
    <Page liquidChromeBackground transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <PageContentFrame
        className="relative z-10 flex h-full flex-col overflow-hidden pb-0"
        maxWidth="7xl"
      >
        <div className="min-h-0 flex-1 overflow-y-auto pb-16">
          <PageNavBack href="/sandbox/prototypes">← Prototypes</PageNavBack>

          <header className="mb-6 max-w-2xl space-y-1.5">
            <h1 className="font-commissioner text-3xl font-light tracking-tight text-foreground">
              Ergon living board
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Quiet surfaces, living light. Three ways for the board to show the model at work,
              replaying the showcase script against a local board — no API calls.
            </p>
          </header>

          <ErgonBoardLab />
        </div>
      </PageContentFrame>
    </Page>
  );
}
