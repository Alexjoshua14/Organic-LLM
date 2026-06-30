"use client";

import Link from "next/link";
import { Check, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

import { glassPreview } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/third-party/ui/sheet";
import {
  FIRST_SESSION_STEPS,
  completeFirstSessionStep,
  dismissFirstSessionChecklist,
  isFirstSessionChecklistComplete,
  readFirstSessionState,
  shouldShowFirstSessionChecklist,
} from "@/lib/onboarding/first-session-storage";
import { requestFeatureGuideResume } from "@/lib/onboarding/feature-hint-explicit-request";
import { cn } from "@/lib/utils";

/**
 * Floating first-session guide — portaled so it is not stretched by the sidebar flex row.
 */
export function FirstSessionSheet() {
  const [hydrated, setHydrated] = useState(false);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [completed, setCompleted] = useState<Record<string, true>>({});
  const toastShownRef = useRef(false);

  useEffect(() => {
    setHydrated(true);
    const state = readFirstSessionState(window.localStorage);

    setCompleted(state.completedSteps as Record<string, true>);
    setVisible(shouldShowFirstSessionChecklist(state));
  }, []);

  useEffect(() => {
    if (!hydrated || !visible || toastShownRef.current) return;

    toastShownRef.current = true;
    toast("New here?", {
      description: "Open First steps for a quick tour.",
      duration: 8_000,
      action: {
        label: "Open",
        onClick: () => setOpen(true),
      },
    });
  }, [hydrated, visible]);

  useEffect(() => {
    if (!open) return;

    requestFeatureGuideResume();
  }, [open]);

  const dismiss = useCallback(() => {
    dismissFirstSessionChecklist(window.localStorage);
    setVisible(false);
    setOpen(false);
  }, []);

  if (!hydrated || !visible) return null;

  const allDone = isFirstSessionChecklistComplete({
    completedSteps: completed,
    version: 1,
  });

  const floatingPill =
    typeof document !== "undefined"
      ? createPortal(
          <div
            className={cn(
              "pointer-events-auto fixed z-[35]",
              "bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2",
              "sm:bottom-6 sm:left-auto sm:translate-x-0 sm:right-[9.75rem]"
            )}
          >
            <div
              className={cn(
                "flex h-9 max-h-9 w-max max-w-[min(18rem,calc(100vw-2rem))] items-center overflow-hidden rounded-full",
                glassPreview({ opaque: true, depth: "raised", interactive: true }),
                "text-foreground shadow-lg"
              )}
            >
              <button
                aria-label="Open first steps guide"
                className="flex h-full min-w-0 flex-1 items-center gap-1.5 whitespace-nowrap px-3 text-xs font-medium text-foreground hover:text-foreground"
                type="button"
                onClick={() => setOpen(true)}
              >
                <Sparkles aria-hidden className="size-3.5 shrink-0 text-lumen" />
                <span className="truncate">First steps</span>
              </button>
              <button
                aria-label="Dismiss first steps guide"
                className="grid h-full w-9 shrink-0 place-items-center border-l border-border/40 text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
                type="button"
                onClick={dismiss}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {floatingPill}

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          overlayPriority
          className="rounded-t-2xl border-border/60 px-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 sm:max-w-lg sm:mx-auto"
          side="bottom"
        >
          <SheetHeader className="px-4 pb-2 text-left sm:px-6">
            <SheetTitle className="font-commissioner text-xl font-light tracking-wide">
              {allDone ? "You're set" : "Your first steps"}
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed">
              {allDone
                ? "You've touched the main surfaces. Feature tips still appear in context until dismissed."
                : "Four quick wins — the layout stays put; this sheet is your map."}
            </SheetDescription>
          </SheetHeader>

          <ol className="max-h-[min(52dvh,24rem)] space-y-2 overflow-y-auto overscroll-contain px-4 pb-2 sm:px-6">
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
                      setOpen(false);
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

          <div className="border-t border-border/40 px-4 pt-3 sm:px-6">
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              Tips use spotlight overlays and drawers — they never rearrange the UI you see behind them.
            </p>
            {allDone ? (
              <Button className="h-9 w-full" type="button" onClick={dismiss}>
                Got it
              </Button>
            ) : (
              <Button className="h-9 w-full" type="button" variant="ghost" onClick={dismiss}>
                Dismiss guide
              </Button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
