import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { OrganicGlassBaselineSurface } from "@/components/design-system/organic-glass-baseline-surface";
import { glass, glassPreview } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Organic Glass"),
};

const GLASS_LAB_DEMO_ACTIONS = ["Ask", "Remember", "Reason", "Speak"] as const;

/** Shared across columns so only the parent surface material differs. */
const glassLabActionButtonClass =
  "rounded-full border border-white/25 bg-background/45 px-4 py-2 text-sm text-foreground shadow-inner transition hover:-translate-y-0.5 hover:border-accent/30 hover:bg-background/60 active:translate-y-0 dark:border-white/10 dark:bg-background-secondary/45";

function RefractiveGlassSurface({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        glassPreview({ depth: "floating", interactive: true }),
        "group rounded-[2.25rem] p-6 sm:p-8",
        className
      )}
      data-dim-background="full"
    >
      <div className="pointer-events-none absolute -inset-12 rounded-[inherit] bg-[radial-gradient(circle_at_18%_12%,rgba(255,255,255,0.48),transparent_26%),radial-gradient(circle_at_84%_8%,rgba(18,140,116,0.25),transparent_34%),radial-gradient(circle_at_52%_96%,rgba(255,183,77,0.18),transparent_30%)] opacity-75 blur-sm transition-opacity duration-200 group-hover:opacity-100 dark:opacity-55" />
      <div className="pointer-events-none absolute inset-px rounded-[inherit] border border-white/35 dark:border-white/10" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(112deg,rgba(255,255,255,0.72),transparent_18%,transparent_70%,rgba(255,255,255,0.18)),radial-gradient(ellipse_at_28%_8%,rgba(255,255,255,0.5),transparent_34%)] opacity-55 mix-blend-screen dark:opacity-25" />
      <div className="pointer-events-none absolute inset-2 rounded-[1.9rem] border border-cyan-200/20 opacity-70 blur-[0.4px] dark:border-cyan-100/10" />
      <div className="pointer-events-none absolute inset-2 translate-x-px rounded-[1.9rem] border border-red-200/18 opacity-55 blur-[0.4px] dark:border-red-100/10" />
      <div className="pointer-events-none absolute inset-x-7 top-0 h-10 rounded-full bg-white/45 opacity-55 blur-xl transition-opacity duration-200 group-hover:opacity-75 dark:bg-white/16" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-accent/45 to-transparent opacity-90" />
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_22%_22%,transparent_0_11%,rgba(255,255,255,0.18)_12%,transparent_22%),radial-gradient(circle_at_72%_30%,transparent_0_8%,rgba(18,140,116,0.12)_9%,transparent_19%)] opacity-70 blur-[1.2px] [mask-image:linear-gradient(135deg,black,transparent_72%)]" />
      <div className="relative z-10">{children}</div>
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

export default function GlassPrimitivePrototypePage() {
  return (
    <Page transparentBackground className="overflow-hidden">
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
                Shipped glass, lab baseline, and working experiment
              </h1>
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-3">
          <GlassLabColumn
            badgeLabel="Production"
            badgeState="production"
            columnTitle="Shipped primitive"
            intro={
              <>
                The default <code className="text-foreground/90">glass()</code> helper used across
                chat, chrome, and settings: translucent tertiary fill, strong static blur, and a
                hairline border — no preview-only lens stack.
              </>
            }
            sectionClassName="border-b border-white/10 px-5 py-6 lg:border-b-0 lg:border-r lg:px-8"
          >
            <div
              className={cn(
                glass(),
                "relative min-h-[410px] rounded-[2rem] p-6 sm:p-8 motion-safe:transition-shadow motion-safe:duration-200 motion-safe:ease-out hover:shadow-md"
              )}
            >
              <GlassLabHeroBody
                eyebrow="In production"
                surfaceCaseBody={
                  <p className="leading-6 text-muted-foreground">
                    Backdrop-brightened frosted panels keep type legible over busy chrome without
                    animating backdrop-filter. Tone and opaque variants map to the same primitive.
                  </p>
                }
                surfaceCaseTitle="Ship contract"
                statusPill={
                  <div className="rounded-full border border-zinc-500/20 bg-zinc-500/10 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-400/15 dark:bg-zinc-400/10 dark:text-zinc-200">
                    default
                  </div>
                }
                title="Frosted glass"
              />
            </div>

            <GlassLabBottomTiles
              denseBody={
                <p>
                  Opaque variant raises fill for readable type over liquid chrome without changing
                  the material family.
                </p>
              }
              leadingSurfaceClassName={glass({ opaque: true })}
              trailingSurfaceClassName={glass({ tone: "brown" })}
              warmBody={
                <p>Brown tone adds a warm wash and saturate for editorial surfaces in the app.</p>
              }
            />
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
          </GlassLabColumn>

          <GlassLabColumn
            badgeLabel="Working 2.01"
            badgeState="working"
            columnTitle="Refraction pass"
            intro={
              <>
                Inspired by Fluid Glass: stronger lens thickness, chromatic edge separation,
                displaced light bands, and more realistic internal reflection while keeping the
                default performance contract intact.
              </>
            }
            sectionClassName="px-5 py-6 lg:px-8"
          >
            <RefractiveGlassSurface className="min-h-[410px]">
              <GlassLabHeroBody
                eyebrow="Working prototype"
                surfaceCaseBody={
                  <p className="leading-6 text-muted-foreground">
                    Simulated lensing uses layered highlights, offset cyan/red edges, soft
                    displacement bands, and inner glow. It suggests bent light without requiring a
                    shader or animating blur.
                  </p>
                }
                surfaceCaseTitle="Refraction model"
                statusPill={
                  <div className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-200">
                    refractive
                  </div>
                }
                title="Organic Glass 2.01"
              />
            </RefractiveGlassSurface>

            <GlassLabBottomTiles
              denseBody={
                <p>
                  Dense preview tiles keep the same contract as production: opaque fill stays calm
                  over chrome while the lens stack reads on top.
                </p>
              }
              leadingSurfaceClassName={glassPreview({ opaque: true })}
              trailingSurfaceClassName={glassPreview({ tone: "brown" })}
              warmBody={
                <>
                  <p>
                    Arcadia-style warmth without losing the glass material behavior. Promotion path:{" "}
                    <code className="text-foreground/90">glass()</code> stays in the product until a
                    preview ships app-wide; 2.01 would become the center baseline as stable 2.01 and
                    the next experiment continues on the right as 2.02.
                  </p>
                </>
              }
            />
          </GlassLabColumn>
        </main>
      </div>
    </Page>
  );
}
