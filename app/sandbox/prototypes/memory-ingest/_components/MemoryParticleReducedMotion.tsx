"use client";

import type { ParticleFieldVisualState } from "../_lib/types";

import { cn } from "@/lib/utils";

type MemoryParticleReducedMotionProps = {
  state: ParticleFieldVisualState;
  className?: string;
};

/** Low-motion stand-in when `prefers-reduced-motion: reduce` is active. */
export function MemoryParticleReducedMotion({
  state,
  className,
}: MemoryParticleReducedMotionProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center",
        className
      )}
      data-testid="memory-particle-reduced"
    >
      <div
        className={cn(
          "h-40 w-40 max-w-[55%] rounded-full bg-foreground/10",
          state === "writing_memory" && "bg-foreground/15"
        )}
      />
    </div>
  );
}
