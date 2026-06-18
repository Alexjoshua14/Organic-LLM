"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, Focus, MousePointer2, Sparkles } from "lucide-react";

import { DimStatePanel } from "./dim-state-panel";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { PageContentFrame, PageNavBack } from "@/components/layout/page-content-frame";
import { Button } from "@/components/third-party/ui/button";
import { Input } from "@/components/third-party/ui/input";
import { cn } from "@/lib/utils";

const TIMING = [
  { ms: 700, label: "Dim in", note: "Hover or focus enters a trigger zone." },
  { ms: 1200, label: "Phase 1 · → 65%", note: "Brightening starts immediately on exit." },
  { ms: 2800, label: "Phase 2 · → 100%", note: "Slow exhale to full rest." },
] as const;

const PROPS_ROWS = [
  ["dimIntensity", "0.7", "Opacity reduction for data-dim-background"],
  ["dimIntensityFull", "0.6", "Stronger dim for data-dim-background=\"full\""],
  ["dimTransitionMs", "700", "Time to dim on hover/focus"],
  ["to65TransitionMs", "1200", "Phase-one brighten duration"],
  ["to100TransitionMs", "2800", "Phase-two brighten duration"],
] as const;

function LabSection({
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-4", className)}>
      <div className="space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h2 className="font-commissioner text-xl font-light tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function TriggerCard({
  title,
  badge,
  description,
  dimAttr,
  children,
}: {
  title: string;
  badge: string;
  description: string;
  dimAttr?: "full";
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        glass({ opaque: true, border: "all" }),
        "group relative overflow-hidden rounded-2xl p-5 sm:p-6 transition-shadow hover:shadow-lg",
      )}
      data-dim-background={dimAttr ?? true}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-foreground">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-border/60 bg-background/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
          {badge}
        </span>
      </div>
      {children}
    </article>
  );
}

export function AdaptiveLiquidChromeLab() {
  const [dimmed, setDimmed] = useState(false);

  return (
    <Page transparentBackground className="items-stretch justify-start overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} dimIntensityFull={0.62} onDimChange={setDimmed} />

      <div className="relative z-10 h-full min-h-0 w-full overflow-y-auto pb-20">
        <PageContentFrame maxWidth="5xl">
          <PageNavBack className="mb-8" href="/sandbox/prototypes">
            ← Prototypes
          </PageNavBack>

          <header className="mb-10 space-y-4 sm:mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-background/40 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
              <Sparkles className="size-3.5" />
              Background system
            </div>
            <h1 className="font-commissioner text-3xl font-light tracking-tight text-foreground sm:text-4xl md:text-[2.75rem] md:leading-tight">
              Adaptive Liquid Chrome
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              A full-viewport liquid shader that dims when attention moves to foreground controls,
              then brightens in two phases — quick to 65%, then a slow return to rest. Hover, focus,
              and tap the zones below to feel the contract.
            </p>
          </header>

          <div className="mb-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:items-start">
            <div className="space-y-8">
              <LabSection
                description="Standard dim is tuned for inputs and cards. Full dim matches gateway-style entry points."
                eyebrow="Triggers"
                title="Interactive lenses"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <TriggerCard
                    badge='data-dim-background'
                    description="Default intensity — chrome recedes but stays ambient."
                    title="Standard lens"
                  >
                    <div className="space-y-3">
                      <Button className="w-full" size="lg" variant="secondary">
                        <MousePointer2 className="mr-2 size-4" />
                        Hover me
                      </Button>
                      <Input placeholder="Focus to hold the dim…" type="text" />
                    </div>
                  </TriggerCard>

                  <TriggerCard
                    badge='data-dim-background="full"'
                    description="Stronger dim (~40% opacity) for primary calls to action."
                    dimAttr="full"
                    title="Deep lens"
                  >
                    <Link
                      className={cn(
                        glass({ border: "all" }),
                        "flex items-center justify-between rounded-xl px-4 py-3 text-sm text-foreground transition-transform hover:-translate-y-0.5",
                      )}
                      href="/sandbox"
                    >
                      <span>Open Sandbox gateway</span>
                      <ArrowUpRight className="size-4 text-muted-foreground" />
                    </Link>
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      Mimics homepage gateway links — hover the card, not just the link text.
                    </p>
                  </TriggerCard>
                </div>
              </LabSection>

              <LabSection
                description="How the homepage composer sits on chrome in production shells."
                eyebrow="Context"
                title="Composer shell"
              >
                <div
                  className={cn(
                    glass({ opaque: true, border: "all" }),
                    "mx-auto max-w-xl rounded-[1.75rem] p-5 sm:p-6",
                  )}
                  data-dim-background
                >
                  <p className="mb-3 text-center text-xs text-muted-foreground">
                    Ask Organic LLM anything…
                  </p>
                  <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-background/50 px-3 py-2 shadow-inner">
                    <Input
                      className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                      placeholder="What should we explore today?"
                    />
                    <Button size="sm">Send</Button>
                  </div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {["Remember this", "Search the web", "Sketch a diagram"].map((chip) => (
                      <button
                        key={chip}
                        className="rounded-full border border-border/50 bg-background/30 px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                        type="button"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </LabSection>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
              <DimStatePanel dimmed={dimmed} />
              <div
                className={cn(
                  glass({ border: "all" }),
                  "space-y-3 rounded-2xl p-4 text-xs text-muted-foreground",
                )}
              >
                <div className="flex items-center gap-2 text-foreground">
                  <Focus className="size-3.5" />
                  <span className="font-medium">Try this</span>
                </div>
                <ul className="space-y-1.5 leading-relaxed">
                  <li>Tab into an input to keep the chrome dimmed.</li>
                  <li>Move between cards to feel instant re-dim on enter.</li>
                  <li>Toggle light/dark in the top bar to compare palettes.</li>
                </ul>
              </div>
            </aside>
          </div>

          <LabSection
            className="mb-12"
            description="Brightness does not snap — it follows intentional easing on the way in and a two-step exhale on the way out."
            eyebrow="Timing"
            title="Phase choreography"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {TIMING.map((step, index) => (
                <div
                  key={step.label}
                  className={cn(
                    glass({ border: "all" }),
                    "relative rounded-xl px-4 py-4",
                  )}
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Step {index + 1}
                  </span>
                  <p className="mt-1 text-sm font-medium text-foreground">{step.label}</p>
                  <p className="mt-1 font-mono text-xs text-primary">{step.ms}ms</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.note}</p>
                </div>
              ))}
            </div>
          </LabSection>

          <LabSection
            className="mb-10"
            eyebrow="Integration"
            title="Mark foreground elements"
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <pre
                className={cn(
                  glass({ border: "all" }),
                  "overflow-x-auto rounded-2xl p-4 text-[11px] leading-relaxed text-foreground/90",
                )}
              >
                {`<AdaptiveLiquidChrome dimIntensity={0.45} />

<div data-dim-background>
  <Input placeholder="Focus or hover…" />
</div>

<Link href="/sandbox" data-dim-background="full">
  Sandbox
</Link>`}
              </pre>

              <div className={cn(glass({ border: "all" }), "overflow-hidden rounded-2xl")}>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/50 text-muted-foreground">
                      <th className="px-4 py-2 font-medium">Prop</th>
                      <th className="px-4 py-2 font-medium">Default</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Role</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PROPS_ROWS.map(([prop, def, role]) => (
                      <tr key={prop} className="border-b border-border/30 last:border-0">
                        <td className="px-4 py-2 font-mono text-foreground">{prop}</td>
                        <td className="px-4 py-2 tabular-nums text-muted-foreground">{def}</td>
                        <td className="hidden px-4 py-2 text-muted-foreground sm:table-cell">
                          {role}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </LabSection>

          <p className="text-center text-xs text-muted-foreground">
            Shader: LiquidChrome · Docs in{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
              components/background/ADAPTIVE_LIQUID_CHROME.md
            </code>
          </p>
        </PageContentFrame>
      </div>
    </Page>
  );
}
