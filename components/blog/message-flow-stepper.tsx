"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { BlogFigure } from "./blog-figure";

import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

export type FlowStep = {
  /** Short, in the reader's terms: "You press send". */
  title: string;
  /** What you notice, if anything. */
  seen: string;
  /** What the server does, in one sentence with the real names. */
  behind: string;
};

/**
 * Follow one exchange from the first action to a finished, saved result. The steps are data, so the
 * post owns its words; this owns the interaction. Controls are real buttons with real labels, the
 * current step is announced, and nothing animates, so it needs no reduced-motion branch.
 */
export function MessageFlowStepper({
  steps,
  caption = "Click through one message, from send to saved.",
}: {
  steps: readonly FlowStep[];
  caption?: string;
}) {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = steps.length - 1;

  return (
    <BlogFigure caption={caption}>
      <div className="rounded-xl border border-border bg-secondary/40 p-inset-xl">
        <div
          aria-label="Steps"
          className="mb-stack-xl flex items-center gap-inline-sm"
          role="group"
        >
          {steps.map((s, i) => (
            <div key={s.title} className="flex-1">
              <button
                aria-current={i === index ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.title}`}
                className={cn(
                  "organic-focus block h-1.5 w-full rounded-full transition-colors",
                  i <= index ? "bg-lumen-deep" : "bg-border"
                )}
                type="button"
                onClick={() => setIndex(i)}
              />
            </div>
          ))}
        </div>

        <div aria-live="polite" className="min-h-40 space-y-stack-md">
          <p className="text-2xs font-medium uppercase tracking-widest text-muted-foreground">
            Step {index + 1} of {steps.length}
          </p>
          <h3 className="font-commissioner text-xl font-light tracking-tight text-foreground">
            {step.title}
          </h3>
          <dl className="space-y-stack-md text-sm leading-relaxed">
            <div>
              <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                What you see
              </dt>
              <dd className="mt-stack-xs text-foreground/90">{step.seen}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                Behind the scenes
              </dt>
              <dd className="mt-stack-xs text-foreground/90">{step.behind}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-stack-xl flex items-center justify-between gap-inline-sm">
          <Button
            disabled={index === 0}
            size="sm"
            type="button"
            variant="ghost"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <ChevronLeft aria-hidden className="size-4" />
            Back
          </Button>
          <Button
            disabled={index === last}
            size="sm"
            type="button"
            variant="secondary"
            onClick={() => setIndex((i) => Math.min(last, i + 1))}
          >
            Next
            <ChevronRight aria-hidden className="size-4" />
          </Button>
        </div>
      </div>
    </BlogFigure>
  );
}
