"use client";

import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Pause, Play } from "lucide-react";

import {
  DecisionMatrix,
  type DecisionArrangement,
} from "@/components/chat/gen-ui/blocks/DecisionMatrix";

/** Give each arrangement enough reading time; interaction restarts a full reading window. */
export const DECISION_DEMO_INTERVAL_MS = 8_000;

const ARRANGEMENTS: ReadonlyArray<{ id: DecisionArrangement; name: string; intent: string }> = [
  {
    id: "overview",
    name: "Whole picture",
    intent: "See the tradeoff shape and inspect one criterion across every option.",
  },
  {
    id: "recommendation",
    name: "Recommendation first",
    intent: "Lead with the recommendation, then inspect the evidence behind the choice.",
  },
  {
    id: "evidence",
    name: "Evidence focus",
    intent: "Bring the supporting detail forward when the reasoning matters most.",
  },
  {
    id: "head-to-head",
    name: "Head to head",
    intent: "Concentrate on a pair of options without changing the underlying comparison.",
  },
  {
    id: "compact",
    name: "Compact briefing",
    intent: "Keep the comparison close to the surrounding conversation with a smaller footprint.",
  },
];

export function useGenUiDecisionDemo(active = true) {
  const [index, setIndex] = useState(0);
  const [auto, setAuto] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const reducedMotion = useReducedMotion() === true;
  const arrangement = ARRANGEMENTS[index]!;

  useEffect(() => {
    const update = () => setVisible(!document.hidden);

    update();
    document.addEventListener("visibilitychange", update);

    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (!active || !auto || hovered || focused || !visible || reducedMotion) return;
    const timer = window.setInterval(
      () => setIndex((current) => (current + 1) % ARRANGEMENTS.length),
      DECISION_DEMO_INTERVAL_MS
    );

    return () => window.clearInterval(timer);
  }, [active, auto, hovered, focused, visible, reducedMotion]);

  const step = (direction: number) => {
    setAuto(false);
    setIndex((current) => (current + direction + ARRANGEMENTS.length) % ARRANGEMENTS.length);
  };

  return {
    index,
    arrangement,
    auto,
    reducedMotion,
    step,
    toggleAuto: () => setAuto((current) => !current),
    setHovered,
    setFocused,
  };
}

type DecisionDemoState = ReturnType<typeof useGenUiDecisionDemo>;

/** Stays outside the scrolling, centered preview so arrangements cannot move its controls. */
export function GenUiDecisionDemoToolbar({ demo }: { demo: DecisionDemoState }) {
  const { index, arrangement, auto, reducedMotion, step, toggleAuto } = demo;

  return (
    <div className="shrink-0 space-y-1 border-b border-border/40 px-2 pb-3">
      <div
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2"
        role="group"
        aria-label="Comparison demo arrangements"
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
            aria-label={`Arrangement ${index + 1} of ${ARRANGEMENTS.length}`}
          >
            {index + 1} / {ARRANGEMENTS.length}
          </span>
          <button
            type="button"
            aria-label="Previous arrangement"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
            onClick={() => step(-1)}
          >
            <ArrowLeft aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next arrangement"
            className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none"
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
                : "Cycle arrangements; pauses while you interact"
            }
            className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted/40 hover:text-foreground focus-visible:bg-foreground focus-visible:text-background focus-visible:outline-none disabled:opacity-50"
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
      <p className="text-xs leading-relaxed text-muted-foreground">{arrangement.intent}</p>
    </div>
  );
}

export function GenUiDecisionDemo({
  block,
  demo,
}: {
  block: DecisionMatrixBlock;
  demo: DecisionDemoState;
}) {
  return (
    <div
      className="min-w-0 w-full"
      onPointerEnter={() => demo.setHovered(true)}
      onPointerLeave={() => demo.setHovered(false)}
      onFocusCapture={() => demo.setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null))
          demo.setFocused(false);
      }}
    >
      <DecisionMatrix block={block} arrangement={demo.arrangement.id} />
    </div>
  );
}
