import Link from "next/link";

import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { PageContentFrame } from "@/components/layout/page-content-frame";
import ShinyText from "@/components/ShinyText";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import { sandboxGatewayEntries } from "@/lib/sandbox/gateway";
import { cn } from "@/lib/utils";

export default function SandboxPage() {
  return (
    <LiquidChromePage transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-16">
        <PageContentFrame maxWidth="6xl">
          <div className="text-center mb-12">
            <h1 className="mb-2 font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl">
              Sandbox Gateway
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl mx-auto select-none">
              Where new ideas get built, broken, and refined before they go anywhere else. Each card
              explains what you are opening — no insider knowledge required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-[minmax(120px,auto)]">
            {sandboxGatewayEntries.map((page) => (
              <Link
                key={page.href}
                data-dim-background
                className={cn(
                  glass(),
                  "group relative overflow-hidden rounded-2xl border border-border/70 backdrop-blur-xl",
                  "transition-all duration-300 ease-in-out hover:bg-muted/40 active:scale-[0.995]",
                  page.size === "large" ? "md:col-span-1 lg:row-span-2" : "md:col-span-1",
                  "p-5 flex flex-col justify-between"
                )}
                href={page.href}
              >
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h2 className="font-commissioner text-lg font-light text-foreground">
                      {page.title}
                    </h2>
                    {page.badge ? (
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                          page.badge === "experimental"
                            ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                            : "border-sky-400/30 bg-sky-400/10 text-sky-300"
                        )}
                      >
                        {page.badge === "experimental" ? "Experimental" : "Admin tools"}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{page.description}</p>
                </div>

                <div className="flex items-center justify-between mt-4">
                  <div className="text-xs text-muted-foreground select-none">
                    <ShinyText
                      className="cursor-inherit"
                      shimmerOnParentGroupHover
                      speed={2.5}
                      text="Explore"
                    />
                  </div>
                  <svg
                    aria-hidden
                    className="w-4 h-4 text-muted-foreground opacity-100 transition-all duration-200 group-hover:translate-x-0.5 md:opacity-0 md:group-hover:opacity-100"
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
