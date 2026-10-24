import type { Metadata } from "next";

import { AdaptiveLiquidChromeLab } from "./_components/adaptive-liquid-chrome-lab";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Adaptive Liquid Chrome"),
};

export default function PrototypesBackgroundPage() {
  return (
    <>
      <LiquidChromeSsrFill />
      <AdaptiveLiquidChromeLab />
    </>
  );
}
