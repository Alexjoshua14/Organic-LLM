"use client";

import {
  clearInlineStyles,
  regular_spring_config,
  snapshot,
  type Vector4,
} from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { usePageVisible } from "@/components/hooks/use-page-visible";
import { useWelcomeInView } from "@/components/pages/welcome/use-welcome-in-view";
import { welcomeDemoCompactClass } from "@/components/pages/welcome/welcome-demo-user-message";
import { WELCOME_GEN_UI_BLOCKS } from "@/lib/welcome/gen-ui-fixtures";
import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import { sectionLabel } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type WelcomeGenUiIllustrationProps = {
  className?: string;
};

const CYCLE_MS = 5500;

const PLAN_BLOCK_INDEX = WELCOME_GEN_UI_BLOCKS.findIndex((block) => block.type === "plan-timeline");

/** Full column width — matrix table needs ~320px+; narrow caps clip columns. */
const BLOCK_SHELL_CLASS = "w-full min-w-0";

/** Extra bottom padding inside the Plan GenUIWrapper body only. */
const PLAN_INNER_CARD_CLASS = "[&_.border-b+div]:!pb-4";

function blockShellClass(block: GenUIBlock) {
  return cn(BLOCK_SHELL_CLASS, block.type === "plan-timeline" && PLAN_INNER_CARD_CLASS);
}

function ghostAnchorClass(block: GenUIBlock) {
  return cn("absolute top-0 left-0 w-full", blockShellClass(block));
}

function blockHeightBuffer(index: number): number {
  return index === PLAN_BLOCK_INDEX ? 36 : 12;
}

const GEN_UI_SHELL_CLASS = cn(
  welcomeDemoCompactClass,
  "[&_.border-b]:px-2.5 [&_.border-b]:py-1.5",
  "[&_.border-b+div]:px-2.5 [&_.border-b+div]:py-2.5"
);

const FRAME_CLASS =
  "pointer-events-none flex w-full min-w-0 flex-col justify-start px-2.5 py-1.5 sm:px-3 sm:py-2";

const STAGE_CLASS = cn(
  "relative w-full min-w-0 overflow-hidden",
  GEN_UI_SHELL_CLASS,
  "[&_table]:min-w-0 [&_table]:w-full",
  "[&_th]:min-w-0 [&_td]:px-1.5 [&_th]:px-1.5"
);

const CONTENT_MORPH_TRANSITION = { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const };

const MORPH_SHELL_CLASS =
  "absolute top-0 left-0 z-10 w-full overflow-hidden rounded-lg will-change-[transform,width,height]";

const ARIA_LABEL =
  "Structured in-thread Gen UI: answer cards, decision matrices, and plan timelines morph between block types.";

function computeFixedStageHeight(heights: number[]): number {
  if (heights.length === 0) return 0;

  return Math.max(...heights.map((height, index) => height + blockHeightBuffer(index)));
}

function centeredMorphTarget(vector: Vector4, index: number, fixedStageHeight: number): Vector4 {
  const h = vector.h + blockHeightBuffer(index);

  return {
    ...vector,
    y: (fixedStageHeight - h) / 2,
    h,
  };
}

export function WelcomeGenUiIllustration({ className }: WelcomeGenUiIllustrationProps) {
  const reduce = useReducedMotion();
  const pageVisible = usePageVisible();
  const rootRef = useRef<HTMLDivElement>(null);
  const inView = useWelcomeInView(rootRef);
  const stageRef = useRef<HTMLDivElement>(null);
  const ghostRefs = useRef<(HTMLDivElement | null)[]>([]);
  const vectorRefs = useRef<(Vector4 | null)[]>([]);
  const fixedStageHeightRef = useRef(0);
  const activeIndexRef = useRef(0);
  const prevIndexRef = useRef(0);
  const primedRef = useRef(false);

  const [activeIndex, setActiveIndex] = useState(0);
  const [fixedStageHeight, setFixedStageHeight] = useState<number | undefined>(undefined);

  const { elementRef, morphTo, reset } = useMorphPhysics({
    config: regular_spring_config,
  });

  const measureAllTargets = useCallback(() => {
    const stage = stageRef.current;

    if (!stage) return false;

    const vectors = WELCOME_GEN_UI_BLOCKS.map((_, index) => {
      const ghost = ghostRefs.current[index];

      if (!ghost) return null;

      const vector = snapshot(ghost, stage);
      const measuredHeight = Math.max(vector.h, ghost.offsetHeight, ghost.scrollHeight);

      return { ...vector, h: measuredHeight };
    });

    if (vectors.some((vector) => vector === null)) return false;

    vectorRefs.current = vectors;
    const heights = vectors.map((vector) => vector!.h);
    const nextFixedHeight = computeFixedStageHeight(heights);

    fixedStageHeightRef.current = nextFixedHeight;
    setFixedStageHeight(nextFixedHeight);

    return true;
  }, []);

  const morphTargetForIndex = useCallback((index: number): Vector4 | null => {
    const vector = vectorRefs.current[index];

    if (!vector) return null;

    return centeredMorphTarget(vector, index, fixedStageHeightRef.current);
  }, []);

  const syncShellToIndex = useCallback(
    (index: number, animate: boolean) => {
      const target = morphTargetForIndex(index);

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
    [elementRef, morphTargetForIndex, morphTo, reduce, reset]
  );

  useLayoutEffect(() => {
    if (!measureAllTargets()) return;

    primedRef.current = true;
    syncShellToIndex(activeIndexRef.current, false);
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

  useLayoutEffect(() => {
    if (!primedRef.current || !active || reduce) return;
    if (prevIndexRef.current === activeIndex) return;

    prevIndexRef.current = activeIndex;
    syncShellToIndex(activeIndex, true);
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

  const frameClass = cn(FRAME_CLASS, className);

  if (reduce) {
    return (
      <div ref={rootRef} aria-label={ARIA_LABEL} className={frameClass} role="img">
        <div className="mb-1.5 flex w-full items-baseline justify-between gap-3">
          <p className={sectionLabel}>Generative UI</p>
        </div>
        <div className={cn(STAGE_CLASS, "flex items-center justify-center")}>
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
      <div className="mb-1.5 flex w-full items-baseline justify-between gap-3">
        <p className={sectionLabel}>Generative UI</p>
        <span className="text-[10px] font-light tracking-wide text-muted-foreground/70">
          {blockLabel}
        </span>
      </div>

      <div
        ref={stageRef}
        className={STAGE_CLASS}
        style={fixedStageHeight !== undefined ? { height: fixedStageHeight } : undefined}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0">
          {WELCOME_GEN_UI_BLOCKS.map((block, index) => (
            <div
              key={block.type}
              ref={(node) => {
                ghostRefs.current[index] = node;
              }}
              className={ghostAnchorClass(block)}
            >
              <GenUIRenderer data={{ block }} messageId={`welcome-gen-ui-ghost-${index}`} />
            </div>
          ))}
        </div>

        <div ref={elementRef} className={MORPH_SHELL_CLASS}>
          <AnimatePresence initial={false}>
            <motion.div
              key={activeBlock.type}
              animate={{ opacity: 1 }}
              className={cn("absolute inset-0", blockShellClass(activeBlock))}
              exit={{ opacity: 0 }}
              initial={{ opacity: 0 }}
              transition={CONTENT_MORPH_TRANSITION}
            >
              <GenUIRenderer data={{ block: activeBlock }} messageId="welcome-gen-ui-live" />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
