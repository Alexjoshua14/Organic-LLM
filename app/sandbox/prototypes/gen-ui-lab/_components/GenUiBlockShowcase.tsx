"use client";

import type { GenUIBlock } from "@/lib/schemas/gen-ui";
import type { GenUiShowcaseType } from "@/lib/sandbox/gen-ui-lab-showcases";

import { useMemo } from "react";

import {
  GEN_UI_ARRANGEMENT_INTERVAL_MS,
  useGenUiArrangementCycle,
} from "../_hooks/use-gen-ui-arrangement-cycle";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";

import { GenUIRenderer } from "@/components/chat/gen-ui/GenUIRenderer";
import { showcasePresetsFor } from "@/lib/sandbox/gen-ui-lab-showcases";

/** Same reading window as decision / code arrangement demos. */
export const BLOCK_SHOWCASE_INTERVAL_MS = GEN_UI_ARRANGEMENT_INTERVAL_MS;

export function useGenUiBlockShowcase(
  type: GenUiShowcaseType,
  liveBlock: GenUIBlock,
  active = true
) {
  const presets = useMemo(() => showcasePresetsFor(type, liveBlock), [type, liveBlock]);
  const cycle = useGenUiArrangementCycle(presets, active);

  return { cycle, block: cycle.arrangement.block, count: cycle.count };
}

type BlockShowcaseState = ReturnType<typeof useGenUiBlockShowcase>;

/** Section header — hidden when there is only one state to show. */
export function GenUiBlockShowcaseToolbar({ showcase }: { showcase: BlockShowcaseState }) {
  if (showcase.count <= 1) return null;

  return (
    <GenUiArrangementToolbar
      cycle={showcase.cycle}
      groupLabel="Component states"
      noun="state"
    />
  );
}

export function GenUiBlockShowcasePreview({
  showcase,
  messageId,
}: {
  showcase: BlockShowcaseState;
  messageId: string;
}) {
  return (
    <GenUiArrangementPauseZone cycle={showcase.cycle}>
      <GenUIRenderer data={{ block: showcase.block }} messageId={messageId} />
    </GenUiArrangementPauseZone>
  );
}
