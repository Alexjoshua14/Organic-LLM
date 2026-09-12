"use client";

import { useCoreInputControls } from "../core-input-context";

import { ComposerEffortSelect } from "./effort-select";
import { ComposerModelSelect } from "./model-select";

import { modelSupportsEffortControl } from "@/lib/schemas/chat-effort";
import { cn } from "@/lib/utils";

/**
 * Model and effort answer the same question — which brain, and how hard it
 * thinks — so they read as one outlined control split into two segments. Each
 * half keeps its own hover state to signal that it opens independently, which
 * is why the frame carries no fill of its own.
 *
 * The frame is drawn with an inset ring rather than a border so it consumes no
 * layout space; that keeps the `h-8` segments flush with the frame edge and the
 * divider exactly full-height.
 */
export function ComposerModelEffortSelect({ className }: { className?: string }) {
  const { model } = useCoreInputControls();
  const effortAdjustable = modelSupportsEffortControl(model.id);

  return (
    <div
      className={cn(
        "group/segments flex h-8 shrink-0 items-center rounded-md ring-1 ring-inset ring-border/50",
        "motion-safe:transition-[box-shadow] motion-safe:duration-200 hover:ring-border",
        className
      )}
      data-effort={effortAdjustable ? "shown" : "hidden"}
    >
      <ComposerModelSelect />
      {/*
       * Clipping the collapsing track at the model's edge is what sells the
       * "slides underneath" read — the translate alone would look like a drift.
       * `max-width` is used over a grid `fr` track because this frame is
       * shrink-to-fit, where fractional tracks do not interpolate smoothly.
       */}
      <div
        className={cn(
          "flex items-center overflow-hidden",
          "motion-safe:transition-[max-width,opacity,transform] motion-safe:duration-200 motion-safe:ease-out",
          effortAdjustable
            ? "max-w-32 translate-x-0 opacity-100"
            : "max-w-0 -translate-x-1.5 opacity-0"
        )}
      >
        <span aria-hidden className="w-px shrink-0 self-stretch bg-border/50" />
        <ComposerEffortSelect />
      </div>
    </div>
  );
}
