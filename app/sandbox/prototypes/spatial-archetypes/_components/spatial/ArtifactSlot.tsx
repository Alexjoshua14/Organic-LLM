"use client";

import { useEffect, useRef } from "react";

import { useArtifactSpatial } from "@/lib/context/artifact-spatial-context";
import { ArtifactSpatialStore } from "@/lib/spatial-artifacts/artifact-spatial-store";
import type { ArtifactSlotRole } from "@/lib/spatial-artifacts/zone-routing";
import { slotKey } from "@/lib/spatial-artifacts/zone-routing";
import { cn } from "@/lib/utils";

type ArtifactSlotProps = {
  artifactId: string;
  role: ArtifactSlotRole;
  className?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  /** Invisible measure-only ghost (no visible placeholder). */
  ghost?: boolean;
};

export function ArtifactSlot({
  artifactId,
  role,
  className,
  children,
  onClick,
  onPointerEnter,
  onPointerLeave,
  ghost = false,
}: ArtifactSlotProps) {
  const { store } = useArtifactSpatial();
  const ref = useRef<HTMLDivElement>(null);
  const key = slotKey(role, artifactId);

  useEffect(() => {
    store.registerSlot(key, artifactId, role, ref.current);

    return () => store.unregisterSlot(key);
  }, [store, key, artifactId, role]);

  useEffect(() => {
    const el = ref.current;

    if (el) store.registerSlot(key, artifactId, role, el);
  });

  return (
    <div
      ref={ref}
      className={cn(
        ghost && "pointer-events-none absolute opacity-0",
        !ghost && "relative min-h-[4rem]",
        className
      )}
      data-artifact-slot={key}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {!ghost ? children : children}
    </div>
  );
}

export function measureAllSlots(store: ArtifactSpatialStore, stage: HTMLElement): void {
  store.commitSlotTargets((el, stageEl) => ArtifactSpatialStore.measureElement(el, stageEl));
}
