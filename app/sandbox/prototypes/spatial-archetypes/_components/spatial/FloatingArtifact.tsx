"use client";

import { regular_spring_config } from "@organic-llm/morph-physics";
import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { useEffect, useLayoutEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { PlanTimeline } from "@/components/chat/gen-ui/blocks/PlanTimeline";
import { glass } from "@/components/design-system/primitives";
import { useArtifactSpatial } from "@/lib/context/artifact-spatial-context";
import type { SpatialArtifact } from "@/lib/schemas/spatial-artifact";
import { vector4FromRect } from "@/lib/spatial-artifacts/spatial-types";
import { getGenUIBlockTitle } from "@/components/chat/gen-ui/registry";
import { genUIBlockToMarkdown } from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

type FloatingArtifactProps = {
  artifact: SpatialArtifact;
};

function ArtifactBody({
  artifact,
  expanded,
}: {
  artifact: SpatialArtifact;
  expanded: boolean;
}) {
  const { block } = artifact;

  if (block.type === "plan-timeline") {
    return (
      <PlanTimeline
        block={block}
        morphIds
        variant={expanded ? "full" : "condensed"}
      />
    );
  }

  if (block.type === "audio-snippet") {
    return (
      <div className="space-y-1 p-1">
        <p className="text-sm font-medium">{block.preview.title}</p>
        <p className="text-xs text-muted-foreground line-clamp-3">{block.preview.teaser}</p>
      </div>
    );
  }

  return (
    <div className="p-1 text-sm">
      <p className="font-medium line-clamp-2">{getGenUIBlockTitle(block)}</p>
    </div>
  );
}

export function FloatingArtifact({ artifact }: FloatingArtifactProps) {
  const reduceMotion = useReducedMotion();
  const { store } = useArtifactSpatial();
  const [tick, setTick] = useState(0);
  const { elementRef, reset, morphTo } = useMorphPhysics({ config: regular_spring_config });

  useEffect(() => {
    return store.subscribe(artifact.id, () => setTick((t) => t + 1));
  }, [store, artifact.id]);

  const entry = store.getEntry(artifact.id);
  const target = entry.targetRect;
  const last = entry.lastRect;
  const expanded = entry.activeSlotKey?.includes("expanded") ?? false;
  const open = entry.activeSlotKey?.includes("open") ?? false;

  useLayoutEffect(() => {
    if (!target || !entry.visible) return;

    const vector = vector4FromRect(target);

    if (!last || reduceMotion) {
      reset(vector);

      return;
    }

    reset(vector4FromRect(last));
    morphTo(vector);
    const id = window.setTimeout(() => store.settle(artifact.id, target), 450);

    return () => window.clearTimeout(id);
  }, [target, last, entry.visible, reduceMotion, reset, morphTo, store, artifact.id, tick]);

  if (!entry.visible || !target) return null;

  return (
    <div
      ref={elementRef}
      className={cn(
        glass({ opaque: true }),
        "absolute left-0 top-0 z-20 overflow-hidden rounded-xl border border-border/60 shadow-lg",
        expanded && "p-4"
      )}
      data-floating-artifact={artifact.id}
      style={{ pointerEvents: expanded || open ? "auto" : "none" }}
    >
      <ArtifactBody artifact={artifact} expanded={expanded || open} />
      {expanded && artifact.block.type !== "plan-timeline" ? (
        <div className="mt-3 max-h-[60vh] overflow-auto">
          <GenUIRenderer data={{ block: artifact.block }} />
        </div>
      ) : null}
    </div>
  );
}

export function getArtifactPreviewText(artifact: SpatialArtifact): string {
  if (artifact.block.type === "audio-snippet") return artifact.block.script;

  return genUIBlockToMarkdown(artifact.block);
}
