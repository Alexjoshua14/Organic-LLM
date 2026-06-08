"use client";

import type { SharedSelection } from "@heroui/system";

import { useCallback, useRef, useState } from "react";
import { GripVertical } from "lucide-react";
import { Button } from "@heroui/button";
import { Select, SelectItem } from "@heroui/select";

import { PARTICLE_FIELD_VISUAL_STATES, type ParticleFieldVisualState } from "../_lib/types";

import { cn } from "@/lib/utils";

type MemoryIngestParticleModeDevOverlayProps = {
  visual: ParticleFieldVisualState;
  onSetVisual: (v: ParticleFieldVisualState) => void;
  onPulseWriting: () => void;
};

/** Fixed overlay (right, vertically centered) to pick particle FSM visual; drag via the grip row. */
export function MemoryIngestParticleModeDevOverlay({
  visual,
  onSetVisual,
  onPulseWriting,
}: MemoryIngestParticleModeDevOverlayProps) {
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dragOffsetRef = useRef(dragOffset);
  dragOffsetRef.current = dragOffset;

  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const onDragHandlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      originX: dragOffsetRef.current.x,
      originY: dragOffsetRef.current.y,
    };
  }, []);

  const onDragHandlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    setDragOffset({
      x: d.originX + (e.clientX - d.startClientX),
      y: d.originY + (e.clientY - d.startClientY),
    });
  }, []);

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    dragRef.current = null;
  }, []);

  const onSelectionChange = (keys: SharedSelection) => {
    const key = typeof keys === "string" ? keys : Array.from(keys)[0];

    if (typeof key !== "string") return;
    const next = PARTICLE_FIELD_VISUAL_STATES.find((v) => v === key);

    if (next) onSetVisual(next);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto fixed right-3 top-1/2 z-[58] w-[min(92vw,18rem)] rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur-md sm:right-4"
      )}
      style={{
        transform: `translateX(${dragOffset.x}px) translateY(calc(-50% + ${dragOffset.y}px))`,
      }}
      data-testid="memory-ingest-particle-mode-overlay"
    >
      <div
        className={cn(
          "mb-2 flex cursor-grab touch-none select-none items-center gap-1.5 rounded-md py-0.5 text-muted-foreground active:cursor-grabbing",
          "[-webkit-user-drag:none]"
        )}
        aria-label="Drag particle dev panel"
        onPointerDown={onDragHandlePointerDown}
        onPointerMove={onDragHandlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onLostPointerCapture={() => {
          dragRef.current = null;
        }}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
        <p className="text-[11px] font-medium uppercase tracking-wide">Dev · particle mode</p>
      </div>
      <Select
        disallowEmptySelection
        aria-label="Particle visual mode"
        classNames={{
          trigger: "min-h-9 h-9",
          value: "font-mono text-xs",
        }}
        selectedKeys={[visual]}
        size="sm"
        variant="bordered"
        onSelectionChange={onSelectionChange}
      >
        {PARTICLE_FIELD_VISUAL_STATES.map((v) => (
          <SelectItem key={v} className="font-mono text-xs" textValue={v}>
            {v}
          </SelectItem>
        ))}
      </Select>
      <Button className="mt-2 w-full" size="sm" variant="flat" onPress={onPulseWriting}>
        Pulse writing receipt
      </Button>
    </div>
  );
}
