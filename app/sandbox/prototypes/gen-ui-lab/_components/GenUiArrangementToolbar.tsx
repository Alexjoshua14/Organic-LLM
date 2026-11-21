"use client";

import type { ReactNode, TouchEvent } from "react";
import type { GenUiArrangementCycle } from "../_hooks/use-gen-ui-arrangement-cycle";

import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";
import { useRef } from "react";

const SWIPE_DISTANCE = 56;
const SWIPE_AXIS_RATIO = 1.2;
const SWIPE_TIME_MS = 700;

function horizontalScrollParent(target: EventTarget) {
  for (
    let element = target instanceof Element ? target : null;
    element;
    element = element.parentElement
  ) {
    if (
      element.scrollWidth > element.clientWidth &&
      /^(auto|scroll)$/.test(getComputedStyle(element).overflowX)
    ) {
      return element;
    }
  }

  return null;
}

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
        <div className="flex shrink-0 items-center gap-inline-xs">
          <span
            className="w-9 text-right text-xs tabular-nums text-muted-foreground"
            aria-label={`${Noun} ${index + 1} of ${count}`}
          >
            {index + 1} / {count}
          </span>
          <button
            type="button"
            aria-label={`Previous ${noun}`}
            className={`inline-flex size-9 items-center justify-center rounded-md pointer-coarse:size-11 ${TOOLBAR_CONTROL}`}
            onClick={() => step(-1)}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Next ${noun}`}
            className={`inline-flex size-9 items-center justify-center rounded-md pointer-coarse:size-11 ${TOOLBAR_CONTROL}`}
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
            className={`inline-flex min-h-9 items-center gap-inline-sm rounded-md px-inset-sm text-xs disabled:opacity-50 pointer-coarse:min-h-11 ${TOOLBAR_CONTROL}`}
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
      <p className="hidden text-xs text-muted-foreground pointer-coarse:block">
        Swipe the preview to browse {noun}s.
      </p>
      {/* Two lines are always reserved so a longer intent never moves the arrows or the preview.
          A phone drops the line (it stays as the tooltip): the page is the component. */}
      <p
        className="line-clamp-2 min-h-10 text-xs max-sm:hidden leading-relaxed text-muted-foreground"
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
  cycle: Pick<GenUiArrangementCycle, "count" | "step" | "setHovered" | "setFocused">;
}) {
  const swipe = useRef<{ x: number; y: number; time: number; id: number } | null>(null);

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    const target = event.target;
    const touch = event.touches[0];

    swipe.current = null;
    if (
      cycle.count < 2 ||
      event.touches.length !== 1 ||
      !touch ||
      (target instanceof Element &&
        target.closest("button, a, input, select, textarea, [contenteditable], [role=slider]")) ||
      horizontalScrollParent(target)
    ) {
      return;
    }

    swipe.current = { x: touch.clientX, y: touch.clientY, time: Date.now(), id: touch.identifier };
  }

  function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = swipe.current;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === start?.id);

    swipe.current = null;
    if (!start || !touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;

    if (
      Math.abs(dx) >= SWIPE_DISTANCE &&
      Math.abs(dx) >= Math.abs(dy) * SWIPE_AXIS_RATIO &&
      Date.now() - start.time <= SWIPE_TIME_MS
    ) {
      cycle.step(dx < 0 ? 1 : -1);
    }
  }

  return (
    <div
      className="min-h-full min-w-0 w-full"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        swipe.current = null;
      }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") cycle.setHovered(true);
      }}
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
