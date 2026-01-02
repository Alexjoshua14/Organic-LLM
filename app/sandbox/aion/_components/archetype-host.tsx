"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ArchetypeHostProps = {
  showGlass?: boolean;
  opaque?: boolean;
  border?: "all" | "left" | "right" | "none";
  className?: string;
};

export function ArchetypeHost({
  showGlass = true,
  opaque = false,
  border = "left",
  className,
}: ArchetypeHostProps) {
  return (
    <aside
      className={cn(
        showGlass && glass({ border, opaque }),
        "min-w-72",
        "max-w-lg",
        "h-full",
        "px-4",
        "pt-14",
        "pb-6",
        "flex",
        "flex-col",
        "gap-3",
        className
      )}
    >
      <div className="text-xs uppercase tracking-wide text-foreground/60">
        Archetype (coming soon)
      </div>
      <div className="rounded-lg border border-border/70 bg-background-secondary/70 p-3 text-sm text-foreground/80">
        This area will host the Archetype experience. Sample placeholder text for
        now.
      </div>
    </aside>
  );
}

