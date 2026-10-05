"use client";

import type { MemorySector, MemoryTouchKind } from "@/lib/memory/mindmap";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";

import { IDLE_NODE_GLOW, IN_CONTEXT_GLOW, MEMORY_TOUCH_GLOW } from "./memory-mindmap-glow";
import {
  layoutMemorySectors,
  MINDMAP_CENTER,
  MINDMAP_VIEWBOX,
  tendrilPath,
} from "./memory-mindmap-layout";

import { cn } from "@/lib/utils";

export type MemoryMindmapProps = {
  sectors: MemorySector[];
  centerLabel: string;
  canGoUp?: boolean;
  onCenterClick?: () => void;
  inContextIds?: ReadonlySet<string>;
  touches?: Partial<Record<string, MemoryTouchKind>>;
  counts?: Record<string, number>;
  selectedId?: string | null;
  onSelectSector?: (sectorId: string) => void;
  className?: string;
};

function paintFor(sectorId: string, inContext: boolean, touch?: MemoryTouchKind) {
  if (touch) return MEMORY_TOUCH_GLOW[touch];
  if (inContext) return IN_CONTEXT_GLOW;

  return IDLE_NODE_GLOW;
}

export function MemoryMindmap({
  sectors,
  centerLabel,
  canGoUp = false,
  onCenterClick,
  inContextIds,
  touches,
  counts,
  selectedId,
  onSelectSector,
  className,
}: MemoryMindmapProps) {
  const reduceMotion = useReducedMotion();
  const laidOut = useMemo(() => layoutMemorySectors(sectors, counts), [sectors, counts]);

  if (laidOut.length === 0) {
    return (
      <div
        className={cn(
          "flex aspect-square w-full items-center justify-center text-sm text-muted-foreground",
          className
        )}
      >
        No memory sectors yet.
      </div>
    );
  }

  return (
    <div className={cn("relative aspect-square w-full", className)}>
      <svg aria-hidden className="absolute inset-0 h-full w-full" viewBox={MINDMAP_VIEWBOX}>
        <defs>
          <radialGradient id="mm-nucleus" cx="50%" cy="42%" r="65%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.04)" />
          </radialGradient>
        </defs>

        {laidOut.map((sector) => {
          const touch = touches?.[sector.id];
          const inContext = inContextIds?.has(sector.id) ?? false;
          const paint = paintFor(sector.id, inContext, touch);

          return (
            <path
              key={`link-${sector.id}`}
              d={tendrilPath(sector.x, sector.y, touch ?? (inContext ? "in-context" : undefined))}
              fill="none"
              stroke={paint.stroke}
              strokeOpacity={touch || inContext ? 0.55 : 0.18}
              strokeWidth={touch ? 1.6 : 1.05}
            />
          );
        })}

        <circle
          cx={MINDMAP_CENTER}
          cy={MINDMAP_CENTER}
          fill="url(#mm-nucleus)"
          r="18"
          stroke={canGoUp ? "rgba(103, 232, 249, 0.35)" : "rgba(255,255,255,0.28)"}
          strokeWidth="0.8"
        />

        {laidOut.map((sector) => {
          const touch = touches?.[sector.id];
          const inContext = inContextIds?.has(sector.id) ?? false;
          const paint = paintFor(sector.id, inContext, touch);
          const ghost = (counts?.[sector.id] ?? sector.count) <= 0;

          return (
            <g key={`node-${sector.id}`}>
              <motion.circle
                animate={
                  reduceMotion || !touch
                    ? { opacity: ghost ? 0.28 : 1, r: sector.r }
                    : { opacity: [0.35, 1, 0.85], r: [sector.r * 0.92, sector.r * 1.22, sector.r] }
                }
                cx={sector.x}
                cy={sector.y}
                fill={paint.fill}
                initial={false}
                stroke={paint.stroke}
                strokeWidth={selectedId === sector.id ? 2.2 : 1.3}
                style={{ filter: `drop-shadow(0 0 7px ${paint.glow})` }}
                transition={{ duration: reduceMotion ? 0 : 1.05, ease: "easeOut" }}
              />
            </g>
          );
        })}
      </svg>

      <button
        aria-disabled={!canGoUp}
        aria-label={canGoUp ? `Up from ${centerLabel}` : centerLabel}
        className={cn(
          "absolute left-1/2 top-1/2 z-30 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-center text-[10px] font-medium uppercase tracking-[0.18em] text-foreground/80",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
          canGoUp ? "cursor-pointer hover:text-cyan-200" : "cursor-default"
        )}
        disabled={!canGoUp}
        type="button"
        onClick={() => {
          if (canGoUp) onCenterClick?.();
        }}
      >
        <span className="max-w-[3.6rem] truncate px-1">{centerLabel}</span>
      </button>

      {laidOut.map((sector) => {
        const touch = touches?.[sector.id];
        const left = `${(sector.x / 200) * 100}%`;
        const top = `${(sector.y / 200) * 100}%`;

        return (
          <button
            key={`label-${sector.id}`}
            aria-pressed={selectedId === sector.id}
            className={cn(
              "absolute z-20 max-w-[7.5rem] -translate-x-1/2 translate-y-3 rounded-full px-2 py-0.5 text-center text-[11px] leading-tight text-foreground/90 transition-colors",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50",
              selectedId === sector.id && "text-foreground"
            )}
            style={{ left, top }}
            type="button"
            onClick={() => onSelectSector?.(sector.id)}
          >
            <span className="block truncate font-medium">{sector.label}</span>
            <span className="block text-[10px] text-muted-foreground">
              {touch
                ? MEMORY_TOUCH_GLOW[touch].label
                : `${Math.max(0, counts?.[sector.id] ?? sector.count)} traces`}
            </span>
          </button>
        );
      })}
    </div>
  );
}
