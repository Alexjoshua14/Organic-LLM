import type { Metadata } from "next";

import { MemoryMindmapLab } from "./_components/MemoryMindmapLab";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Memory mind map"),
};

export default function MemoryMindmapPrototypePage() {
  return (
    <LiquidChromePage
      chrome="full-bleed"
      className="items-stretch justify-start overflow-hidden"
      transparentBackground
    >
      <AdaptiveLiquidChrome dimIntensity={0.52} />
      <MemoryMindmapLab />
    </LiquidChromePage>
  );
}
