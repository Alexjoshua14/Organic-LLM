import type { Metadata } from "next";

import Link from "next/link";

import { VoiceBarLab } from "./_components/voice-bar-lab";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Voice bar"),
};

export default function VoiceBarPrototypePage() {
  return (
    <LiquidChromePage className="overflow-hidden" transparentBackground>
      {/* Chrome behind the bar, so FluidGlass has something worth refracting. */}
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.72} speed={0.01} />

      <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto">
        <header className="shrink-0 border-b border-white/10 bg-background/18 px-5 py-4 backdrop-blur-md sm:px-8 dark:bg-background/10">
          <Link
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            href="/sandbox/prototypes"
          >
            &larr; Prototypes
          </Link>
        </header>

        <VoiceBarLab />
      </div>
    </LiquidChromePage>
  );
}
