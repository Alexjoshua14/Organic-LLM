import Link from "next/link";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import Page from "@/components/layout/page";
import ShinyText from "@/components/ShinyText";
import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

/** Warm amber / natural sunlight — same as sidebar Showcase link (heliophysics-inspired). */
const SHOWCASE_GLOW_HUE = "75";

type ShowcasePageEntry = {
  title: string;
  description: string;
  href: string;
  size: "small" | "large";
  edgeGlow?: boolean;
};

/**
 * Public showcase gateway. Pages here are snapshots promoted from sandbox —
 * layout/content is fixed until you rebase from sandbox; shared components
 * (e.g. MemoryLensCard) update automatically.
 */
export default function ShowcasePage() {
  const showcasePages: ShowcasePageEntry[] = [
    {
      title: "Anatomy of a Response",
      description:
        "Scrollytelling trace of one assistant turn: context, memory, tools, streaming, structured cards, and TTS — recorded data, real chat UI.",
      href: "/showcase/anatomy",
      size: "large",
      edgeGlow: true,
    },
    {
      title: "Memory",
      description:
        "Persisted memory lens, cards, and ephemeral in-chat components — what Organic LLM stores and how it surfaces across threads.",
      href: "/showcase/memory",
      size: "small",
      edgeGlow: true,
    },
  ];

  return (
    <Page liquidChromeBackground transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 w-full max-w-5xl mx-auto p-6 overflow-y-auto h-full">
        <div className="text-center mb-12">
          <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            Showcase
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl mx-auto select-none">
            Public demos and previews I’m comfortable sharing. Each page is a snapshot; components
            inside stay up to date.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 auto-rows-[minmax(120px,auto)]">
          {showcasePages.map((page) => (
            <Link
              key={page.href}
              data-dim-background
              className={cn(
                glass(),
                "group relative overflow-hidden rounded-2xl border border-border/70 backdrop-blur-xl",
                "transition-all duration-300 ease-in-out hover:bg-muted/40 active:scale-[0.995]",
                page.size === "large" ? "md:col-span-1 lg:row-span-2" : "md:col-span-1",
                "p-6 sm:p-8 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-10"
              )}
              href={page.href}
            >
              {page.edgeGlow && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 left-0 w-5 rounded-l-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  style={{
                    background: `linear-gradient(to right, oklch(0.72 0.09 ${SHOWCASE_GLOW_HUE} / 0.45), oklch(0.78 0.05 ${SHOWCASE_GLOW_HUE} / 0.18), transparent)`,
                  }}
                />
              )}

              <div className="relative z-10 min-w-0 flex-1">
                <h2 className="mb-2 font-commissioner text-lg font-light text-foreground sm:text-xl">
                  {page.title}
                </h2>
                <p className="text-sm text-muted-foreground sm:text-[15px] sm:leading-relaxed">
                  {page.description}
                </p>
              </div>

              <div className="relative z-10 flex shrink-0 items-center justify-between gap-4 border-t border-border/50 pt-4 sm:border-t-0 sm:pt-0 sm:justify-end">
                <div className="text-xs text-muted-foreground select-none sm:text-sm">
                  <ShinyText
                    className="cursor-inherit"
                    shimmerOnParentGroupHover
                    speed={2.5}
                    text="View"
                  />
                </div>
                <svg
                  aria-hidden
                  className="h-4 w-4 text-muted-foreground opacity-100 transition-all duration-200 group-hover:translate-x-0.5 md:opacity-0 md:group-hover:opacity-100 sm:h-5 sm:w-5"
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
      </div>
    </Page>
  );
}
