"use client";

import { GlobeIcon } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";

export function ComposerSearchChip() {
  const { useWebSearch, setUseWebSearch } = useCoreInputControls();

  return (
    <ComposerToolChip
      active={useWebSearch}
      aria-label={useWebSearch ? "Web search on" : "Web search off"}
      chip="search"
      title="Let the model search the web on this turn"
      onClick={() => setUseWebSearch(!useWebSearch)}
    >
      <GlobeIcon size={16} />
    </ComposerToolChip>
  );
}
