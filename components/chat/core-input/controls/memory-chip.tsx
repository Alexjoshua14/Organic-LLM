"use client";

import { BrainCircuit } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";

export function ComposerMemoryChip() {
  const { useMemories, setUseMemories } = useCoreInputControls();

  return (
    <ComposerToolChip
      active={useMemories}
      aria-label={useMemories ? "Memory on" : "Memory off"}
      chip="memory"
      title="Let the model recall and write memories on this turn"
      onClick={() => setUseMemories(!useMemories)}
    >
      <BrainCircuit />
    </ComposerToolChip>
  );
}
