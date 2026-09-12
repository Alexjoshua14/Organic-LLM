"use client";

import { snapshot, type Vector4 } from "@organic-llm/morph-physics";
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

import { RABBIT_HOLE_COMPOSER_MORPH_SPRING } from "@/lib/rabbit-holes/desktop-chat-morph-springs";
import { cn } from "@/lib/utils";

type ComposerDock = "center" | "sidebar";

type RabbitHoleDesktopChatMorphProps = {
  chatOpen: boolean;
  gutterClassName?: string;
  children: (opts: { composerDock: ComposerDock }) => ReactNode;
};

function ComposerMeasureShell({
  dock,
  gutterClassName,
  children,
}: {
  dock: ComposerDock;
  gutterClassName?: string;
  children: ReactNode;
}) {
  if (dock === "center") {
    return (
      <div className={cn("pointer-events-none mx-auto w-full max-w-2xl px-4", gutterClassName)}>
        <div className="sticky bottom-6 pt-4">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("pointer-events-none w-full px-3 pb-2", gutterClassName)}>
      {children}
    </div>
  );
}

export function RabbitHoleDesktopChatMorph({
  chatOpen,
  gutterClassName,
  children,
}: RabbitHoleDesktopChatMorphProps) {
  const reduceMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const centerGhostRef = useRef<HTMLDivElement | null>(null);
  const sidebarGhostRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<ComposerDock>(chatOpen ? "sidebar" : "center");
  const centerVecRef = useRef<Vector4 | null>(null);
  const sidebarVecRef = useRef<Vector4 | null>(null);
  const [springConfig, setSpringConfig] = useState(RABBIT_HOLE_COMPOSER_MORPH_SPRING);

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: springConfig,
  });

  const measureAndSync = useCallback(() => {
    const stage = stageRef.current;
    const centerEl = centerGhostRef.current;
    const sidebarEl = sidebarGhostRef.current;

    if (!stage || !centerEl || !sidebarEl) return;

    const centerVec = snapshot(centerEl, stage);
    const sidebarVec = snapshot(sidebarEl, stage);

    centerVecRef.current = centerVec;
    sidebarVecRef.current = sidebarVec;

    const current = dockRef.current === "center" ? centerVec : sidebarVec;

    reset(current);
  }, [reset]);

  const applyDock = useCallback(
    (next: ComposerDock) => {
      const centerVec = centerVecRef.current;
      const sidebarVec = sidebarVecRef.current;

      if (!centerVec || !sidebarVec) return;

      dockRef.current = next;

      if (reduceMotion) {
        reset(next === "center" ? centerVec : sidebarVec);
      } else {
        morphTo(next === "center" ? centerVec : sidebarVec);
      }
    },
    [morphTo, reduceMotion, reset]
  );

  useLayoutEffect(() => {
    measureAndSync();
  }, [measureAndSync]);

  useLayoutEffect(() => {
    flushSync(() => {
      setSpringConfig(RABBIT_HOLE_COMPOSER_MORPH_SPRING);
    });
    applyDock(chatOpen ? "sidebar" : "center");
  }, [applyDock, chatOpen]);

  useEffect(() => {
    window.addEventListener("resize", measureAndSync);

    return () => window.removeEventListener("resize", measureAndSync);
  }, [measureAndSync]);

  return (
    <div ref={stageRef} className="relative min-h-0 flex-1">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-0"
      >
        <ComposerMeasureShell dock="center" gutterClassName={gutterClassName}>
          <div ref={centerGhostRef} className="w-full" />
        </ComposerMeasureShell>
        <ComposerMeasureShell dock="sidebar" gutterClassName={gutterClassName}>
          <div ref={sidebarGhostRef} className="w-full" />
        </ComposerMeasureShell>
      </div>

      <div ref={elementRef} className="pointer-events-auto z-40 w-full">
        {children({ composerDock: chatOpen ? "sidebar" : "center" })}
      </div>
    </div>
  );
}
