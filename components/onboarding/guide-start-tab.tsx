"use client";

import { ArrowUpRight, Check } from "lucide-react";
import Link from "next/link";

import { useOnboarding } from "./onboarding-context";

import { useAionLauncher } from "@/components/aion-launcher/aion-launcher";
import { Button } from "@/components/third-party/ui/button";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useOnboardingSnapshot } from "@/hooks/use-onboarding";
import { threadEntryPrefetch } from "@/lib/chat/thread-entry-navigation";
import { CHECKLIST_STEPS, type ChecklistStep } from "@/lib/onboarding/checklist";
import { guideSurfaces } from "@/lib/onboarding/guide-surfaces";
import { onboardingActions } from "@/lib/onboarding/onboarding-actions";
import { checklistProgress } from "@/lib/onboarding/onboarding-state";
import { cn } from "@/lib/utils";

const sectionLabel = "text-2xs font-medium uppercase tracking-[0.16em] text-muted-foreground/80";

function StepAction({
  step,
  done,
  onHandoff,
}: {
  step: ChecklistStep;
  done: boolean;
  onHandoff: () => void;
}) {
  const launcher = useAionLauncher();
  const className = cn(
    "h-11 shrink-0 px-3 text-xs sm:h-8",
    done && "text-muted-foreground max-sm:-ml-3"
  );
  const variant = done ? "ghost" : "secondary";

  if (step.action.kind === "launcher") {
    return (
      <Button
        className={className}
        size="sm"
        type="button"
        variant={variant}
        onClick={() => {
          onHandoff();
          launcher.setOpen(true);
        }}
      >
        {step.action.label}
      </Button>
    );
  }

  return (
    <Button asChild className={className} size="sm" variant={variant}>
      <Link
        href={step.action.href}
        prefetch={threadEntryPrefetch(step.action.href)}
        onClick={onHandoff}
      >
        {step.action.label}
      </Link>
    </Button>
  );
}

function Checklist({ onHandoff }: { onHandoff: () => void }) {
  const { state } = useOnboardingSnapshot();
  const progress = checklistProgress(state);

  if (state.checklist.hiddenAt != null) {
    return (
      <p className="text-xs text-muted-foreground">
        First steps are hidden.{" "}
        <button
          className="organic-focus inline-flex min-h-11 cursor-pointer items-center rounded-sm text-foreground underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground sm:min-h-0"
          type="button"
          onClick={() => onboardingActions.setChecklistHidden(false)}
        >
          Show them
        </button>
      </p>
    );
  }

  return (
    <section aria-labelledby="guide-first-steps" className="flex flex-col gap-stack-sm">
      <div className="flex items-center justify-between gap-inline-sm">
        <h3 className={sectionLabel} id="guide-first-steps">
          First steps
        </h3>
        <div className="flex items-center gap-inline-sm text-xs text-muted-foreground">
          <span aria-live="polite" className="tabular-nums">
            {progress.complete ? "All done" : `${progress.done} of ${progress.total} done`}
          </span>
          <button
            className="organic-focus min-h-11 cursor-pointer rounded-sm px-2 hover:text-foreground sm:min-h-0 sm:py-1"
            type="button"
            onClick={() => onboardingActions.setChecklistHidden(true)}
          >
            Hide
          </button>
        </div>
      </div>
      <ol className="flex flex-col gap-stack-sm">
        {CHECKLIST_STEPS.map((step, index) => {
          const done = state.checklist.done[step.id] != null;

          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-inline-md rounded-xl border px-inset-md py-inset-md",
                done ? "border-border/30 bg-muted/10" : "border-border/50 bg-background/40"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-2xs font-medium tabular-nums",
                  done
                    ? "border-lumen/40 bg-lumen/15 text-foreground"
                    : "border-border/60 text-muted-foreground"
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={2} /> : index + 1}
              </span>
              {/* Narrow screens stack the action under the text so the text keeps its width. */}
              <div className="flex min-w-0 flex-1 flex-col items-start gap-stack-sm sm:flex-row sm:justify-between sm:gap-inline-md">
                <div className="min-w-0">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      done ? "text-muted-foreground" : "text-foreground"
                    )}
                  >
                    {step.title}
                    {done ? <span className="sr-only"> (done)</span> : null}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {step.body}
                  </p>
                </div>
                <StepAction done={done} step={step} onHandoff={onHandoff} />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Surfaces({ onHandoff }: { onHandoff: () => void }) {
  const isAdmin = useIsAdmin() === true;

  return (
    <section aria-labelledby="guide-surfaces" className="flex flex-col gap-stack-sm">
      <h3 className={sectionLabel} id="guide-surfaces">
        Surfaces
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Open the sidebar to switch between these parts of Organic.
      </p>
      <ul className="grid gap-stack-sm sm:grid-cols-2">
        {guideSurfaces({ isAdmin }).map((surface) => (
          <li key={surface.id}>
            <Link
              className={cn(
                "organic-focus group flex h-full items-start justify-between gap-inline-sm rounded-xl border border-border/50 px-inset-md py-inset-md no-underline transition-colors",
                "hover:border-border hover:bg-muted/20"
              )}
              href={surface.href}
              prefetch={threadEntryPrefetch(surface.href)}
              onClick={onHandoff}
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground">{surface.label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {surface.summary}
                </span>
              </span>
              <ArrowUpRight
                aria-hidden
                className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-foreground"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Guide → Start here: what Organic is, first steps (signed in), and every surface. */
export function GuideStartTab({ onHandoff }: { onHandoff: () => void }) {
  const { signedIn } = useOnboarding();

  return (
    <div className="flex flex-col gap-stack-2xl px-5 py-5 sm:px-6">
      <section className="flex flex-col gap-stack-sm">
        <p className="text-sm leading-relaxed text-foreground">
          Use Organic to ask questions, explore research, and make plans. With Memory enabled,
          Organic can use what you’ve shared in earlier conversations to inform a reply.
        </p>
        {!signedIn ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Sign in to start a thread and track your first steps.
          </p>
        ) : null}
      </section>
      {signedIn ? <Checklist onHandoff={onHandoff} /> : null}
      <Surfaces onHandoff={onHandoff} />
    </div>
  );
}
