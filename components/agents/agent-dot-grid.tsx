"use client";

import type { AgentDotState } from "./agent-dot-grid-motion";

import { useEffect, useMemo, useRef } from "react";

import { AGENT_DOTS, createDotAnimation, dotOpacity, dotRestScale } from "./agent-dot-grid-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type AgentDotGridProps = {
  state?: AgentDotState;
  className?: string;
  seed?: string;
};

/** Decorative SVG layer; owns motion while leaving stacking and sizing to its container. */
export function AgentDotGrid({
  state = "idle",
  className,
  seed = "organic-agent-dots",
}: AgentDotGridProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dotsRef = useRef<Array<SVGGElement | null>>([]);
  const restScales = useMemo(() => AGENT_DOTS.map((_, index) => dotRestScale(index, seed)), [seed]);

  useEffect(() => {
    const svg = svgRef.current;
    const dots = dotsRef.current.filter((dot): dot is SVGGElement => dot !== null);

    if (!svg || !dots[0]?.animate || typeof window.matchMedia !== "function") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let animations: Animation[] = [];
    let inView = typeof IntersectionObserver === "undefined";

    const stop = () => {
      animations.forEach((animation, index) => {
        // Preserve the current size/opacity when a state interrupts a running animation.
        const style = window.getComputedStyle(dots[index]!);

        dots[index]!.style.transform = style.transform;
        dots[index]!.style.opacity = style.opacity;
        animation.onfinish = null;
        animation.cancel();
      });
      animations = [];
    };
    const syncVisibility = () => {
      animations.forEach((animation) => {
        if (animation.playState === "finished") return;
        if (document.hidden || !inView) animation.pause();
        else if (animation.playState === "paused") animation.play();
      });
    };
    const start = () => {
      stop();
      if (reducedMotion.matches) {
        dots.forEach((dot, index) => {
          dot.style.transform = `scale(${restScales[index]})`;
          dot.style.opacity = String(dotOpacity(restScales[index]!));
        });

        return;
      }
      const animateDot = (dot: SVGGElement, index: number): Animation => {
        const restScale = restScales[index]!;
        const { frames, options } = createDotAnimation(
          state,
          index,
          {
            transform: dot.style.transform || `scale(${restScale})`,
            opacity: Number(dot.style.opacity || dotOpacity(restScale)),
          },
          restScale
        );
        const animation = dot.animate(frames, options);

        if (state !== "complete") {
          animation.onfinish = () => {
            dot.style.transform = `scale(${restScale})`;
            dot.style.opacity = String(dotOpacity(restScale));
            animation.cancel();
            animations[index] = animateDot(dot, index);
            syncVisibility();
          };
        }

        return animation;
      };

      animations = dots.map(animateDot);
      syncVisibility();
    };
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            inView = entry?.isIntersecting === true;
            syncVisibility();
          });

    observer?.observe(svg);
    reducedMotion.addEventListener("change", start);
    document.addEventListener("visibilitychange", syncVisibility);
    start();

    return () => {
      observer?.disconnect();
      reducedMotion.removeEventListener("change", start);
      document.removeEventListener("visibilitychange", syncVisibility);
      stop();
    };
  }, [state, restScales]);

  return (
    <svg
      aria-hidden
      className={cn("pointer-events-none size-full text-foreground", className)}
      focusable="false"
      height="100%"
      ref={svgRef}
      viewBox="0 0 40 40"
      width="100%"
      data-dot-renderer="v0"
    >
      {AGENT_DOTS.map(({ x, y }, index) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <g
            ref={(dot) => {
              dotsRef.current[index] = dot;
            }}
            style={{
              transform: `scale(${restScales[index]})`,
              transformOrigin: "0px 0px",
              opacity: dotOpacity(restScales[index]!),
            }}
          >
            <circle fill="currentColor" r="2" />
            {/* SVG circles cannot paint the HTML glass primitive's background/backdrop. */}
            <foreignObject height="4" width="4" x="-2" y="-2">
              <div className={cn(glass(), "size-full rounded-full")} />
            </foreignObject>
          </g>
        </g>
      ))}
    </svg>
  );
}

export type { AgentDotState };
