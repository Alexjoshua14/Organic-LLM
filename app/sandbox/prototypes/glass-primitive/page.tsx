import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import { CapabilityChipLabDemo } from "./_components/capability-chip-lab-demo";
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

/** Shared across columns so only the parent surface material differs. */
const glassLabActionButtonClass =
  "rounded-full border border-white/25 bg-background/45 px-4 py-2 text-sm text-foreground shadow-inner transition hover:-translate-y-0.5 hover:border-accent/30 hover:bg-background/60 active:translate-y-0 dark:border-white/10 dark:bg-background-secondary/45";

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
    <div className="relative m-0.5 min-w-0 overflow-visible sm:m-1">
      <OrganicGlassRefractFilterSvg />
      <div
        className={cn(
          organicGlassWorking({ border: "all", depth, interactive: true, opaque, tone }),
          "rounded-[2rem]",
          compact ? "p-4" : "p-6 sm:p-8",
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
      <div className="mb-12 flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">{eyebrow}</p>
          <h3 className="mt-3 text-3xl font-light tracking-tight text-foreground">{title}</h3>
        </div>
        {statusPill}
      </div>
      <div className="space-y-4">
        <SurfaceCase title={surfaceCaseTitle}>{surfaceCaseBody}</SurfaceCase>
        <div className="flex flex-wrap gap-3">
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
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <VersionBadge label={badgeLabel} state={badgeState} />
            <h2 className="mt-4 text-3xl font-light tracking-[-0.035em] text-foreground">
              {columnTitle}
            </h2>
            <div className="mt-3 text-sm leading-6 text-muted-foreground">{intro}</div>
          </div>
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
      <div className={cn(leadingSurfaceClassName, "rounded-3xl p-5")}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Dense text</p>
        <div className="mt-3 text-sm leading-6 text-muted-foreground">{denseBody}</div>
      </div>
      <div className={cn(trailingSurfaceClassName, "rounded-3xl p-5")}>
        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Warm tone</p>
        <div className="mt-3 text-sm leading-6 text-muted-foreground">{warmBody}</div>
      </div>
    </div>
  );
}

function GlassLabGalleryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

/** Extra specimens under the hero + tiles; same layout, material swaps by column. */
function GlassLabSampleGallery({ variant }: { variant: "production" | "preview" }) {
  const isProd = variant === "production";

  const opaqueLarge = isProd
    ? glass({ opaque: true })
    : glassPreview({ opaque: true, interactive: true, depth: "raised" });

  const readoutWell = isProd
    ? glass({ border: "none", opaque: true })
    : glassPreview({
        opaque: true,
        border: "none",
        interactive: true,
        depth: "raised",
      });

  const stripShell = isProd
    ? cn(glass({ opaque: true }), "rounded-xl border border-border/50 dark:border-white/10")
    : cn(glassPreview({ depth: "flat" }), "rounded-xl");

  const innerInputWell =
    "rounded-lg border border-border/40 bg-background/35 px-3 py-2 dark:border-white/10 dark:bg-background-secondary/35";

  return (
    <div className="space-y-5 border-t border-white/10 pt-6 dark:border-white/10">
      <p className="text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
        Sample gallery
      </p>

      <GlassLabGalleryRow label="Opaque panel">
        <div className={cn(opaqueLarge, "rounded-2xl p-5")}>
          <p className="text-sm text-muted-foreground">
            {isProd
              ? "Large glass({ opaque: true }) shell — same contract as chat input groups over chrome."
              : "glassPreview opaque + raised — preview lens for dense UI."}
          </p>
          <div className={cn(innerInputWell, "mt-3")}>
            <label className="sr-only" htmlFor={`lab-opaque-${variant}`}>
              Sample field
            </label>
            <input
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              defaultValue="Sample prompt (read-only)"
              id={`lab-opaque-${variant}`}
              readOnly
              type="text"
            />
          </div>
        </div>
      </GlassLabGalleryRow>

      <GlassLabGalleryRow label="Borderless readout">
        <div className={cn(readoutWell, "max-h-28 overflow-y-auto rounded-xl p-3")}>
          <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
            {isProd
              ? 'memory.store.get("session")\n// glass({ border: "none", opaque: true })'
              : 'memory.store.get("session")\n// glassPreview opaque + border none'}
          </pre>
        </div>
      </GlassLabGalleryRow>

      <GlassLabGalleryRow label={isProd ? "Toolbar strip (opaque)" : "Flat strip + chips"}>
        <div className={cn(stripShell, "flex flex-wrap items-center gap-2 px-3 py-2.5")}>
          {["Attach", "Search", "Memory"].map((chip) => (
            <span
              className="rounded-full border border-white/20 bg-background/30 px-2.5 py-1 text-xs text-foreground dark:border-white/10 dark:bg-background-secondary/30"
              key={chip}
            >
              {chip}
            </span>
          ))}
        </div>
      </GlassLabGalleryRow>

      {isProd ? (
        <GlassLabGalleryRow label="Capability chips on opaque shell">
          <p className="mb-3 text-xs text-muted-foreground">
            Active chips use <code className="text-foreground/90">glass(&#123; chip: true &#125;)</code>{" "}
            — one unified aperture lens over the opaque composer shell. Toggle to compare recessed vs
            open states.
          </p>
          <CapabilityChipLabDemo />
        </GlassLabGalleryRow>
      ) : null}

      <GlassLabGalleryRow label="Secondary actions">
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
      </GlassLabGalleryRow>
    </div>
  );
}

export default function GlassPrimitivePrototypePage() {
  return (
    <LiquidChromePage transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.72} speed={0.01} />

      <div className="relative z-10 flex h-full w-full flex-col overflow-hidden">
        <header className="shrink-0 border-b border-white/10 bg-background/18 px-5 py-4 backdrop-blur-md dark:bg-background/10 sm:px-8">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              &larr; Prototypes
            </Link>
            <div className="min-w-0 sm:text-right">
              <p className="text-xs font-medium uppercase tracking-[0.28em] text-accent/80">
                Organic Glass lab
              </p>
              <h1 className="truncate text-xl font-light tracking-tight text-foreground sm:text-2xl">
                Smoke glass lens, baseline, and working prototype
              </h1>
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-3">
          <GlassLabColumn
            badgeLabel="Production"
            badgeState="production"
            columnTitle="Smoke glass lens"
            intro={
              <>
                The shipped <code className="text-foreground/90">glass()</code> helper uses theme{" "}
                <code className="text-foreground/90">background</code> and{" "}
                <code className="text-foreground/90">border</code> tokens — blur tints with your
                palette; chrome supplies atmosphere behind the lens.
              </>
            }
            sectionClassName="border-b border-white/10 px-5 py-6 lg:border-b-0 lg:border-r lg:px-8"
          >
            <div
              className={cn(
                glass(),
                "relative mx-auto min-h-[410px] max-w-xl rounded-[2rem] p-10 sm:p-12"
              )}
            >
              <div className="relative z-10 space-y-6">
                <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">
                  In production
                </p>
                <h3 className="text-3xl font-light leading-tight tracking-tight text-foreground sm:text-4xl">
                  Transform your vision into reality
                </h3>
                <p className="max-w-md text-sm leading-7 text-muted-foreground">
                  Uses <code className="text-foreground/90">bg-background/30</code> and{" "}
                  <code className="text-foreground/90">border-border/50</code> — warm gray in light
                  mode, green-tinted charcoal in dark — not raw white or black.
                </p>
                <button
                  className="rounded-full border border-border/60 bg-transparent px-5 py-2.5 text-xs font-medium uppercase tracking-[0.22em] text-foreground transition hover:border-border hover:bg-background/20"
                  type="button"
                >
                  Build with Organic
                </button>
              </div>
            </div>

            <GlassLabBottomTiles
              denseBody={
                <p>
                  Opaque variant raises fill for readable type over bright chrome without losing the
                  smoke material family.
                </p>
              }
              leadingSurfaceClassName={glass({ opaque: true })}
              trailingSurfaceClassName={glass({ tone: "brown" })}
              warmBody={
                <p>Brown tone adds a warm wash and extra saturation for editorial surfaces.</p>
              }
            />

            <GlassLabSampleGallery variant="production" />
          </GlassLabColumn>

          <GlassLabColumn
            badgeLabel="Stable 2.0"
            badgeState="stable"
            columnTitle="Approved baseline"
            intro={
              <>
                This is the first approved layer: the initial Organic Glass direction preserved as
                the baseline before refraction experiments are merged back in.
              </>
            }
            sectionClassName="border-b border-white/10 px-5 py-6 lg:border-b-0 lg:border-r lg:px-8"
          >
            <OrganicGlassBaselineSurface className="min-h-[410px]">
              <GlassLabHeroBody
                eyebrow="Candidate primitive"
                surfaceCaseBody={
                  <p className="leading-6 text-muted-foreground">
                    Semi-opaque optical fill, moderate static blur, inner edge light, and cheap
                    hover response. The ambient chrome reads as atmosphere instead of noise.
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
                  Readability remains anchored by fill, ring, and border rather than raw
                  transparency.
                </p>
              }
              leadingSurfaceClassName={glassPreview({ opaque: true })}
              trailingSurfaceClassName={glassPreview({ tone: "brown" })}
              warmBody={<p>Arcadia-style warmth without losing the glass material behavior.</p>}
            />

            <GlassLabSampleGallery variant="preview" />
          </GlassLabColumn>

          <GlassLabColumn
            badgeLabel="Working 2.01"
            badgeState="working"
            columnTitle="Material preview"
            intro={
              <>
                Experimental organic glass: refraction-capable backdrop and a chromatic rim via{" "}
                <code className="text-foreground/90">organicGlassWorking</code> — no inset key
                light. Approve here, then promote into shared design-system surfaces.
              </>
            }
            sectionClassName="px-5 py-6 lg:px-8"
          >
            <WorkingOrganicGlassSurface className="min-h-[410px]">
              <GlassLabHeroBody
                eyebrow="Working prototype"
                surfaceCaseBody={
                  <p className="leading-6 text-muted-foreground">
                    Near-transparent fill with displacement-backed refraction and a soft chromatic
                    rim; shadows carry depth without a painted light cast.
                  </p>
                }
                surfaceCaseTitle="Stable layer"
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
                  Dense preview tiles still use glassPreview; the hero above is the
                  organicGlassWorking experiment.
                </p>
              }
              leadingSurfaceClassName={glassPreview({ opaque: true })}
              trailingSurfaceClassName={glassPreview({ tone: "brown" })}
              warmBody={
                <p>
                  Arcadia-style warmth without losing the glass material behavior. When this column
                  ships, fold its overlays into{" "}
                  <code className="text-foreground/90">OrganicGlassBaselineSurface</code>.
                </p>
              }
            />

            <GlassLabSampleGallery variant="preview" />
          </GlassLabColumn>
        </main>
      </div>
    </LiquidChromePage>
  );
}
