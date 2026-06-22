"use client";

import { useLayoutEffect } from "react";

import { ArtifactSlot, measureAllSlots } from "../spatial/ArtifactSlot";
import { getArtifactPreviewText } from "../spatial/FloatingArtifact";
import { glass } from "@/components/design-system/primitives";
import { useHoverTtsPreview } from "@/hooks/use-hover-tts-preview";
import { useArtifactSpatial } from "@/lib/context/artifact-spatial-context";
import type { SpatialArtifact } from "@/lib/schemas/spatial-artifact";
import { slotKey } from "@/lib/spatial-artifacts/zone-routing";
import { cn } from "@/lib/utils";

type AudioRackTileProps = {
  artifact: SpatialArtifact;
};

function AudioRackTile({ artifact }: AudioRackTileProps) {
  const preview = useHoverTtsPreview(artifact.id);
  const text = getArtifactPreviewText(artifact);
  const title =
    artifact.block.type === "audio-snippet" ? artifact.block.preview.title : artifact.threadTitle;

  return (
    <ArtifactSlot
      artifactId={artifact.id}
      className={cn(
        glass(),
        "w-48 shrink-0 rounded-xl border border-border/50 p-3 transition hover:border-violet-400/50"
      )}
      role="audio-tile"
      onClick={() => preview.onTap(text)}
      onPointerEnter={() => preview.onPointerEnter(text)}
      onPointerLeave={preview.onPointerLeave}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-500/20 text-violet-600 dark:text-violet-300">
          ♪
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="text-[10px] text-muted-foreground">Hover to preview</p>
        </div>
      </div>
    </ArtifactSlot>
  );
}

type AudioRackZoneProps = {
  artifacts: SpatialArtifact[];
};

export function AudioRackZone({ artifacts }: AudioRackZoneProps) {
  const { store, stageRef } = useArtifactSpatial();

  useLayoutEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    measureAllSlots(store, stage);

    for (const artifact of artifacts) {
      store.requestMorph(artifact.id, slotKey("audio-tile", artifact.id));
    }
  }, [artifacts, store, stageRef]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Audio</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {artifacts.map((artifact) => (
          <AudioRackTile key={artifact.id} artifact={artifact} />
        ))}
      </div>
    </section>
  );
}
