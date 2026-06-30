"use client";

import type { ReactNode } from "react";

import { snapshot, regular_spring_config, type Vector4 } from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type ComposerAssistMorphMode = "edit" | "drafting";

type ComposerAssistMorphBodyProps = {
  mode: ComposerAssistMorphMode;
  /** Changes when inner content size may change (text length, etc.). */
  measureFingerprint: string;
  editMeasure: ReactNode;
  draftMeasure: ReactNode;
  children: ReactNode;
  className?: string;
};

const BODY_MEASURE_CLASS =
  "w-full min-h-11 max-h-40 overflow-hidden px-3 py-3 text-base md:text-sm whitespace-pre-wrap break-words";

export function ComposerAssistMorphBody({
  mode,
  measureFingerprint,
  editMeasure,
  draftMeasure,
  children,
  className,
}: ComposerAssistMorphBodyProps) {
  const prefersReducedMotion = useReducedMotion();
  const reduce = prefersReducedMotion === true;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const editGhostRef = useRef<HTMLDivElement | null>(null);
  const draftGhostRef = useRef<HTMLDivElement | null>(null);
  const editVectorRef = useRef<Vector4 | null>(null);
  const draftVectorRef = useRef<Vector4 | null>(null);
  const modeRef = useRef<ComposerAssistMorphMode>(mode);
  const initializedRef = useRef(false);

  const [stageMinHeight, setStageMinHeight] = useState<number | undefined>();

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: regular_spring_config,
  });

  const vectorForMode = useCallback((nextMode: ComposerAssistMorphMode) => {
    return nextMode === "drafting" ? draftVectorRef.current : editVectorRef.current;
  }, []);

  const applyModeTarget = useCallback(
    (nextMode: ComposerAssistMorphMode, immediate: boolean) => {
      const target = vectorForMode(nextMode);

      if (!target) return;
      if (immediate || reduce) {
        reset(target);

        return;
      }
      morphTo(target);
    },
    [morphTo, reduce, reset, vectorForMode]
  );

  const measureTargets = useCallback(() => {
    const stage = stageRef.current;
    const editGhost = editGhostRef.current;
    const draftGhost = draftGhostRef.current;

    if (!stage || !editGhost || !draftGhost) return false;

    const editVec = snapshot(editGhost, stage);
    const draftVec = snapshot(draftGhost, stage);

    editVectorRef.current = editVec;
    draftVectorRef.current = draftVec;
    setStageMinHeight(Math.max(editVec.h, draftVec.h, 44));

    return true;
  }, []);

  useLayoutEffect(() => {
    modeRef.current = mode;
    const id = requestAnimationFrame(() => {
      if (!measureTargets()) return;

      if (!initializedRef.current) {
        initializedRef.current = true;
        const initial = vectorForMode(mode);

        if (initial) reset(initial);

        return;
      }

      applyModeTarget(mode, reduce);
    });

    return () => cancelAnimationFrame(id);
  }, [measureFingerprint, mode, applyModeTarget, measureTargets, reduce, reset, vectorForMode]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        if (!measureTargets()) return;
        applyModeTarget(modeRef.current, reduce);
      });
    });

    observer.observe(stage);

    return () => observer.disconnect();
  }, [applyModeTarget, measureTargets, reduce]);

  return (
    <div
      ref={stageRef}
      className={cn("relative w-full min-w-0 max-w-full", className)}
      style={stageMinHeight != null ? { minHeight: stageMinHeight } : undefined}
    >
      <div
        ref={editGhostRef}
        aria-hidden
        className={cn("pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0", BODY_MEASURE_CLASS)}
      >
        {editMeasure}
      </div>
      <div
        ref={draftGhostRef}
        aria-hidden
        className={cn("pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0", BODY_MEASURE_CLASS)}
      >
        {draftMeasure}
      </div>
      <div
        ref={elementRef}
        className="absolute top-0 left-0 z-10 w-full overflow-hidden will-change-[transform,width,height]"
      >
        <div className="min-h-full w-full">{children}</div>
      </div>
    </div>
  );
}
