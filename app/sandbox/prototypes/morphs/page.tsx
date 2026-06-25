import type { Metadata } from "next";

import { MorphInputLayoutDemo } from "./_components/morph-input-layout-demo";

import { LiquidChromeSsrFill } from "@/components/background/LiquidChromeSsrFill";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Morph input demo"),
};

export default function MorphsPrototypePage() {
  return (
    <>
      <LiquidChromeSsrFill />
      <MorphInputLayoutDemo />
    </>
  );
}
