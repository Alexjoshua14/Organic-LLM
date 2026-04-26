import type { Metadata } from "next";

import Link from "next/link";

import { GlassFontsLab } from "./_components/glass-fonts-lab";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Glass Fonts"),
};

export default function GlassFontsPrototypePage() {
  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.68} speed={0.01} />

      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-5 py-6 sm:px-8 sm:py-10">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              &larr; Prototypes
            </Link>
          </nav>

          <header className="mb-8 max-w-3xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.3em] text-accent/80">
              Font lab
            </p>
            <h1 className="text-4xl font-light tracking-[-0.045em] text-foreground sm:text-5xl">
              Tabbed typography controls and baseline lock-in.
            </h1>
            <p className="mt-4 text-base leading-7 text-muted-foreground">
              Compare families, tune variable axes and heading levels, then lock the selected
              baseline for this prototype route.
            </p>
          </header>

          <GlassFontsLab />
        </div>
      </div>
    </Page>
  );
}
