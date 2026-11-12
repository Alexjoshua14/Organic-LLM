"use client";

import type { ReactNode } from "react";
import type { GenUiArrangementCycle } from "../_hooks/use-gen-ui-arrangement-cycle";

import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";

/** Keyboard focus inverts the control (background + text), never a ring. */
export const TOOLBAR_CONTROL =
  "text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none";

type GenUiArrangementToolbarProps = {
  cycle: GenUiArrangementCycle;
  /** Accessible name of the control group, e.g. "Comparison demo arrangements". */
  groupLabel: string;
  /** Singular noun used in control names: "arrangement" gives "Next arrangement". */
  noun?: string;
  /** A second control row (e.g. a language picker) between the arrows and the intent line. */
  extra?: ReactNode;
};

/**
 * A gallery section `header`: it stays outside the centred preview, so a taller or shorter
 * arrangement cannot move its controls.
 */
export function GenUiArrangementToolbar({
  cycle,
  groupLabel,
  noun = "arrangement",
  extra,
}: GenUiArrangementToolbarProps) {
  const { index, count, arrangement, auto, reducedMotion, step, toggleAuto } = cycle;
  const Noun = noun.charAt(0).toUpperCase() + noun.slice(1);

  return (
    <div className="shrink-0 space-y-stack-xs border-b border-border/40 pb-stack-md">
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-inline-sm"
        role="group"
        aria-label={groupLabel}
      >
        <p
          className="min-w-0 truncate text-sm font-medium text-foreground"
          aria-live="polite"
          title={arrangement.name}
        >
          {arrangement.name}
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <span
            className="w-9 text-right text-xs tabular-nums text-muted-foreground"
            aria-label={`${Noun} ${index + 1} of ${count}`}
          >
            {index + 1} / {count}
          </span>
          <button
            type="button"
            aria-label={`Previous ${noun}`}
            className={`inline-flex size-9 items-center justify-center rounded-md ${TOOLBAR_CONTROL}`}
            onClick={() => step(-1)}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Next ${noun}`}
            className={`inline-flex size-9 items-center justify-center rounded-md ${TOOLBAR_CONTROL}`}
            onClick={() => step(1)}
          >
            <ArrowRight aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-pressed={auto && !reducedMotion}
            disabled={reducedMotion}
            title={
              reducedMotion
                ? "Automatic cycling is off with reduced motion"
                : `Cycle ${noun}s; pauses while you interact`
            }
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs disabled:opacity-50 ${TOOLBAR_CONTROL}`}
            onClick={toggleAuto}
          >
            {auto && !reducedMotion ? (
              <Pause aria-hidden className="size-3.5" />
            ) : (
              <Play aria-hidden className="size-3.5" />
            )}{" "}
            Auto
          </button>
        </div>
      </div>
      {extra}
      {/* Two lines are always reserved so a longer intent never moves the arrows or the preview. */}
      <p
        className="line-clamp-2 min-h-10 text-xs leading-relaxed text-muted-foreground"
        title={arrangement.intent}
      >
        {arrangement.intent}
      </p>
    </div>
  );
}

/** Wraps the live preview so pointing at it or focusing inside it pauses Auto. */
export function GenUiArrangementPauseZone({
  children,
  cycle,
}: {
  children: ReactNode;
  cycle: { setHovered: (value: boolean) => void; setFocused: (value: boolean) => void };
}) {
  return (
    <div
      className="min-w-0 w-full"
      onPointerEnter={() => cycle.setHovered(true)}
      onPointerLeave={() => cycle.setHovered(false)}
      onFocusCapture={() => cycle.setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          cycle.setFocused(false);
      }}
    >
      {children}
    </div>
  );
}
