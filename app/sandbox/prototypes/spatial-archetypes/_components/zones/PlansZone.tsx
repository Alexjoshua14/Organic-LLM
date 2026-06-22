"use client";

import { useEffect, useLayoutEffect } from "react";

import { ArtifactSlot, measureAllSlots } from "../spatial/ArtifactSlot";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import type { PlanTimelineBlock } from "@/lib/schemas/gen-ui";
import { glass } from "@/components/design-system/primitives";
import { useArtifactSpatial } from "@/lib/context/artifact-spatial-context";
import type { SpatialArtifact } from "@/lib/schemas/spatial-artifact";
import { slotKey } from "@/lib/spatial-artifacts/zone-routing";
import { cn } from "@/lib/utils";

type PlansZoneProps = {
  artifacts: SpatialArtifact[];
  expandedId: string | null;
  onExpand: (id: string | null) => void;
};

export function PlansZone({ artifacts, expandedId, onExpand }: PlansZoneProps) {
  const { store, stageRef } = useArtifactSpatial();

  useLayoutEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    measureAllSlots(store, stage);

    for (const artifact of artifacts) {
      const key =
        expandedId === artifact.id
          ? slotKey("plan-expanded", artifact.id)
          : slotKey("plan-condensed", artifact.id);

      store.requestMorph(artifact.id, key);
    }
  }, [artifacts, expandedId, store, stageRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onExpand(null);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [onExpand]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Plans</h2>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {artifacts.map((artifact) => {
          if (artifact.block.type !== "plan-timeline") return null;

          return (
            <ArtifactSlot
              key={artifact.id}
              artifactId={artifact.id}
              className={cn(
                glass(),
                "w-64 shrink-0 cursor-pointer rounded-xl border border-border/50 p-3 transition hover:border-primary/40"
              )}
              role="plan-condensed"
              onClick={() =>
                onExpand(expandedId === artifact.id ? null : artifact.id)
              }
            >
              <div className="invisible" aria-hidden>
                <PlanTimeline block={artifact.block} variant="condensed" />
              </div>
              <p className="sr-only">{artifact.block.title}</p>
            </ArtifactSlot>
          );
        })}
      </div>

      {expandedId ? (
        <>
          <button
            type="button"
            aria-label="Close expanded plan"
            className="fixed inset-0 z-[15] bg-background/60 backdrop-blur-sm"
            onClick={() => onExpand(null)}
          />
          <ArtifactSlot
            artifactId={expandedId}
            className="fixed inset-4 z-[16] mx-auto max-h-[85vh] max-w-3xl overflow-auto rounded-2xl border border-border/60 p-6 shadow-2xl"
            ghost
            role="plan-expanded"
          >
            {artifacts.find((a) => a.id === expandedId)?.block.type === "plan-timeline" ? (
              <PlanTimeline
                block={artifacts.find((a) => a.id === expandedId)!.block as PlanTimelineBlock}
                morphIds
                variant="full"
              />
            ) : null}
          </ArtifactSlot>
        </>
      ) : null}
    </section>
  );
}
