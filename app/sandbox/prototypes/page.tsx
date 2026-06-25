import type { Metadata } from "next";

import Link from "next/link";

import { getPrototypeHref, prototypes } from "./_config/prototypes";

import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import ShinyText from "@/components/ShinyText";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Prototypes"),
};

export default function PrototypesGalleryPage() {
  return (
    <LiquidChromePage transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame>
        <PageNavBack className="mb-8" href="/sandbox">
          ← Sandbox
        </PageNavBack>

        <div className="text-center mb-12">
          <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Prototypes
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto select-none">
            Standalone slices of interface and experience design.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4">
          {prototypes.map((p) => (
            <Link
              key={p.slug}
              data-dim-background
              className={cn(
                glass(),
                "group relative overflow-hidden rounded-2xl border border-border/70 backdrop-blur-xl",
                "transition-all duration-300 ease-in-out hover:bg-muted/40 active:scale-[0.995]",
                "p-6 sm:p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10"
              )}
              href={getPrototypeHref(p.slug)}
            >
              <div className="min-w-0 flex-1">
                <h2 className="font-commissioner text-lg font-light text-foreground mb-2 sm:text-xl">
                  {p.title}
                </h2>
                <p className="text-sm text-muted-foreground sm:text-[15px] sm:leading-relaxed">
                  {p.description}
                </p>
              </div>

              <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border/50 pt-4 sm:border-t-0 sm:pt-0 sm:justify-end">
                <div className="text-xs text-muted-foreground select-none sm:text-sm">
                  <ShinyText
                    className="cursor-inherit"
                    shimmerOnParentGroupHover
                    speed={2.5}
                    text="Explore"
                  />
                </div>
                <svg
                  aria-hidden
                  className="w-4 h-4 text-muted-foreground opacity-100 transition-all duration-200 group-hover:translate-x-0.5 md:opacity-0 md:group-hover:opacity-100 sm:w-5 sm:h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M17 8l4 4m0 0l-4 4m4-4H3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
        </PageContentFrame>
      </div>
    </LiquidChromePage>
  );
}
