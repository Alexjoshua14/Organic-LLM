"use client";

// @refresh reset
// Stateful spring instances must remount when their effect setup changes during dev refresh.

import type { AgentDotState } from "./agent-dot-grid-motion";
import type { DotPhysicsScheduler } from "./dot-physics-scheduler";

import { useEffect, useRef, useState } from "react";

import { AGENT_DOTS, dotOpacity, dotRestScale } from "./agent-dot-grid-motion";
import { DotMorphPhysics } from "./dot-morph-physics";
import { dotPhysicsScheduler } from "./dot-physics-scheduler";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

function PhysicsDot({
  state,
  seed,
  index,
  active,
  scheduler,
  performanceId,
}: {
  state: AgentDotState;
  seed: string;
  index: number;
  active: boolean;
  scheduler: DotPhysicsScheduler;
  performanceId?: string;
}) {
  const ref = useRef<SVGGElement>(null);
  const physics = useRef<DotMorphPhysics | null>(null);
  const restScale = dotRestScale(index, seed);

  useEffect(() => {
    const element = ref.current;

    if (!element) return;
    const instance = physics.current ?? new DotMorphPhysics(restScale, index);

    physics.current = instance;
    instance.setState(state);
    if (!active || instance.complete) return;
    let remove = () => {};

    remove = scheduler.register((dt) => {
      const { x, y, scale } = instance.step(dt);

      element.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      element.style.opacity = String(dotOpacity(scale));
      if (instance.complete) remove();
    }, performanceId);

    return remove;
  }, [active, state, restScale, index, scheduler, performanceId]);

  const dot = AGENT_DOTS[index]!;

  return (
    <g transform={`translate(${dot.x} ${dot.y})`}>
      <g
        ref={ref}
        style={{
          transform: `scale(${restScale})`,
          transformOrigin: "0px 0px",
          opacity: dotOpacity(restScale),
        }}
      >
        <circle fill="currentColor" r="2" />
        <foreignObject height="4" width="4" x="-2" y="-2">
          <div className={cn(glass(), "size-full rounded-full")} />
        </foreignObject>
      </g>
    </g>
  );
}

export function PhysicsAgentDotGrid({
  state = "idle",
  seed = "organic-agent-dots",
  onFailure,
  scheduler = dotPhysicsScheduler,
  performanceId,
}: {
  state?: AgentDotState;
  seed?: string;
  onFailure: () => void;
  scheduler?: DotPhysicsScheduler;
  performanceId?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const remove = scheduler.subscribeFailure(onFailure);
    let observer: IntersectionObserver | null = null;

    try {
      observer = new IntersectionObserver(([entry]) => setActive(entry?.isIntersecting === true));
      if (ref.current) observer.observe(ref.current);
    } catch {
      onFailure();
    }

    return () => {
      remove();
      observer?.disconnect();
    };
  }, [onFailure, scheduler]);

  return (
    <svg
      aria-hidden
      className="pointer-events-none size-full text-foreground"
      focusable="false"
      height="100%"
      ref={ref}
      viewBox="0 0 40 40"
      width="100%"
      data-dot-renderer="physics"
    >
      {AGENT_DOTS.map((_, index) => (
        <PhysicsDot
          key={`${seed}:${index}`}
          active={active}
          index={index}
          scheduler={scheduler}
          performanceId={performanceId}
          seed={seed}
          state={state}
        />
      ))}
    </svg>
  );
}
