import Link from "next/link";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";

/** Warm amber / natural sunlight — same as sidebar Showcase link (heliophysics-inspired). */
const SHOWCASE_GLOW_HUE = "75";

type ShowcasePageEntry = {
  title: string;
  description: string;
  href: string;
  icon: string;
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
      title: "Memory",
      description:
        "Persisted memory lens, cards, and ephemeral in-chat components — what Organic LLM stores and how it surfaces across threads.",
      href: "/showcase/memory",
      icon: "🧠",
      size: "small",
      edgeGlow: true,
    },
  ];

  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 w-full max-w-6xl mx-auto p-6">
        <div className="text-center mb-14">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 text-foreground">
            Showcase
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto tracking-tight">
            Public demos and previews I’m comfortable sharing. Each page is a snapshot; components
            inside stay up to date.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-[minmax(200px,auto)]">
          {showcasePages.map((page) => (
            <Link
              key={page.href}
              data-dim-background
              className={`
                group relative overflow-hidden rounded-2xl
                border border-border/80
                ${glass()}
                transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]
                hover:border-foreground/10 hover:shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_12px_28px_-8px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_12px_28px_-8px_rgba(0,0,0,0.32)]
                active:scale-[0.995]
                ${page.size === "large" ? "md:col-span-1 lg:row-span-2" : "md:col-span-1"}
                p-6 flex flex-col justify-between min-h-[200px]
              `}
              href={page.href}
            >
              {page.edgeGlow && (
                <div
                  aria-hidden
                  className="absolute inset-y-0 left-0 w-5 rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
                  style={{
                    background: `linear-gradient(to right, oklch(0.72 0.09 ${SHOWCASE_GLOW_HUE} / 0.45), oklch(0.78 0.05 ${SHOWCASE_GLOW_HUE} / 0.18), transparent)`,
                  }}
                />
              )}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-4">
                  <span aria-hidden className="text-2xl opacity-90">
                    {page.icon}
                  </span>
                  <h2 className="text-xl font-semibold tracking-tight text-foreground">
                    {page.title}
                  </h2>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-6">
                  {page.description}
                </p>
              </div>
              <div className="relative z-10 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  View
                </span>
                <svg
                  aria-hidden
                  className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all duration-200"
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

        <div className="mt-14 text-center">
          <p className="text-sm text-muted-foreground/80">
            Promoted from sandbox. Rebase from sandbox when you want to refresh a page’s layout.
          </p>
        </div>
      </div>
    </Page>
  );
}
