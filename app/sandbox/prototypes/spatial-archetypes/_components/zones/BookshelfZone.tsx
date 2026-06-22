"use client";

import { useLayoutEffect, useState } from "react";

import { ArtifactSlot, measureAllSlots } from "../spatial/ArtifactSlot";
import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { glass } from "@/components/design-system/primitives";
import { getGenUIBlockTitle } from "@/components/chat/gen-ui/registry";
import { useArtifactSpatial } from "@/lib/context/artifact-spatial-context";
import type { SpatialArtifact } from "@/lib/schemas/spatial-artifact";
import { slotKey } from "@/lib/spatial-artifacts/zone-routing";
import { cn } from "@/lib/utils";

const SPINE_COLORS: Record<string, string> = {
  "answer-card": "from-amber-700/80 to-amber-900/90",
  "decision-matrix": "from-slate-600/80 to-slate-800/90",
};

type BookshelfZoneProps = {
  artifacts: SpatialArtifact[];
};

function BookSpine({
  artifact,
  hovered,
}: {
  artifact: SpatialArtifact;
  hovered: boolean;
}) {
  const gradient =
    SPINE_COLORS[artifact.blockType] ?? "from-teal-700/80 to-teal-900/90";
  const title = getGenUIBlockTitle(artifact.block);

  return (
    <div
      className={cn(
        "relative h-36 w-10 shrink-0 transition-transform duration-300 [transform-style:preserve-3d]",
        hovered && "[transform:rotateY(-14deg)]"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-sm bg-gradient-to-b shadow-md",
          gradient
        )}
      >
        <span className="absolute inset-x-0 top-3 mx-auto block w-[1px] h-[calc(100%-1.5rem)] bg-white/10" />
        <span
          className="absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2 -rotate-90 text-[9px] font-medium tracking-wide text-white/90 truncate"
          title={title}
        >
          {title}
        </span>
      </div>
    </div>
  );
}

export function BookshelfZone({ artifacts }: BookshelfZoneProps) {
  const { store, stageRef } = useArtifactSpatial();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    measureAllSlots(store, stage);

    for (const artifact of artifacts) {
      const role = hoveredId === artifact.id ? "bookshelf-open" : "bookshelf-spine";

      store.requestMorph(artifact.id, slotKey(role, artifact.id));
    }
  }, [artifacts, hoveredId, openId, store, stageRef]);

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Guides
      </h2>
      <div
        className={cn(
          glass({ tone: "brown" }),
          "relative rounded-2xl border border-border/50 p-6 [perspective:1200px]"
        )}
      >
        <div className="flex min-h-[9rem] items-end gap-3 overflow-x-auto pb-2">
          {artifacts.map((artifact) => (
            <ArtifactSlot
              key={artifact.id}
              artifactId={artifact.id}
              role="bookshelf-spine"
              onClick={() => setOpenId(openId === artifact.id ? null : artifact.id)}
              onPointerEnter={() => setHoveredId(artifact.id)}
              onPointerLeave={() => setHoveredId(null)}
            >
              <BookSpine artifact={artifact} hovered={hoveredId === artifact.id} />
            </ArtifactSlot>
          ))}
        </div>
        <div className="mt-2 h-2 rounded-full bg-gradient-to-r from-border/20 via-border/60 to-border/20" />
      </div>

      {openId ? (
        <div className={cn(glass({ opaque: true }), "rounded-xl border border-border/50 p-4")}>
          <GenUIRenderer
            data={{ block: artifacts.find((a) => a.id === openId)!.block }}
          />
        </div>
      ) : null}
    </section>
  );
}
