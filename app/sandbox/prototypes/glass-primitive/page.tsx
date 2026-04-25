import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glassPreview } from "@/components/design-system/primitives";
import Page from "@/components/layout/page";
import { cn } from "@/lib/utils";
import { tabTitleMetadata } from "@/lib/metadata/tab-title";

export const metadata: Metadata = {
  ...tabTitleMetadata(null, "Organic Glass"),
};

type GlassSurfacePreviewProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "brown";
  depth?: "flat" | "raised" | "floating";
  opaque?: boolean;
  compact?: boolean;
};

function GlassSurfacePreview({
  children,
  className,
  tone = "default",
  depth = "floating",
  opaque,
  compact,
}: GlassSurfacePreviewProps) {
  return (
    <div
      className={cn(
        glassPreview({ depth, interactive: true, opaque, tone }),
        "group rounded-[2rem]",
        compact ? "p-4" : "p-6 sm:p-8",
        className
      )}
      data-dim-background
    >
      <div className="pointer-events-none absolute -inset-10 rounded-[inherit] bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.36),transparent_34%),radial-gradient(circle_at_82%_14%,rgba(18,140,116,0.20),transparent_32%)] opacity-75 transition-opacity duration-200 group-hover:opacity-100 dark:opacity-55" />
      <div className="pointer-events-none absolute inset-px rounded-[inherit] bg-[linear-gradient(118deg,rgba(255,255,255,0.48),transparent_24%,transparent_68%,rgba(18,140,116,0.14))] opacity-65 dark:opacity-35" />
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-linear-to-r from-transparent via-white/70 to-transparent opacity-80 dark:via-white/30" />
      <div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-linear-to-r from-transparent via-foreground/12 to-transparent opacity-80 dark:via-white/12" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

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

function VersionBadge({ label, state }: { label: string; state: "stable" | "working" }) {
  return (
    <span
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium",
        state === "stable"
          ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-accent/25 bg-accent/10 text-accent"
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
                Stable baseline vs working prototype
              </h1>
            </div>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
          <section className="min-h-0 overflow-y-auto border-b border-white/10 px-5 py-6 lg:border-b-0 lg:border-r lg:px-8">
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <VersionBadge label="Stable 2.0" state="stable" />
                  <h2 className="mt-4 text-3xl font-light tracking-[-0.035em] text-foreground">
                    Approved baseline
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    This is the first approved layer: the initial Organic Glass direction preserved
                    as the baseline before refraction experiments are merged back in.
                  </p>
                </div>
              </div>

              <GlassSurfacePreview className="min-h-[410px]">
                <div className="mb-12 flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
                      Candidate primitive
                    </p>
                    <h3 className="mt-3 text-3xl font-light tracking-tight text-foreground">
                      Organic Glass
                    </h3>
                  </div>
                  <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                    alive
                  </div>
                </div>

                <div className="space-y-4">
                  <SurfaceCase title="Stable layer">
                    <p className="leading-6 text-muted-foreground">
                      Semi-opaque optical fill, moderate static blur, inner edge light, and cheap
                      hover response. The ambient chrome reads as atmosphere instead of noise.
                    </p>
                  </SurfaceCase>
                  <div className="flex flex-wrap gap-3">
                    {["Ask", "Remember", "Reason", "Speak"].map((action) => (
                      <button
                        className="rounded-full border border-white/25 bg-background/45 px-4 py-2 text-sm text-foreground shadow-inner transition hover:-translate-y-0.5 hover:border-accent/30 hover:bg-background/60 active:translate-y-0 dark:border-white/10 dark:bg-background-secondary/45"
                        key={action}
                        type="button"
                      >
                        {action}
                      </button>
                    ))}
                  </div>
                </div>
              </GlassSurfacePreview>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className={cn(glassPreview({ opaque: true }), "rounded-3xl p-5")}>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Dense text
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Readability remains anchored by fill, ring, and border rather than raw
                    transparency.
                  </p>
                </div>
                <div className={cn(glassPreview({ tone: "brown" }), "rounded-3xl p-5")}>
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                    Warm tone
                  </p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Arcadia-style warmth without losing the glass material behavior.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto px-5 py-6 lg:px-8">
            <div className="mx-auto max-w-2xl space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <VersionBadge label="Working 2.01" state="working" />
                  <h2 className="mt-4 text-3xl font-light tracking-[-0.035em] text-foreground">
                    Refraction pass
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    Inspired by Fluid Glass: stronger lens thickness, chromatic edge separation,
                    displaced light bands, and more realistic internal reflection while keeping the
                    default performance contract intact.
                  </p>
                </div>
              </div>

              <RefractiveGlassSurface className="min-h-[410px]">
                <div className="mb-10 flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
                      Working prototype
                    </p>
                    <h3 className="mt-3 text-3xl font-light tracking-tight text-foreground">
                      Organic Glass 2.01
                    </h3>
                  </div>
                  <div className="rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-200">
                    refractive
                  </div>
                </div>

                <div className="space-y-4">
                  <SurfaceCase title="Refraction model">
                    <p className="leading-6 text-muted-foreground">
                      Simulated lensing uses layered highlights, offset cyan/red edges, soft
                      displacement bands, and inner glow. It suggests bent light without requiring a
                      shader or animating blur.
                    </p>
                  </SurfaceCase>

                  <div className="rounded-3xl border border-white/24 bg-background/30 p-4 shadow-inner backdrop-blur-md dark:border-white/10 dark:bg-background-secondary/30">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          Chat lens
                        </p>
                        <p className="mt-2 text-sm text-foreground">What should we refine next?</p>
                      </div>
                      <button
                        className="rounded-full bg-foreground px-4 py-2 text-sm text-background transition hover:scale-[1.02] active:scale-[0.98]"
                        type="button"
                      >
                        Send
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {["IOR feel", "edge prism", "inner caustic", "static blur"].map((chip) => (
                      <span
                        className="rounded-full border border-white/25 bg-background/38 px-3 py-1.5 text-xs text-foreground shadow-inner dark:border-white/10 dark:bg-background-secondary/38"
                        key={chip}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </RefractiveGlassSurface>

              <div className={cn(glassPreview({ depth: "flat" }), "rounded-3xl p-5")}>
                <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                  Approval workflow
                </p>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  If 2.01 is approved, it becomes the left-side baseline as stable 2.01. The next
                  experiment starts on the right as 2.02.
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>
    </Page>
  );
}
