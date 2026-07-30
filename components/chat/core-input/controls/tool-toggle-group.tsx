"use client";

import { ComposerMemoryChip } from "./memory-chip";
import { ComposerSearchChip } from "./search-chip";

import { cn } from "@/lib/utils";

/**
 * Groups the model-facing tool toggles into one visual unit. The grid track
 * keeps spacing identical no matter how many chips land here.
 */
export function ComposerToolToggleGroup({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "grid auto-cols-max grid-flow-col items-center gap-1 overflow-visible",
        className
      )}
    >
      <ComposerSearchChip />
      <ComposerMemoryChip />
    </div>
  );
}
