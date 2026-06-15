"use client";

import {
  clearInlineStyles,
  regular_spring_config,
  snapshot,
  type Vector4,
} from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import { WELCOME_GEN_UI_BLOCKS } from "@/lib/welcome/gen-ui-fixtures";
import { sectionLabel } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type WelcomeGenUiIllustrationProps = {
  className?: string;
};

const CYCLE_MS = 5500;

/** Full column width — matrix table needs ~320px+; narrow caps clip columns. */
const BLOCK_SHELL_CLASS = "w-full min-w-0";

const GHOST_ANCHOR_CLASS = cn("absolute top-0 left-1/2 -translate-x-1/2", BLOCK_SHELL_CLASS);

const ARIA_LABEL =
  "Structured in-thread Gen UI: answer cards, decision matrices, and plan timelines morph between block types.";

export function WelcomeGenUiIllustration({ className }: WelcomeGenUiIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const stageRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const vectorRefs = useRef<(Vector4 | null)[]>([]);
  const activeIndexRef = useRef(0);
  const prevIndexRef = useRef(0);
  const primedRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [stageMinHeight, setStageMinHeight] = useState<number | undefined>(undefined);
  const [contentOpacity, setContentOpacity] = useState(1);

  const { elementRef, morphTo, reset } = useMorphPhysics({
    config: regular_spring_config,
  });

  const measureAllTargets = useCallback(() => {
    const stage = stageRef.current;

    if (!stage) return false;

    const vectors = WELCOME_GEN_UI_BLOCKS.map((_, index) => {
      const ghost = ghostRefs.current[index];

      if (!ghost) return null;

      return snapshot(ghost, stage);
    });

    if (vectors.some((vector) => vector === null)) return false;

    vectorRefs.current = vectors;
    setStageMinHeight(Math.max(...vectors.map((vector) => vector!.h)));

    return true;
  }, []);

  const syncShellToIndex = useCallback(
    (index: number, animate: boolean) => {
      const target = vectorRefs.current[index];

      if (!target) return;

      activeIndexRef.current = index;

      if (!animate || reduce) {
        reset(target);

        return;
      }

      const shell = elementRef.current;

      if (shell) clearInlineStyles(shell);
      morphTo(target);
    },
    [elementRef, morphTo, reduce, reset]
  );

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!measureAllTargets()) return;

      primedRef.current = true;
      syncShellToIndex(activeIndexRef.current, false);
    });

    return () => cancelAnimationFrame(id);
  }, [measureAllTargets, syncShellToIndex]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!measureAllTargets()) return;
        syncShellToIndex(activeIndexRef.current, false);
      });
    });

    observer.observe(stage);

    return () => observer.disconnect();
  }, [measureAllTargets, syncShellToIndex]);

  const active = inView && pageVisible && !reduce;

  useEffect(() => {
    if (!primedRef.current || !active || reduce) return;
    if (prevIndexRef.current === activeIndex) return;

    prevIndexRef.current = activeIndex;
    setContentOpacity(0.88);
    const fadeIn = requestAnimationFrame(() => setContentOpacity(1));

    syncShellToIndex(activeIndex, true);

    return () => cancelAnimationFrame(fadeIn);
  }, [active, activeIndex, reduce, syncShellToIndex]);

  useEffect(() => {
    if (active) return;

    prevIndexRef.current = 0;
    setActiveIndex(0);
    if (primedRef.current) {
      syncShellToIndex(0, false);
    }
  }, [active, syncShellToIndex]);

  useEffect(() => {
    if (!active || !primedRef.current) return;

    const interval = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % WELCOME_GEN_UI_BLOCKS.length);
    }, CYCLE_MS);

    return () => window.clearInterval(interval);
  }, [active]);

  const activeBlock = WELCOME_GEN_UI_BLOCKS[activeIndex]!;
  const blockLabel = GEN_UI_REGISTRY[activeBlock.type].label;

  const frameClass = cn(
    "pointer-events-none flex h-full w-full min-h-0 flex-col justify-center px-3 py-4 sm:px-4 sm:py-5",
    className
  );

  const stageClass = cn(
    "relative w-full min-w-0",
    "[&_table]:min-w-0 [&_table]:w-full",
    "[&_th]:min-w-0 [&_td]:px-1.5 [&_th]:px-1.5"
  );

  if (reduce) {
    return (
      <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
        <p className={cn(sectionLabel, "mb-3 text-center")}>In-thread block</p>
        <div className={cn(stageClass, "flex justify-center")}>
          <div className={BLOCK_SHELL_CLASS}>
            <GenUIRenderer
              data={{ block: WELCOME_GEN_UI_BLOCKS[0] }}
              messageId="welcome-gen-ui-static"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
      <div className="mb-3 flex shrink-0 items-baseline justify-center gap-3">
        <p className={sectionLabel}>In-thread block</p>
        <span className="text-xs font-light tracking-wide text-muted-foreground/70">
          {blockLabel}
        </span>
      </div>

      <div
        ref={stageRef}
        className={stageClass}
        style={stageMinHeight !== undefined ? { minHeight: stageMinHeight } : undefined}
      >
        <div aria-hidden className="pointer-events-none invisible absolute inset-0">
          {WELCOME_GEN_UI_BLOCKS.map((block, index) => (
            <div
              key={block.type}
              ref={(node) => {
                ghostRefs.current[index] = node;
              }}
              className={GHOST_ANCHOR_CLASS}
            >
              <GenUIRenderer data={{ block }} messageId={`welcome-gen-ui-ghost-${index}`} />
            </div>
          ))}
        </div>

        <div
          ref={elementRef}
          className="absolute top-0 left-0 z-10 w-fit overflow-visible will-change-[transform,width,height]"
        >
          <div
            className={cn("transition-opacity duration-200 ease-out", BLOCK_SHELL_CLASS)}
            style={{ opacity: contentOpacity }}
          >
            <GenUIRenderer data={{ block: activeBlock }} messageId="welcome-gen-ui-live" />
          </div>
        </div>
      </div>
    </div>
  );
}
