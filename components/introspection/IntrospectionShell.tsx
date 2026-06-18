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
  canGoBack: boolean;
  canGoNext: boolean;
  onBack: () => void;
  onNext: () => void;
  messages: UIMessage[];
  chatId: string;
  aiActionPayload?: {
    action: ChatAIActionEnum;
    message?: string;
  };
  composer: ReactNode;
  playEntryMorph?: boolean;
};

export function IntrospectionShell({
  guidedState,
  canGoBack,
  canGoNext,
  onBack,
  onNext,
  messages,
  chatId,
  aiActionPayload,
  composer,
  playEntryMorph = false,
}: IntrospectionShellProps) {
  const prefersReducedMotion = useReducedMotion();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const entryGhostRef = useRef<HTMLDivElement | null>(null);
  const overviewMeasureRef = useRef<HTMLDivElement | null>(null);
  const entryVecRef = useRef<Vector4 | null>(null);
  const overviewVecRef = useRef<Vector4 | null>(null);
  const morphPlayedRef = useRef(false);
  const [morphDone, setMorphDone] = useState(!playEntryMorph || prefersReducedMotion === true);

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: regular_spring_config,
  });

  const measureTargets = useCallback(() => {
    const stage = stageRef.current;
    const entryGhost = entryGhostRef.current;
    const overviewGhost = overviewMeasureRef.current;

    if (!stage || !entryGhost || !overviewGhost) return;

    const entryVec = snapshot(entryGhost, stage);
    const overviewVec = snapshot(overviewGhost, stage);

    entryVecRef.current = entryVec;
    overviewVecRef.current = overviewVec;
  }, []);

  useLayoutEffect(() => {
    measureTargets();
  }, [measureTargets]);

  useEffect(() => {
    if (!playEntryMorph || prefersReducedMotion || morphPlayedRef.current) return;

    const entry = entryVecRef.current;
    const overview = overviewVecRef.current;

    if (!entry || !overview) return;

    morphPlayedRef.current = true;
    reset(entry);
    morphTo(overview);

    const timer = window.setTimeout(() => setMorphDone(true), 900);

    return () => window.clearTimeout(timer);
  }, [playEntryMorph, prefersReducedMotion, morphTo, reset]);

  return (
    <div ref={stageRef} className="relative flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-80">
        <AdaptiveLiquidChrome cover="parent" />
      </div>

      {/* Ghost measurers */}
      <div
        ref={entryGhostRef}
        aria-hidden
        className="pointer-events-none absolute inset-4 opacity-0"
      />

      {!morphDone && playEntryMorph && !prefersReducedMotion ? (
        <div
          ref={elementRef}
          className={cn(glass(), "pointer-events-none absolute z-20 rounded-xl border border-border/50")}
        />
      ) : null}

      <IntrospectionNav
        breadcrumb={guidedState.breadcrumb}
        canGoBack={canGoBack}
        canGoNext={canGoNext}
        onBack={onBack}
        onNext={onNext}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4 md:px-8 md:py-6">
        <IntrospectionOverview ref={overviewMeasureRef} markdown={guidedState.overviewMarkdown} />
        <IntrospectionStreamPanel
          aiActionPayload={aiActionPayload}
          chatId={chatId}
          messages={messages}
        />
      </div>

      <div className="shrink-0 border-t border-border/40 px-4 py-3 md:px-8 md:pb-5">{composer}</div>
    </div>
  );
}
