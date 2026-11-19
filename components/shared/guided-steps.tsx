"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

export type GuidedStep = {
  /** Short, in the reader's terms: "You press send". */
  title: string;
  /** Labelled paragraphs under the title, e.g. "What you see". */
  fields: readonly { label: string; text: ReactNode }[];
};

/** Same easing as the rest of the blog's micro-motion (see blog-article.module.css). */
const EASE = "ease-[cubic-bezier(0.23,1,0.32,1)]";

/**
 * Step through a sequence: a progress rail, one panel at a time, Back and Next. This is the one
 * step-through control; posts and surfaces give it steps and never rebuild it (the blog's
 * MessageFlowStepper is a thin adapter over it).
 *
 * Every panel sits in the same grid cell, so the box is as tall as the tallest step and the
 * controls never move between steps. Panels before the current one wait on the left, panels after
 * it on the right; changing step slides the old one out and the new one in, with no direction
 * state. Motion is opacity and a short translate only, and `motion-reduce` turns it off.
 */
export function GuidedSteps({
  steps,
  label = "Steps",
  className,
}: {
  steps: readonly GuidedStep[];
  /** Names the step rail for assistive tech. */
  label?: string;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const last = steps.length - 1;
  const current = steps[index];

  return (
    <div className={cn("rounded-xl border border-border bg-secondary/40 p-inset-xl", className)}>
      <div aria-label={label} className="mb-stack-xl flex items-center gap-inline-sm" role="group">
        {steps.map((s, i) => (
          <button
            key={s.title}
            aria-current={i === index ? "step" : undefined}
            aria-label={`Step ${i + 1}: ${s.title}`}
            className="organic-focus group/seg flex h-5 flex-1 items-center rounded-full"
            type="button"
            onClick={() => setIndex(i)}
          >
            <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-border/40 transition-[height] duration-200 group-hover/seg:h-2">
              <span
                className={cn(
                  "absolute inset-0 origin-left bg-lumen/45 transition-transform duration-500 motion-reduce:transition-none",
                  EASE,
                  i <= index ? "scale-x-100" : "scale-x-0",
                  // The current step is the only one with a little more presence.
                  i === index && "bg-lumen/70"
                )}
              />
            </span>
          </button>
        ))}
      </div>

      {/* Announces the change once; the panels themselves are hidden from assistive tech. */}
      <p aria-live="polite" className="sr-only">
        Step {index + 1} of {steps.length}: {current.title}
      </p>

      <div className="grid">
        {steps.map((s, i) => {
          const active = i === index;

          return (
            <div
              key={s.title}
              aria-hidden={!active}
              className={cn(
                "col-start-1 row-start-1 space-y-stack-md transition-[opacity,transform,visibility] duration-300 motion-reduce:transition-none",
                EASE,
                active
                  ? "visible translate-x-0 opacity-100"
                  : cn(
                      "invisible opacity-0",
                      i < index
                        ? "-translate-x-2 motion-reduce:translate-x-0"
                        : "translate-x-2 motion-reduce:translate-x-0"
                    )
              )}
              inert={!active}
            >
              <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
                Step {i + 1} of {steps.length}
              </p>
              <h3 className="font-commissioner text-xl font-light tracking-tight text-foreground">
                {s.title}
              </h3>
              <dl className="space-y-stack-md text-sm leading-relaxed">
                {s.fields.map((field) => (
                  <div key={field.label}>
                    <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                      {field.label}
                    </dt>
                    <dd className="mt-stack-xs text-foreground/90">{field.text}</dd>
                  </div>
                ))}
              </dl>
            </div>
          );
        })}
      </div>

      <div className="mt-stack-xl flex items-center justify-between gap-inline-sm">
        <Button
          className="group/btn transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          disabled={index === 0}
          size="sm"
          type="button"
          variant="ghost"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft
            aria-hidden
            className="size-4 transition-transform duration-200 group-hover/btn:-translate-x-0.5 motion-reduce:transition-none"
          />
          Back
        </Button>
        <Button
          className="group/btn transition-transform active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100"
          disabled={index === last}
          size="sm"
          type="button"
          variant="secondary"
          onClick={() => setIndex((i) => Math.min(last, i + 1))}
        >
          Next
          <ChevronRight
            aria-hidden
            className="size-4 transition-transform duration-200 group-hover/btn:translate-x-0.5 motion-reduce:transition-none"
          />
        </Button>
      </div>
    </div>
  );
}
