"use client";

import Link from "next/link";
import { Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { glassPreview } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  FIRST_SESSION_STEPS,
  completeFirstSessionStep,
  dismissFirstSessionChecklist,
  isFirstSessionChecklistComplete,
  readFirstSessionState,
  shouldShowFirstSessionChecklist,
} from "@/lib/onboarding/first-session-storage";
import { cn } from "@/lib/utils";

type FirstSessionChecklistProps = {
  className?: string;
};

export function FirstSessionChecklist({ className }: FirstSessionChecklistProps) {
  const [hydrated, setHydrated] = useState(false);
  const [visible, setVisible] = useState(false);
  const [completed, setCompleted] = useState<Record<string, true>>({});

  useEffect(() => {
    setHydrated(true);
    const state = readFirstSessionState(window.localStorage);

    setCompleted(state.completedSteps as Record<string, true>);
    setVisible(shouldShowFirstSessionChecklist(state));
  }, []);

  const dismiss = useCallback(() => {
    dismissFirstSessionChecklist(window.localStorage);
    setVisible(false);
  }, []);

  if (!hydrated || !visible) return null;

  const allDone = isFirstSessionChecklistComplete({
    completedSteps: completed,
    version: 1,
  });

  return (
    <aside
      aria-labelledby="first-session-checklist-title"
      className={cn(
        "w-full max-w-xl mx-auto",
        glassPreview({ opaque: true, depth: "raised", interactive: true }),
        "rounded-2xl border border-border/60 p-4 sm:p-5",
        className
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-lumen" />
          <div>
            <h2
              className="font-commissioner text-base font-light tracking-wide text-foreground sm:text-lg"
              id="first-session-checklist-title"
            >
              {allDone ? "You're set — explore freely" : "Your first steps"}
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              {allDone
                ? "You’ve touched the main surfaces. Tips still appear on individual features until dismissed."
                : "Four quick wins to see what Organic LLM can do."}
            </p>
          </div>
        </div>
        <Button
          aria-label="Dismiss checklist"
          className="size-8 shrink-0 text-muted-foreground"
          size="icon"
          type="button"
          variant="ghost"
          onClick={dismiss}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <ol className="space-y-2">
        {FIRST_SESSION_STEPS.map((step, index) => {
          const done = Boolean(completed[step.id]);

          return (
            <li key={step.id}>
              <Link
                className={cn(
                  "group flex items-center gap-3 rounded-xl border border-border/50 px-3 py-2.5 transition-colors",
                  "hover:border-accent/30 hover:bg-muted/20 active:scale-[0.998]",
                  done && "border-accent/25 bg-accent/5"
                )}
                href={step.href}
                onClick={() => {
                  const next = completeFirstSessionStep(window.localStorage, step.id);

                  setCompleted(next.completedSteps as Record<string, true>);
                }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-medium tabular-nums",
                    done
                      ? "border-accent/40 bg-accent/15 text-accent"
                      : "border-border/60 bg-background/50 text-muted-foreground"
                  )}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-medium text-foreground">{step.title}</span>
                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                    {step.body}
                  </span>
                </span>
                <span className="shrink-0 text-[11px] font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                  {step.cta}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>

      {allDone ? (
        <Button className="mt-3 h-9 w-full text-xs sm:text-sm" type="button" onClick={dismiss}>
          Got it
        </Button>
      ) : null}
    </aside>
  );
}
