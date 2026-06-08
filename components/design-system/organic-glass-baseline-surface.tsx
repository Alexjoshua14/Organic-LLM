import type { ReactNode } from "react";

import { glassPreview } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type OrganicGlassBaselineSurfaceProps = {
  children: ReactNode;
  className?: string;
  tone?: "default" | "brown";
  depth?: "flat" | "raised" | "floating";
  opaque?: boolean;
  compact?: boolean;
};

/**
 * Approved Organic Glass 2.0 “candidate” baseline: `glassPreview` material plus static edge light
 * and highlight bands (no refraction pass). Keep in sync with the Stable column on
 * `/sandbox/prototypes/glass-primitive`.
 */
export function OrganicGlassBaselineSurface({
  children,
  className,
  tone = "default",
  depth = "floating",
  opaque,
  compact,
}: OrganicGlassBaselineSurfaceProps) {
  return (
    <div className="m-0.5 min-w-0 overflow-visible sm:m-1">
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
    </div>
  );
}
