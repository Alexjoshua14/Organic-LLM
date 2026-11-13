import type { Metadata } from "next";

import Link from "next/link";

import { SpeakStageLab } from "./_components/speak-stage-lab";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Speak stage"),
};

export default function SpeakStagePrototypePage() {
  return (
    <LiquidChromePage className="overflow-hidden" transparentBackground>
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.65} />

      <div className="relative z-10 flex h-full w-full flex-col">
        <header className="shrink-0 border-b border-border/50 bg-background/18 px-5 py-3 backdrop-blur-md sm:px-8 dark:bg-background/10">
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/sandbox/prototypes"
          >
            &larr; Prototypes
          </Link>
        </header>

        <div className="min-h-0 flex-1">
          <SpeakStageLab />
        </div>
      </div>
    </LiquidChromePage>
  );
}
