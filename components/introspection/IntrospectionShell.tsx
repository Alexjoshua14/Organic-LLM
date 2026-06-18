"use client";

import type { ReactNode } from "react";
import type { Vector4 } from "@organic-llm/morph-physics";

import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { snapshot, regular_spring_config } from "@organic-llm/morph-physics";
import { useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { IntrospectionNav } from "./IntrospectionNav";
import { IntrospectionOverview } from "./IntrospectionOverview";
import { IntrospectionStreamPanel } from "./IntrospectionStreamPanel";

import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { glass } from "@/components/design-system/primitives";
import type { IntrospectionGuidedState } from "@/lib/schemas/introspection";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import { ChatAIActionEnum } from "@/types/ai";

type IntrospectionShellProps = {
  guidedState: IntrospectionGuidedState;
  messages: UIMessage[];
  chatId: string;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
  };
  composer: ReactNode;
  playEntryMorph?: boolean;
};

function useDesktopLayout() {
  const [desktop, setDesktop] = useState(() => {
    if (typeof window === "undefined") return false;

    return window.matchMedia("(min-width: 768px)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");

    const sync = () => setDesktop(mq.matches);

    mq.addEventListener("change", sync);

    return () => mq.removeEventListener("change", sync);
  }, []);

  return desktop;
}

export function IntrospectionShell({
  guidedState,
  messages,
  chatId,
  aiActionPayload,
  composer,
  playEntryMorph = false,
}: IntrospectionShellProps) {
  const prefersReducedMotion = useReducedMotion();
  const isDesktop = useDesktopLayout();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const centerComposerGhostRef = useRef<HTMLDivElement | null>(null);
  const sidebarComposerGhostRef = useRef<HTMLDivElement | null>(null);
  const centerVecRef = useRef<Vector4 | null>(null);
  const sidebarVecRef = useRef<Vector4 | null>(null);
  const morphPlayedRef = useRef(false);

  const shouldMorphComposer =
    playEntryMorph && isDesktop && prefersReducedMotion !== true;

  const [composerMorphDone, setComposerMorphDone] = useState(!shouldMorphComposer);

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: regular_spring_config,
  });

  const measureComposerTargets = useCallback(() => {
    const stage = stageRef.current;
    const centerGhost = centerComposerGhostRef.current;
    const sidebarGhost = sidebarComposerGhostRef.current;

    if (!stage || !centerGhost || !sidebarGhost) return;

    centerVecRef.current = snapshot(centerGhost, stage);
    sidebarVecRef.current = snapshot(sidebarGhost, stage);
  }, []);

  useLayoutEffect(() => {
    measureComposerTargets();
  }, [measureComposerTargets, isDesktop]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(measureComposerTargets);
    });

    ro.observe(stage);

    return () => ro.disconnect();
  }, [measureComposerTargets]);

  useEffect(() => {
    if (!shouldMorphComposer) {
      setComposerMorphDone(true);

      return;
    }

    if (morphPlayedRef.current) return;

    const center = centerVecRef.current;
    const sidebar = sidebarVecRef.current;

    if (!center || !sidebar) return;

    morphPlayedRef.current = true;
    setComposerMorphDone(false);
    reset(center);
    morphTo(sidebar);

    const timer = window.setTimeout(() => setComposerMorphDone(true), 900);

    return () => window.clearTimeout(timer);
  }, [shouldMorphComposer, morphTo, reset, isDesktop]);

  const showMorphLayer = shouldMorphComposer && !composerMorphDone;

  return (
    <div ref={stageRef} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
        <AdaptiveLiquidChrome cover="parent" />
      </div>

      {/* Ghost: default centered chat composer position */}
      <div
        ref={centerComposerGhostRef}
        aria-hidden
        className="pointer-events-none absolute bottom-6 left-1/2 z-0 w-[min(100%,42rem)] -translate-x-1/2 px-4 opacity-0"
      >
        <div className="h-14 w-full rounded-xl border border-transparent" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* Main content — full width on desktop */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <IntrospectionNav breadcrumb={guidedState.breadcrumb} title={guidedState.title} />
          <div className="min-h-0 flex-1 overflow-hidden px-4 py-4 md:px-8 md:py-6">
            <IntrospectionOverview markdown={guidedState.overviewMarkdown} />
          </div>
        </div>

        {/* Chat sidebar — Strata-style */}
        <aside
          className={cn(
            glass({ opaque: true }),
            "relative flex min-h-0 w-full shrink-0 flex-col border-border/60 md:w-[min(26rem,100%)] md:border-l",
            showMorphLayer && "max-md:border-t md:border-l"
          )}
        >
          <IntrospectionStreamPanel
            aiActionPayload={aiActionPayload}
            chatId={chatId}
            messages={messages}
            sidebar
          />

          <div
            ref={sidebarComposerGhostRef}
            className={cn(
              "shrink-0 border-t border-border/40 p-3 md:p-4",
              showMorphLayer && "invisible"
            )}
          >
            {composerMorphDone ? composer : <div className="h-14" aria-hidden />}
          </div>
        </aside>
      </div>

      {showMorphLayer ? (
        <div
          ref={elementRef}
          className={cn(
            "pointer-events-auto absolute top-0 left-0 z-30 overflow-hidden rounded-xl",
            "border-0 bg-transparent shadow-none will-change-[transform,width,height]"
          )}
        >
          <div className="min-h-full w-full p-1">{composer}</div>
        </div>
      ) : null}
    </div>
  );
}
