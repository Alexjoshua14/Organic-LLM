"use client";

import { BrainCircuit } from "lucide-react";

import { MemoryMindmap } from "./MemoryMindmap";
import { MEMORY_TOUCH_GLOW } from "./memory-mindmap-glow";

import { MEMORY_TOUCH_KINDS, type MemorySector, type MemoryTouchKind } from "@/lib/memory/mindmap";
import { glass } from "@/components/design-system/primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/third-party/ui/dialog";
import { cn } from "@/lib/utils";

export type MemoryMindmapPopupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectors: MemorySector[];
  centerLabel: string;
  canGoUp?: boolean;
  onCenterClick?: () => void;
  inContextIds?: ReadonlySet<string>;
  touches?: Partial<Record<string, MemoryTouchKind>>;
  counts?: Record<string, number>;
  selectedId?: string | null;
  onSelectSector?: (sectorId: string) => void;
  liveMessage?: string;
};

export function MemoryMindmapTrigger({
  pressed,
  onClick,
  className,
}: {
  pressed?: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      aria-expanded={pressed}
      aria-haspopup="dialog"
      className={cn(
        glass({ chip: true }),
        "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground",
        pressed && "text-cyan-300",
        className
      )}
      type="button"
      onClick={onClick}
    >
      <BrainCircuit className="size-3.5" />
      Memory map
    </button>
  );
}

export function MemoryMindmapPopup({
  open,
  onOpenChange,
  sectors,
  centerLabel,
  canGoUp,
  onCenterClick,
  inContextIds,
  touches,
  counts,
  selectedId,
  onSelectSector,
  liveMessage,
}: MemoryMindmapPopupProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="bg-black/45 backdrop-blur-[8px]"
        className={cn(
          glass({ opaque: true }),
          "flex max-h-[min(92dvh,40rem)] w-[min(100vw-1.5rem,34rem)] max-w-none flex-col gap-3 overflow-hidden rounded-3xl border-white/10 bg-background/55 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.45)] sm:p-6"
        )}
        data-dim-background
      >
        <DialogHeader className="space-y-1 pr-8 text-left">
          <DialogTitle className="font-commissioner text-xl font-light tracking-tight">
            Memory in context
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed text-muted-foreground">
            Click a sector to go one layer deeper. Click the center to rise — Memory is the root.
            Glow still marks access, create, update, and delete.
          </DialogDescription>
        </DialogHeader>

        <MemoryMindmap
          canGoUp={canGoUp}
          centerLabel={centerLabel}
          counts={counts}
          inContextIds={inContextIds}
          sectors={sectors}
          selectedId={selectedId}
          touches={touches}
          onCenterClick={onCenterClick}
          onSelectSector={onSelectSector}
        />

        <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {MEMORY_TOUCH_KINDS.map((kind) => (
            <li key={kind} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-1.5 rounded-full"
                style={{
                  background: MEMORY_TOUCH_GLOW[kind].stroke,
                  boxShadow: `0 0 8px ${MEMORY_TOUCH_GLOW[kind].glow}`,
                }}
              />
              {MEMORY_TOUCH_GLOW[kind].label}
            </li>
          ))}
        </ul>

        <p aria-live="polite" className="min-h-4 text-center text-xs text-muted-foreground">
          {liveMessage ?? ""}
        </p>
      </DialogContent>
    </Dialog>
  );
}
