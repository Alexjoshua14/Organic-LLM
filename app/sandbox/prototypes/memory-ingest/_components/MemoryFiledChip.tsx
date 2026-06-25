"use client";

import type { FiledMemory } from "../_lib/memory-ingest-filed";

import { useEffect, useState } from "react";

import { MemoryFiledRow } from "./MemoryFiledRow";

import { cn } from "@/lib/utils";

/** How long the receipt lingers before fading on its own. */
const FILED_CHIP_TTL_MS = 8000;

export type MemoryFiledChipProps = {
  filed: FiledMemory;
  expanded: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
  /** Removes the memory; resolves true on success. */
  onForget: (id: string) => Promise<boolean>;
};

/**
 * Transient "Filed … / Undo" receipt for a real commit_memory write. Complements Delphi's
 * conversational "Filed." with a glanceable, reversible record of what was actually stored.
 */
export function MemoryFiledChip({
  filed,
  expanded,
  onToggleExpand,
  onDismiss,
  onForget,
}: MemoryFiledChipProps) {
  const [forgetting, setForgetting] = useState(false);

  // Auto-dismiss once settled; pause the countdown while expanded or Undo is in flight.
  useEffect(() => {
    if (forgetting || expanded) return;
    const t = setTimeout(onDismiss, FILED_CHIP_TTL_MS);

    return () => clearTimeout(t);
  }, [forgetting, expanded, onDismiss]);

  const handleForget = async (id: string): Promise<boolean> => {
    setForgetting(true);
    const ok = await onForget(id);

    if (ok) {
      onDismiss();
    } else {
      setForgetting(false);
    }

    return ok;
  };

  return (
    <div className={cn("mx-auto mb-2 w-full max-w-[min(100%,360px)]")} role="status">
      <MemoryFiledRow
        expanded={expanded}
        filed={filed}
        variant="chip"
        onForget={handleForget}
        onToggleExpand={onToggleExpand}
      />
    </div>
  );
}
