"use client";

import { useEffect, useLayoutEffect } from "react";

import { FloatingArtifact } from "./FloatingArtifact";
import { measureAllSlots } from "./ArtifactSlot";

import { useArtifactSpatial } from "@/lib/context/artifact-spatial-context";
import type { SpatialArtifact } from "@/lib/schemas/spatial-artifact";

type ArtifactSpatialStageProps = {
  artifacts: SpatialArtifact[];
};

export function ArtifactSpatialStage({ artifacts }: ArtifactSpatialStageProps) {
  const { store, stageRef } = useArtifactSpatial();

  useEffect(() => {
    store.setStage(stageRef.current);

    return () => store.setStage(null);
  }, [store, stageRef]);

  useLayoutEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    measureAllSlots(store, stage);
  });

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const ro = new ResizeObserver(() => {
      measureAllSlots(store, stage);
    });

    ro.observe(stage);

    return () => ro.disconnect();
  }, [store, stageRef]);

  return (
    <div ref={stageRef} className="pointer-events-none absolute inset-0 z-10">
      {artifacts.map((artifact) => (
        <FloatingArtifact key={artifact.id} artifact={artifact} />
      ))}
    </div>
  );
}
