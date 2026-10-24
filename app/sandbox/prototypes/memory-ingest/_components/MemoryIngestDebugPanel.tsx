"use client";

import type { LensPerfMetrics } from "./lens/LensPerfHud";

import { Button } from "@heroui/button";

import { PARTICLE_FIELD_VISUAL_STATES, type ParticleFieldVisualState } from "../_lib/types";

import { cn } from "@/lib/utils";

type MemoryIngestDebugPanelProps = {
  open: boolean;
  onClose: () => void;
  onSetVisual: (v: ParticleFieldVisualState) => void;
  onPulseWriting: () => void;
  metrics: LensPerfMetrics | null;
};

/** Particle state panel; parent gates visibility (dev, env flag, or ?memoryIngestDev=1). */
export function MemoryIngestDebugPanel({
  open,
  onClose,
  onSetVisual,
  onPulseWriting,
  metrics,
}: MemoryIngestDebugPanelProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed bottom-24 right-3 z-[60] max-h-[min(70vh,520px)] w-[min(92vw,280px)] overflow-y-auto rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md sm:right-6 sm:w-80 md:right-8"
      )}
      data-testid="memory-ingest-debug-panel"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">Particle debug</span>
        <Button size="sm" variant="flat" onPress={onClose}>
          Close
        </Button>
      </div>
      <div className="mb-2 rounded-md border border-border/60 bg-muted/30 px-2 py-1.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {metrics
          ? `${metrics.fps.toFixed(0)} fps  ${metrics.meanMs.toFixed(1)} ms  p95 ${metrics.p95Ms.toFixed(
              1
            )}\ncalls ${metrics.calls}  tris ${metrics.tris}  count ${metrics.count.toLocaleString()}  dpr ${metrics.dpr.toFixed(
              2
            )}`
          : "Collecting particle metrics..."}
      </div>
      <div className="flex flex-col gap-1.5">
        {PARTICLE_FIELD_VISUAL_STATES.map((v) => (
          <Button
            key={v}
            className="justify-start text-left font-mono text-xs"
            size="sm"
            variant="bordered"
            onPress={() => onSetVisual(v)}
          >
            {v}
          </Button>
        ))}
        <Button className="mt-1" size="sm" variant="faded" onPress={onPulseWriting}>
          pulseWritingMemory()
        </Button>
      </div>
    </div>
  );
}
