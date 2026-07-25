"use client";

import { BrainCircuit } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { cn } from "@/lib/utils";

export function ComposerMemoryChip() {
  const { showLabels, useCondensedLayout, useMemories, setUseMemories } = useCoreInputControls();

  return (
    <ComposerToolChip
      active={useMemories}
      tool="memory"
      onClick={() => setUseMemories(!useMemories)}
    >
      <BrainCircuit />
      <span className={cn(showLabels && !useCondensedLayout ? "inline-flex" : "hidden")}>
        Memory
      </span>
    </ComposerToolChip>
  );
}
