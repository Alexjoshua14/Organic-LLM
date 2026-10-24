import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import { CapabilityChipLabDemo } from "./_components/capability-chip-lab-demo";
import { glassPrimitiveChrome } from "./_lib/glass-primitive-layout";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { OrganicGlassBaselineSurface } from "@/components/design-system/organic-glass-baseline-surface";
import { OrganicGlassRefractFilterSvg } from "@/components/design-system/organic-glass-refract-filter";
import {
  glass,
  glassPreview,
  organicGlassWorking,
  secondaryInteractive,
} from "@/components/design-system/primitives";
import LiquidChromePage from "@/components/layout/liquid-chrome-page";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Organic Glass"),
};

const GLASS_LAB_DEMO_ACTIONS = ["Ask", "Remember", "Reason", "Speak"] as const;

const glassLabActionButtonClass = cn(
  "rounded-full border border-white/25 bg-background/45 px-4 py-2 text-sm text-foreground shadow-inner",
  "transition-[background-color,border-color] duration-200",
  "motion-safe:transition-[transform,background-color,border-color]",
  "hover:border-accent/30 hover:bg-background/60",
  "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-0",
  "dark:border-white/10 dark:bg-background-secondary/45"
);

/**
 * Lab-only working Organic Glass: `organicGlassWorking` + SVG refraction filter. Promote into
 * design tokens / shared surface when approved.
 */
function WorkingOrganicGlassSurface({
  children,
  className,
  tone = "default",
  depth = "floating",
  opaque,
  compact,
}: {
  children: ReactNode;
  className?: string;
  tone?: "default" | "brown";
  depth?: "flat" | "raised" | "floating";
  opaque?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative m-0.5 min-w-0 overflow-x-clip sm:m-1">
      <OrganicGlassRefractFilterSvg />
      <div
        className={cn(
          organicGlassWorking({ border: "all", depth, interactive: true, opaque, tone }),
          "rounded-[2rem]",
          compact ? "p-4" : "p-5 sm:p-7",
          className
        )}
        data-dim-background
      >
        <div className="relative z-10">{children}</div>
      </div>
    </div>
  );
}

function VersionBadge({
  label,
  state,
}: {
  label: string;
  state: "production" | "stable" | "working";
}) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        state === "production" &&
          "border-zinc-500/25 bg-zinc-500/10 text-zinc-700 dark:border-zinc-400/20 dark:bg-zinc-400/10 dark:text-zinc-200",
        state === "stable" &&
          "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        state === "working" && "border-accent/25 bg-accent/10 text-accent"
      )}
    >
      {label}
    </span>
  );
}

function SurfaceCase({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-background/34 p-4 text-sm backdrop-blur-sm dark:border-white/10 dark:bg-background-secondary/34">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function GlassLabHeroBody({
  eyebrow,
  title,
  statusPill,
  surfaceCaseTitle,
  surfaceCaseBody,
}: {
  eyebrow: string;
  title: string;
  statusPill: ReactNode;
  surfaceCaseTitle: string;
  surfaceCaseBody: ReactNode;
}) {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-3 sm:mb-10 sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">{eyebrow}</p>
          <h3 className="mt-2 text-2xl font-light tracking-tight text-foreground sm:mt-3 sm:text-3xl">
            {title}
          </h3>
        </div>
        <div className="shrink-0">{statusPill}</div>
      </div>
      <div className="space-y-4">
        <SurfaceCase title={surfaceCaseTitle}>{surfaceCaseBody}</SurfaceCase>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {GLASS_LAB_DEMO_ACTIONS.map((action) => (
            <button className={glassLabActionButtonClass} key={action} type="button">
              {action}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function GlassLabColumn({
  sectionClassName,
  badgeLabel,
  badgeState,
  columnTitle,
  intro,
  children,
}: {
  sectionClassName: string;
  badgeLabel: string;
  badgeState: "production" | "stable" | "working";
  columnTitle: string;
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={sectionClassName}>
      <div className="mx-auto w-full max-w-xl space-y-5 lg:mx-0 lg:max-w-none">
        <div>
          <VersionBadge label={badgeLabel} state={badgeState} />
          <h2 className="mt-3 text-2xl font-light tracking-[-0.035em] text-foreground sm:mt-4 sm:text-3xl">
            {columnTitle}
          </h2>
          <div className="mt-3 max-w-prose text-sm leading-6 text-muted-foreground">{intro}</div>
        </div>
        {children}
      </div>
    </section>
  );
}

function GlassLabBottomTiles({
  leadingSurfaceClassName,
  trailingSurfaceClassName,
  denseBody,
  warmBody,
}: {
  leadingSurfaceClassName: string;
  trailingSurfaceClassName: string;
  denseBody: ReactNode;
  warmBody: ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className={cn(leadingSurfaceClassName, "min-w-0 rounded-3xl p-4 sm:p-5")}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Dense text</p>
        <div className="mt-3 text-sm leading-6 text-muted-foreground">{denseBody}</div>
      </div>
      <div className={cn(trailingSurfaceClassName, "min-w-0 rounded-3xl p-4 sm:p-5")}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Warm tone</p>
        <div className="mt-3 text-sm leading-6 text-muted-foreground">{warmBody}</div>
      </div>
    </div>
  );
}

/** Compact material specimens — one strip per column, not a duplicated full gallery. */
function GlassLabShapeStrip({
  shellClassName,
  caption,
}: {
  shellClassName: string;
  caption: string;
}) {
  return (
    <div className="space-y-2 border-t border-white/10 pt-5 dark:border-white/10">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        Shape strip
      </p>
      <div className={cn(shellClassName, "flex min-w-0 flex-wrap items-center gap-2 px-3 py-2.5")}>
        {["Attach", "Search", "Memory"].map((chip) => (
          <span
            className="rounded-full border border-white/20 bg-background/30 px-2.5 py-1 text-xs text-foreground dark:border-white/10 dark:bg-background-secondary/30"
            key={chip}
          >
            {chip}
          </span>
        ))}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{caption}</p>
    </div>
  );
}

export default function GlassPrimitivePrototypePage() {
  return (
    <LiquidChromePage transparentBackground className="overflow-x-clip">
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.72} speed={0.01} />

      <div className={glassPrimitiveChrome.page}>
        <div className={glassPrimitiveChrome.inner}>
          <nav className="mb-6 sm:mb-8">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              &larr; Prototypes
            </Link>
          </nav>

          <header className="mb-8 max-w-3xl sm:mb-10">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.28em] text-accent/80">
              Organic Glass lab
            </p>
            <h1 className="text-3xl font-light tracking-tight text-foreground sm:text-4xl sm:tracking-[-0.04em]">
              Glass as a foreground lens
            </h1>
            <p
              className={cn(
                "mt-4 text-base leading-7 text-muted-foreground",
                glassPrimitiveChrome.headerBlurb
              )}
            >
              Three live materials over AdaptiveLiquidChrome: the shipped{" "}
              <code className="text-foreground/90">glass()</code> helper, the approved Organic Glass
              baseline, and a working refraction preview. Compare side by side on desktop; scroll
              the stack on a phone.
            </p>
          </header>

          <main className={glassPrimitiveChrome.compareGrid}>
            <GlassLabColumn
              badgeLabel="Production"
              badgeState="production"
              columnTitle="Smoke glass lens"
              intro={
                <>
                  Shipped <code className="text-foreground/90">glass()</code> — theme{" "}
                  <code className="text-foreground/90">background</code> and{" "}
                  <code className="text-foreground/90">border</code> tokens so blur tints with your
                  palette while chrome stays atmosphere behind the lens.
                </>
              }
              sectionClassName={glassPrimitiveChrome.columnFirst}
            >
              <div
                className={cn(
                  glass(),
                  "relative mx-auto min-h-[min(22rem,70vw)] w-full max-w-xl rounded-[1.75rem] p-6 sm:min-h-[26rem] sm:rounded-[2rem] sm:p-10 lg:mx-0 lg:max-w-none"
                )}
              >
                <div className="relative z-10 space-y-5">
                  <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    In production
                  </p>
                  <h3 className="text-2xl font-light leading-tight tracking-tight text-foreground sm:text-3xl">
                    Readable smoke over live chrome
                  </h3>
                  <p className="max-w-md text-sm leading-7 text-muted-foreground">
                    Uses <code className="text-foreground/90">bg-background/30</code> and{" "}
                    <code className="text-foreground/90">border-border/50</code> — warm gray in
                    light mode, green-tinted charcoal in dark — not raw white or black.
                  </p>
                  <button
                    className={cn(
                      "rounded-full border border-border/60 bg-transparent px-5 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-foreground",
                      "transition-[background-color,border-color] duration-200",
                      "hover:border-border hover:bg-background/20"
                    )}
                    type="button"
                  >
                    Build with Organic
                  </button>
                </div>
              </div>

              <GlassLabBottomTiles
                denseBody={
                  <p>
                    Opaque fill raises contrast for dense type over bright chrome without leaving
                    the smoke material family.
                  </p>
                }
                leadingSurfaceClassName={glass({ opaque: true })}
                trailingSurfaceClassName={glass({ tone: "brown" })}
                warmBody={
                  <p>Brown tone adds a warm wash and extra saturation for editorial surfaces.</p>
                }
              />

              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Capability chips
                </p>
                <p className="text-xs leading-5 text-muted-foreground">
                  Active chips use{" "}
                  <code className="text-foreground/90">glass(&#123; chip: true &#125;)</code> on an
                  opaque shell. Toggle to compare recessed vs open.
                </p>
                <CapabilityChipLabDemo />
              </div>

              <GlassLabShapeStrip
                caption="Opaque toolbar strip — same contract as composer tool rows."
                shellClassName={cn(
                  glass({ opaque: true }),
                  "rounded-xl border border-border/50 dark:border-white/10"
                )}
              />
            </GlassLabColumn>

            <GlassLabColumn
              badgeLabel="Stable 2.0"
              badgeState="stable"
              columnTitle="Approved baseline"
              intro={
                <>
                  First approved Organic Glass layer — preserved as the baseline before refraction
                  experiments merge back in.
                </>
              }
              sectionClassName={glassPrimitiveChrome.column}
            >
              <OrganicGlassBaselineSurface className="min-h-[min(22rem,70vw)] sm:min-h-[26rem]">
                <GlassLabHeroBody
                  eyebrow="Candidate primitive"
                  surfaceCaseBody={
                    <p className="leading-6 text-muted-foreground">
                      Semi-opaque optical fill, moderate static blur, inner edge light, and cheap
                      hover response. Ambient chrome reads as atmosphere instead of noise.
                    </p>
                  }
                  surfaceCaseTitle="Stable layer"
                  statusPill={
                    <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      alive
                    </div>
                  }
                  title="Organic Glass"
                />
              </OrganicGlassBaselineSurface>

              <GlassLabBottomTiles
                denseBody={
                  <p>
                    Readability stays anchored by fill, ring, and border rather than raw
                    transparency.
                  </p>
                }
                leadingSurfaceClassName={glassPreview({ opaque: true })}
                trailingSurfaceClassName={glassPreview({ tone: "brown" })}
                warmBody={<p>Arcadia-style warmth without losing the glass material behavior.</p>}
              />

              <GlassLabShapeStrip
                caption="Flat glassPreview strip — preview lens for chip rows."
                shellClassName={cn(glassPreview({ depth: "flat" }), "rounded-xl")}
              />

              <div className="flex flex-wrap gap-2">
                <button
                  className={cn(secondaryInteractive(), "rounded-full px-4 py-2 text-sm")}
                  type="button"
                >
                  Secondary
                </button>
                <button
                  className={cn(secondaryInteractive(), "rounded-full px-4 py-2 text-sm")}
                  type="button"
                >
                  Outline peer
                </button>
              </div>
            </GlassLabColumn>

            <GlassLabColumn
              badgeLabel="Working 2.01"
              badgeState="working"
              columnTitle="Material preview"
              intro={
                <>
                  Experimental organic glass: refraction-capable backdrop and a chromatic rim via{" "}
                  <code className="text-foreground/90">organicGlassWorking</code> — depth from
                  shadow lift, not a painted key light.
                </>
              }
              sectionClassName={glassPrimitiveChrome.columnLast}
            >
              <WorkingOrganicGlassSurface className="min-h-[min(22rem,70vw)] sm:min-h-[26rem]">
                <GlassLabHeroBody
                  eyebrow="Working prototype"
                  surfaceCaseBody={
                    <p className="leading-6 text-muted-foreground">
                      Near-transparent fill with displacement-backed refraction and a soft chromatic
                      rim; shadows carry depth without a painted light cast.
                    </p>
                  }
                  surfaceCaseTitle="Working layer"
                  statusPill={
                    <div className="rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                      preview
                    </div>
                  }
                  title="Organic Glass"
                />
              </WorkingOrganicGlassSurface>

              <GlassLabBottomTiles
                denseBody={
                  <p>
                    Dense tiles still use glassPreview; the hero above is the organicGlassWorking
                    experiment.
                  </p>
                }
                leadingSurfaceClassName={glassPreview({ opaque: true })}
                trailingSurfaceClassName={glassPreview({ tone: "brown" })}
                warmBody={
                  <p>Warm preview tone for editorial surfaces while the hero carries refraction.</p>
                }
              />

              <GlassLabShapeStrip
                caption="Preview strip under the working hero — same chip layout for material comparison."
                shellClassName={cn(glassPreview({ depth: "flat" }), "rounded-xl")}
              />
            </GlassLabColumn>
          </main>
        </div>
      </div>
    </LiquidChromePage>
  );
}
