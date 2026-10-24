import type { CSSProperties } from "react";

import Link from "next/link";

import { getPrototypeHref, type PrototypeEntry } from "../_config/prototypes";

import ShinyText from "@/components/ShinyText";
import { glassFrost } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type PrototypeCardVariant = "spotlight" | "hero" | "featured" | "compact";

/**
 * Card prominence steps down with tier across every channel at once — footprint, padding,
 * corner radius, type scale, glass depth, and hover richness — so hierarchy reads as material,
 * not just size. All hover/entrance motion is transform/opacity only (compositor-friendly);
 * `backdrop-filter` stays static per `glassFrost`'s contract.
 */
const VARIANT_SHELL: Record<
  PrototypeCardVariant,
  { radius: string; padding: string; depth: "floating" | "raised" | "flat"; lift: string }
> = {
  spotlight: {
    radius: "rounded-[1.75rem]",
    padding: "p-7 sm:p-10",
    depth: "floating",
    lift: "group-hover:-translate-y-1",
  },
  hero: {
    radius: "rounded-3xl",
    padding: "p-6 sm:p-8",
    depth: "floating",
    lift: "group-hover:-translate-y-1",
  },
  featured: {
    radius: "rounded-[1.25rem]",
    padding: "p-5 sm:p-6",
    depth: "raised",
    lift: "group-hover:-translate-y-0.5",
  },
  compact: {
    radius: "rounded-2xl",
    padding: "p-4 sm:p-5",
    depth: "flat",
    lift: "group-hover:-translate-y-0.5",
  },
};

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        d="M17 8l4 4m0 0l-4 4m4-4H3"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );
}

function ExploreRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 text-xs text-muted-foreground select-none sm:text-sm",
        className
      )}
    >
      <ShinyText
        as="span"
        className="cursor-inherit"
        shimmerOnParentGroupHover
        speed={2.5}
        text="Explore"
      />
      <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
    </div>
  );
}

type PrototypeCardProps = {
  prototype: PrototypeEntry;
  variant: PrototypeCardVariant;
  /** Stagger offset for the one-shot entrance animation. */
  enterDelayMs?: number;
  className?: string;
};

export function PrototypeCard({
  prototype,
  variant,
  enterDelayMs = 0,
  className,
}: PrototypeCardProps) {
  const shell = VARIANT_SHELL[variant];
  const isCompact = variant === "compact";
  const isSpotlight = variant === "spotlight";

  return (
    <Link
      data-dim-background
      className={cn(
        "group prototype-card-enter relative block outline-none",
        shell.radius,
        "focus-visible:ring-2 focus-visible:ring-accent/70",
        className
      )}
      href={getPrototypeHref(prototype.slug)}
      style={{ "--prototype-enter-delay": `${enterDelayMs}ms` } as CSSProperties}
    >
      {/* Hover bloom: deeper shadow + warm lumen underlight, crossfaded via opacity so the
          card's own box-shadow never animates. */}
      {!isCompact && (
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-1 -z-10 opacity-0 transition-opacity duration-300 group-hover:opacity-100",
            shell.radius,
            "shadow-[0_36px_110px_-28px_rgba(20,21,22,0.6)] dark:shadow-[0_36px_120px_-26px_rgba(0,0,0,0.95)]",
            "bg-[radial-gradient(70%_60%_at_50%_110%,rgb(var(--lumen)/0.14),transparent_70%)]"
          )}
        />
      )}

      <div
        className={cn(
          glassFrost({ depth: shell.depth }),
          shell.radius,
          shell.padding,
          "h-full transform-gpu transition-transform duration-300 ease-out",
          shell.lift,
          "group-active:translate-y-0 group-active:scale-[0.99]"
        )}
      >
        {/* Ambient light: cool key top-left, faint accent counter top-right (matches the
            approved OrganicGlassBaselineSurface treatment). */}
        {!isCompact && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 rounded-[inherit] bg-[radial-gradient(circle_at_18%_-4%,rgba(255,255,255,0.34),transparent_36%),radial-gradient(circle_at_85%_10%,rgba(18,140,116,0.16),transparent_34%)] opacity-70 transition-opacity duration-300 group-hover:opacity-100 dark:opacity-45"
          />
        )}

        {/* Top-edge specular catch. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-linear-to-r from-transparent via-white/70 to-transparent dark:via-white/25"
        />

        {/* Edge light on hover — opacity crossfade instead of animating border color. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/45 opacity-0 transition-opacity duration-300 group-hover:opacity-100 dark:ring-white/15"
        />

        {/* Specular sheen sweep across the pane on hover. */}
        {!isCompact && (
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-y-6 left-0 w-1/2 -translate-x-[130%] -skew-x-12 transform-gpu bg-linear-to-r from-transparent via-white/20 to-transparent opacity-0 transition-[transform,opacity] duration-700 ease-out group-hover:translate-x-[320%] group-hover:opacity-100 dark:via-white/[0.08]"
          />
        )}

        {isSpotlight ? (
          <SpotlightContent prototype={prototype} />
        ) : isCompact ? (
          <CompactContent prototype={prototype} />
        ) : (
          <StandardContent prototype={prototype} variant={variant} />
        )}
      </div>
    </Link>
  );
}

function SpotlightContent({ prototype }: { prototype: PrototypeEntry }) {
  const quote = prototype.about.authorThoughts;

  return (
    <div className="relative z-10 flex flex-col gap-7 md:flex-row md:items-stretch md:justify-between md:gap-12">
      <div className="min-w-0 max-w-xl">
        <h2 className="mb-3 font-commissioner text-2xl font-extralight tracking-tight text-foreground sm:text-[2rem] sm:leading-tight">
          {prototype.title}
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          {prototype.description}
        </p>
      </div>

      <div className="flex shrink-0 flex-col justify-between gap-6 md:w-72">
        {quote ? (
          <p className="hidden select-none border-l border-lumen/30 pl-4 text-[13px] italic leading-relaxed text-muted-foreground/90 line-clamp-4 md:block">
            &ldquo;{quote}&rdquo;
          </p>
        ) : (
          <span aria-hidden className="hidden md:block" />
        )}
        <ExploreRow className="md:justify-end" />
      </div>
    </div>
  );
}

function StandardContent({
  prototype,
  variant,
}: {
  prototype: PrototypeEntry;
  variant: "hero" | "featured";
}) {
  const isHero = variant === "hero";

  return (
    <div className="relative z-10 flex h-full flex-col gap-3">
      <h2
        className={cn(
          "font-commissioner font-light tracking-tight text-foreground",
          isHero ? "text-xl sm:text-2xl" : "text-base sm:text-lg"
        )}
      >
        {prototype.title}
      </h2>
      <p
        className={cn(
          "flex-1 text-sm leading-relaxed text-muted-foreground",
          isHero ? "line-clamp-3" : "line-clamp-2"
        )}
      >
        {prototype.description}
      </p>
      <ExploreRow className={cn(!isHero && "text-xs sm:text-xs")} />
    </div>
  );
}

function CompactContent({ prototype }: { prototype: PrototypeEntry }) {
  return (
    <div className="relative z-10 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-commissioner text-[15px] font-normal text-foreground">
          {prototype.title}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {prototype.description}
        </p>
      </div>
      <ArrowIcon className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
    </div>
  );
}
