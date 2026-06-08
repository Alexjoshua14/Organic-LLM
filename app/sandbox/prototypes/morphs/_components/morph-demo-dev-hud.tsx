"use client";

import type { SpringConfig, Vector4 } from "@organic-llm/morph-physics";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useId, useState } from "react";

import { MORPH_DEMO_SPEEDS, type MorphDemoSpeedPercent } from "../_lib/morph-demo-spring-presets";

import { glass } from "@/components/design-system/primitives";
import { Button } from "@/components/third-party/ui/button";
import { cn } from "@/lib/utils";

const HUD_STORAGE_KEY = "morph-demo-hud-open";

function fmt(n: number, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function vecLine(label: string, v: Vector4 | null) {
  if (!v) {
    return `${label}: —`;
  }

  return `${label}: x ${fmt(v.x)} · y ${fmt(v.y)} · w ${fmt(v.w)} · h ${fmt(v.h)}`;
}

export type MorphLiveMetrics = {
  x: number;
  y: number;
  w: number;
  h: number;
  l1Err: number | null;
  l1Vel: number | null;
  settled: boolean | null;
};

export type MorphDevHudTargetPair = {
  alpha: Vector4 | null;
  beta: Vector4 | null;
};

type MorphDemoDevHudProps = {
  /** Current mode label shown in HUD (e.g. home, chat, rabbit). */
  layout: string;
  speedPercent: MorphDemoSpeedPercent;
  onSpeedChange: (p: MorphDemoSpeedPercent) => void;
  spring: SpringConfig;
  targets: MorphDevHudTargetPair;
  targetLabelAlpha: string;
  targetLabelBeta: string;
  live: MorphLiveMetrics | null;
  /** Notified when the panel opens or collapses (for layout padding, React Scan safe area, etc.). */
  onPanelOpenChange?: (open: boolean) => void;
};

export function MorphDemoDevHud({
  layout,
  speedPercent,
  onSpeedChange,
  spring,
  targets,
  targetLabelAlpha,
  targetLabelBeta,
  live,
  onPanelOpenChange,
}: MorphDemoDevHudProps) {
  const panelId = useId();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      const v = sessionStorage.getItem(HUD_STORAGE_KEY);

      if (v === "0") {
        setOpen(false);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    onPanelOpenChange?.(open);
  }, [open, onPanelOpenChange]);

  const setOpenPersist = useCallback((next: boolean) => {
    setOpen(next);

    try {
      sessionStorage.setItem(HUD_STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }, []);

  if (!open) {
    return (
      <button
        aria-controls={panelId}
        aria-expanded={false}
        aria-label="Open morph debug metrics"
        className={cn(
          glass({ opaque: true }),
          "pointer-events-auto fixed top-24 right-0 z-[60] flex w-9 flex-col items-center gap-1.5 rounded-l-lg border border-border/60 border-r-0 py-3 pl-1 pr-0.5 shadow-lg backdrop-blur-xl",
          "text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground"
        )}
        type="button"
        onClick={() => {
          setOpenPersist(true);
        }}
      >
        <ChevronLeft aria-hidden className="size-4 shrink-0" />
        <span className="font-medium text-[10px] text-foreground/80 uppercase tracking-widest [writing-mode:vertical-rl]">
          Debug
        </span>
      </button>
    );
  }

  return (
    <aside
      id={panelId}
      aria-label="Morph demo developer HUD"
      className={cn(
        glass({ opaque: true }),
        "pointer-events-auto fixed top-20 right-0 z-[60] max-w-[min(100vw-1rem,18rem)] rounded-l-xl rounded-r-none border border-border/60 border-r-0 p-2 shadow-lg backdrop-blur-xl sm:top-24"
      )}
    >
      <div className="flex items-start justify-between gap-2 border-border/40 border-b pb-2">
        <div className="min-w-0">
          <p className="font-medium text-foreground/90 text-sm">Morph debug</p>
          <p className="mt-0.5 text-muted-foreground text-xs leading-snug">
            Speed retunes springs. Metrics vs stage. React Scan shows FPS in dev.
          </p>
        </div>
        <Button
          aria-controls={panelId}
          aria-expanded
          className="size-8 shrink-0 p-0"
          size="icon"
          title="Collapse debug panel"
          type="button"
          variant="ghost"
          onClick={() => {
            setOpenPersist(false);
          }}
        >
          <ChevronRight aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="mt-2 space-y-1.5">
        <p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
          Playback
        </p>
        <div className="flex flex-wrap gap-1">
          {MORPH_DEMO_SPEEDS.map((p) => (
            <Button
              key={p}
              className="h-6 min-w-9 px-1.5 font-mono text-xs"
              size="sm"
              type="button"
              variant={speedPercent === p ? "default" : "outline"}
              onClick={() => {
                onSpeedChange(p);
              }}
            >
              {p}%
            </Button>
          ))}
        </div>
      </div>

      <div className="mt-2 space-y-0.5 border-border/50 border-t pt-2 font-mono text-xs leading-relaxed text-foreground/90">
        <p>
          <span className="text-muted-foreground">Layout</span> ·{" "}
          <span className="text-foreground">{layout}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Spring</span> · k {fmt(spring.stiffness, 2)} · c{" "}
          {fmt(spring.damping, 2)} · m {fmt(spring.mass, 2)} · ε {spring.precision}
        </p>
        <p className="break-all">{vecLine(`Target ${targetLabelAlpha}`, targets.alpha)}</p>
        <p className="break-all">{vecLine(`Target ${targetLabelBeta}`, targets.beta)}</p>
        <p className="break-all">
          {live ? vecLine("Live", { x: live.x, y: live.y, w: live.w, h: live.h }) : "Live: —"}
        </p>
        <p>
          <span className="text-muted-foreground">L1 err→target</span> ·{" "}
          {live?.l1Err != null ? fmt(live.l1Err, 2) : "—"} px
        </p>
        <p>
          <span className="text-muted-foreground">‖Δrect/Δt‖₁</span> ·{" "}
          {live?.l1Vel != null ? `${fmt(live.l1Vel, 1)} px/s` : "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Settled</span> ·{" "}
          {live?.settled == null ? "—" : live.settled ? "yes" : "no"}
        </p>
      </div>
    </aside>
  );
}
