"use client";

import { GlobeIcon } from "lucide-react";

import { useCoreInputControls } from "../core-input-context";

import { ComposerToolChip } from "@/components/chat/composer-tool-chip";
import { cn } from "@/lib/utils";

export function ComposerSearchChip() {
  const { showLabels, useCondensedLayout, useWebSearch, setUseWebSearch } = useCoreInputControls();

  return (
    <ComposerToolChip
      active={useWebSearch}
      tool="search"
      onClick={() => setUseWebSearch(!useWebSearch)}
    >
      <GlobeIcon size={16} />
      <span className={cn(showLabels && !useCondensedLayout ? "inline-flex" : "hidden")}>
        Search
      </span>
    </ComposerToolChip>
  );
}
