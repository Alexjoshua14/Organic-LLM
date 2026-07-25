import type { Metadata } from "next";

import { PrototypeCard } from "./_components/prototype-card";
import { getPrototypeTiers, prototypes } from "./_config/prototypes";

import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Prototypes"),
};

/** Entrance stagger step; capped so late library cards don't feel like they lag the page. */
const ENTER_STAGGER_MS = 45;
const ENTER_STAGGER_CAP_MS = 500;

function TierRule({ label, className }: { label: string; className?: string }) {
  return (
    <div className={cn("mb-5 mt-12 flex select-none items-center gap-4", className)}>
      <span className="text-2xs font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
        {label}
      </span>
      <div
        aria-hidden
        className="h-px flex-1 bg-linear-to-r from-border/70 to-transparent dark:from-white/10"
      />
    </div>
  );
}

export default function PrototypesGalleryPage() {
  const { flagship, featured, library } = getPrototypeTiers();
  const [spotlight, ...heroes] = flagship;

  let enterIndex = 0;
  const nextDelay = () => Math.min(enterIndex++ * ENTER_STAGGER_MS, ENTER_STAGGER_CAP_MS);

  return (
    <LiquidChromePage transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-20">
        <PageContentFrame maxWidth="6xl">
          <PageNavBack className="mb-8" href="/sandbox">
            ← Sandbox
          </PageNavBack>

          <header className="mb-12 text-center sm:mb-14">
            <p className="mb-3 select-none text-2xs uppercase tracking-[0.28em] text-muted-foreground/70">
              Sandbox · {prototypes.length} experiments
            </p>
            <h1 className="mb-3 font-commissioner text-4xl font-extralight tracking-tight text-foreground sm:text-5xl">
              Prototypes
            </h1>
            <p className="mx-auto max-w-2xl select-none text-sm text-muted-foreground">
              Standalone slices of interface and experience design. Open &ldquo;What is this?&rdquo;
              on any prototype for design intent, usage notes, and DMZ intelligence transfer.
            </p>
          </header>

          <TierRule className="mt-0" label="Flagship" />
          <div className="grid gap-4 sm:gap-5">
            {spotlight && (
              <PrototypeCard enterDelayMs={nextDelay()} prototype={spotlight} variant="spotlight" />
            )}
            {heroes.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {heroes.map((p) => (
                  <PrototypeCard
                    key={p.slug}
                    enterDelayMs={nextDelay()}
                    prototype={p}
                    variant="hero"
                  />
                ))}
              </div>
            )}
          </div>

          <TierRule label="In rotation" />
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.map((p, i) => (
              <PrototypeCard
                key={p.slug}
                className={cn(featured.length % 2 === 1 && i === 0 && "sm:col-span-2")}
                enterDelayMs={nextDelay()}
                prototype={p}
                variant="featured"
              />
            ))}
          </div>

          <TierRule label="Library" />
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {library.map((p) => (
              <PrototypeCard
                key={p.slug}
                enterDelayMs={nextDelay()}
                prototype={p}
                variant="compact"
              />
            ))}
          </div>
        </PageContentFrame>
      </div>
    </LiquidChromePage>
  );
}
