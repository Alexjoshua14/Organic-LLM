import type { Metadata } from "next";
import type { ReactNode } from "react";

import Link from "next/link";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass, glassPreview } from "@/components/design-system/primitives";
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

const variantTiles = [
  {
    label: "Default",
    description: "Everyday foreground lens for controls and focused panels.",
    options: {},
  },
  {
    label: "Floating",
    description: "Hero and high-attention surfaces with stronger atmospheric depth.",
    options: { depth: "floating" as const },
  },
  {
    label: "Warm",
    description: "Arcadia-compatible warmth without turning the surface opaque.",
    options: { tone: "brown" as const, depth: "raised" as const },
  },
  {
    label: "Opaque",
    description: "Busy-background reading mode with blur reduced and fill stabilized.",
    options: { opaque: true, depth: "flat" as const },
  },
];

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

function SectionHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className="mb-5 max-w-2xl">
      <p className="mb-2 text-xs font-medium uppercase tracking-[0.28em] text-accent/80">
        {eyebrow}
      </p>
      <h2 className="text-2xl font-light tracking-tight text-foreground sm:text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground sm:text-base">{children}</p>
    </header>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-full border border-white/30 bg-background/45 px-3 py-1.5 text-xs shadow-inner backdrop-blur-sm dark:border-white/10 dark:bg-background-secondary/45">
      <span className="text-muted-foreground">{label}</span>{" "}
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ComparisonCard({
  label,
  variant,
  className,
}: {
  label: string;
  variant: "current" | "candidate";
  className?: string;
}) {
  const isCandidate = variant === "candidate";

  return (
    <article
      className={cn(
        isCandidate
          ? glassPreview({ depth: "raised", interactive: true })
          : glass({ opaque: true }),
        "rounded-3xl p-6",
        className
      )}
      data-dim-background={isCandidate ? "" : undefined}
    >
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
          <h3 className="mt-2 text-xl font-light text-foreground">
            {isCandidate ? "Organic Glass candidate" : "Current glass primitive"}
          </h3>
        </div>
        <span className="rounded-full border border-border/50 px-3 py-1 text-xs text-muted-foreground">
          {isCandidate ? "preview" : "baseline"}
        </span>
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {isCandidate
          ? "Stabilized fill, optical edge, inner light, and cheap interaction response over the living chrome field."
          : "Useful and simple, but more like a translucent utility than a foundational material language."}
      </p>
      <div className="mt-6 grid grid-cols-3 gap-2">
        {["read", "hover", "focus"].map((item) => (
          <div
            className="rounded-2xl border border-border/40 bg-background/35 px-3 py-3 text-center text-xs text-muted-foreground dark:bg-background-secondary/35"
            key={item}
          >
            {item}
          </div>
        ))}
      </div>
    </article>
  );
}

function VariantTile({
  label,
  description,
  options,
}: {
  label: string;
  description: string;
  options: Parameters<typeof glassPreview>[0];
}) {
  return (
    <div className={cn(glassPreview({ ...options, interactive: true }), "rounded-3xl p-5")}>
      <div className="mb-6 h-20 rounded-2xl border border-white/25 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.62),transparent_28%),linear-gradient(135deg,rgba(18,140,116,0.18),transparent)] dark:border-white/10" />
      <h3 className="text-base font-medium text-foreground">{label}</h3>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
    </div>
  );
}

export default function GlassPrimitivePrototypePage() {
  return (
    <Page transparentBackground className="overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.5} dimIntensityFull={0.72} speed={0.01} />

      <div className="relative z-10 h-full w-full overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-8 sm:py-10">
          <nav className="mb-8">
            <Link
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              href="/sandbox/prototypes"
            >
              &larr; Prototypes
            </Link>
          </nav>

          <section className="grid min-h-[68dvh] items-center gap-8 py-8 lg:grid-cols-[0.88fr_1.12fr] lg:py-12">
            <div>
              <p className="mb-4 text-xs font-medium uppercase tracking-[0.32em] text-accent/80">
                Organic material system
              </p>
              <h1 className="max-w-3xl text-4xl font-light tracking-[-0.04em] text-foreground sm:text-6xl">
                Foreground glass for the living chrome field.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                This candidate treats glass as the responsive lens of Organic LLM: calm at rest,
                crisp under attention, and performant enough to become foundational.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                <StatPill label="blur" value="static" />
                <StatPill label="motion" value="transform + opacity" />
                <StatPill label="fallback" value="solid readable fill" />
              </div>
            </div>

            <GlassSurfacePreview className="min-h-[420px]">
              <div className="mb-12 flex items-start justify-between gap-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.26em] text-muted-foreground">
                    Candidate primitive
                  </p>
                  <h2 className="mt-3 text-3xl font-light tracking-tight text-foreground">
                    Organic Glass
                  </h2>
                </div>
                <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  alive
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-3xl border border-white/24 bg-background/35 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-background-secondary/35">
                  <p className="text-sm leading-6 text-muted-foreground">
                    The ambient chrome remains visible as atmosphere, while the optical layer gives
                    text a stable resting plane. Interaction should feel like the surface is
                    receiving attention, not repainting itself.
                  </p>
                </div>
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
          </section>

          <section className="py-12">
            <SectionHeading
              eyebrow="Baseline comparison"
              title="Current utility vs candidate material"
            >
              The existing primitive stays untouched. This comparison makes the upgrade legible
              before any production migration.
            </SectionHeading>
            <div className="grid gap-5 md:grid-cols-2">
              <ComparisonCard label="Before" variant="current" />
              <ComparisonCard label="After" variant="candidate" />
            </div>
          </section>

          <section className="py-12">
            <SectionHeading eyebrow="Product fit" title="Surfaces that need to feel natural">
              The primitive has to work for reading, choosing, acting, and navigating. These are the
              everyday surfaces that would reveal lag or poor contrast quickly.
            </SectionHeading>

            <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
              <GlassSurfacePreview opaque>
                <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                  Dense text panel
                </p>
                <h3 className="mt-3 text-2xl font-light text-foreground">Readable by default</h3>
                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  Organic Glass should never ask users to fight the background. The blur is present,
                  but the readable layer is the fill, border, and inner ring working together. This
                  is the variant for summaries, memory context, tool details, and other text-heavy
                  surfaces.
                </p>
              </GlassSurfacePreview>

              <div className="space-y-5">
                <GlassSurfacePreview compact>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
                        Chat shell
                      </p>
                      <p className="mt-2 text-sm text-foreground">What should we explore next?</p>
                    </div>
                    <button
                      className="rounded-full bg-foreground px-4 py-2 text-sm text-background transition hover:scale-[1.02] active:scale-[0.98]"
                      type="button"
                    >
                      Send
                    </button>
                  </div>
                </GlassSurfacePreview>

                <GlassSurfacePreview compact tone="brown">
                  <div className="flex flex-wrap items-center gap-2">
                    {["Arcadia", "Warm", "Reflective", "Context"].map((chip) => (
                      <span
                        className="rounded-full border border-amber-900/10 bg-amber-50/35 px-3 py-1.5 text-xs text-foreground dark:border-amber-200/10 dark:bg-amber-950/20"
                        key={chip}
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                </GlassSurfacePreview>
              </div>
            </div>
          </section>

          <section className="py-12">
            <SectionHeading eyebrow="Variant matrix" title="One material, several jobs">
              The API stays conservative. Variants are about hierarchy and legibility, not novelty.
            </SectionHeading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {variantTiles.map((tile) => (
                <VariantTile
                  description={tile.description}
                  key={tile.label}
                  label={tile.label}
                  options={tile.options}
                />
              ))}
            </div>
          </section>

          <section className="pb-16 pt-12">
            <div
              className={cn(
                glassPreview({ depth: "flat", interactive: true }),
                "sticky bottom-5 rounded-full px-4 py-3"
              )}
              data-dim-background="full"
            >
              <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <span>
                  Performance contract: static blur, cheap interaction properties, solid fallback.
                </span>
                <span className="text-foreground">Designed to feel immediate.</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Page>
  );
}
