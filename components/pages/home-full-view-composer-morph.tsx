"use client";

import {
  snapshot,
  type Vector4,
} from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useReducedMotion } from "framer-motion";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";

import {
  fullViewComposerExpandSpring,
  fullViewComposerSpringForDock,
} from "@/lib/homepage/full-view-composer-springs";
import { cn } from "@/lib/utils";

type ComposerDock = "engaged" | "docked";

type HomeFullViewComposerMorphProps = {
  engaged: boolean;
  gutterClassName: string;
  children: (opts: { composerDocked: boolean }) => React.ReactNode;
};

/** Bottom offset for docked composer — clears the full-view primary-actions chrome. */
const DOCKED_BOTTOM_OFFSET = "5.75rem";

function ComposerMeasureShell({
  dock,
  gutterClassName,
  children,
}: {
  dock: ComposerDock;
  gutterClassName: string;
  children: ReactNode;
}) {
  if (dock === "engaged") {
    return (
      <div
        className={cn(
          "mx-auto flex w-full max-w-2xl flex-col justify-start pt-20",
          gutterClassName
        )}
      >
        <div className="flex min-h-0 w-full flex-1 flex-col">{children}</div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col justify-end pb-2",
        gutterClassName
      )}
      style={{ marginBottom: DOCKED_BOTTOM_OFFSET }}
    >
      {children}
    </div>
  );
}

export function HomeFullViewComposerMorph({
  engaged,
  gutterClassName,
  children,
}: HomeFullViewComposerMorphProps) {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const engagedGhostRef = useRef<HTMLDivElement | null>(null);
  const dockedGhostRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<ComposerDock>(engaged ? "engaged" : "docked");
  const engagedVecRef = useRef<Vector4 | null>(null);
  const dockedVecRef = useRef<Vector4 | null>(null);
  const [springConfig, setSpringConfig] = useState(fullViewComposerExpandSpring);

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: springConfig,
  });

  const measureAndSync = useCallback(() => {
    const stage = stageRef.current;
    const engagedEl = engagedGhostRef.current;
    const dockedEl = dockedGhostRef.current;

    if (!stage || !engagedEl || !dockedEl) return;

    const engagedVec = snapshot(engagedEl, stage);
    const dockedVec = snapshot(dockedEl, stage);

    engagedVecRef.current = engagedVec;
    dockedVecRef.current = dockedVec;

    const current = dockRef.current === "engaged" ? engagedVec : dockedVec;

    reset(current);
  }, [reset]);

  const applyDock = useCallback(
    (next: ComposerDock) => {
      const engagedVec = engagedVecRef.current;
      const dockedVec = dockedVecRef.current;

      if (!engagedVec || !dockedVec) return;

      dockRef.current = next;
      morphTo(next === "engaged" ? engagedVec : dockedVec);
    },
    [morphTo]
  );

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      measureAndSync();
    });

    return () => cancelAnimationFrame(id);
  }, [measureAndSync]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        measureAndSync();
      });
    });

    ro.observe(stage);

    return () => ro.disconnect();
  }, [measureAndSync]);

  useEffect(() => {
    const next: ComposerDock = engaged ? "engaged" : "docked";

    if (reduceMotion) {
      dockRef.current = next;
      const target =
        next === "engaged" ? engagedVecRef.current : dockedVecRef.current;

      if (target) reset(target);

      return;
    }

    flushSync(() => {
      setSpringConfig(fullViewComposerSpringForDock(next));
    });
    applyDock(next);
  }, [applyDock, engaged, reduceMotion, reset]);

  const composerDocked = !engaged;

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1 w-full">
      <div
        ref={engagedGhostRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-0 opacity-0"
      >
        <ComposerMeasureShell dock="engaged" gutterClassName={gutterClassName}>
          {children({ composerDocked: false })}
        </ComposerMeasureShell>
      </div>
      <div
        ref={dockedGhostRef}
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 z-0 opacity-0"
      >
        <ComposerMeasureShell dock="docked" gutterClassName={gutterClassName}>
          {children({ composerDocked: true })}
        </ComposerMeasureShell>
      </div>

      <div
        ref={elementRef}
        className={cn(
          "pointer-events-auto absolute top-0 left-0 z-10 overflow-hidden",
          "will-change-[transform,width,height]"
        )}
      >
        <div className="h-full w-full min-h-0">
          {children({ composerDocked })}
        </div>
      </div>
    </div>
  );
}
