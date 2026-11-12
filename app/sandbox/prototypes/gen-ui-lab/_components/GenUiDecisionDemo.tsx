"use client";

import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";

import {
  GEN_UI_ARRANGEMENT_INTERVAL_MS,
  useGenUiArrangementCycle,
} from "../_hooks/use-gen-ui-arrangement-cycle";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";

import {
  DecisionMatrix,
  type DecisionArrangement,
} from "@/components/chat/gen-ui/blocks/DecisionMatrix";

/** Give each arrangement enough reading time; interaction restarts a full reading window. */
export const DECISION_DEMO_INTERVAL_MS = GEN_UI_ARRANGEMENT_INTERVAL_MS;

const ARRANGEMENTS: ReadonlyArray<{ id: DecisionArrangement; name: string; intent: string }> = [
  {
    id: "overview",
    name: "Whole picture",
    intent: "See the tradeoff shape and inspect one criterion across every option.",
  },
  {
    id: "recommendation",
    name: "Recommendation first",
    intent: "Lead with the recommendation, then inspect the evidence behind the choice.",
  },
  {
    id: "evidence",
    name: "Evidence focus",
    intent: "Bring the supporting detail forward when the reasoning matters most.",
  },
  {
    id: "head-to-head",
    name: "Head to head",
    intent: "Concentrate on a pair of options without changing the underlying comparison.",
  },
  {
    id: "compact",
    name: "Compact briefing",
    intent: "Keep the comparison close to the surrounding conversation with a smaller footprint.",
  },
];

export function useGenUiDecisionDemo(active = true) {
  return useGenUiArrangementCycle(ARRANGEMENTS, active);
}

type DecisionDemoState = ReturnType<typeof useGenUiDecisionDemo>;

/** Stays outside the scrolling, centered preview so arrangements cannot move its controls. */
export function GenUiDecisionDemoToolbar({ demo }: { demo: DecisionDemoState }) {
  return <GenUiArrangementToolbar cycle={demo} groupLabel="Comparison demo arrangements" />;
}

export function GenUiDecisionDemo({
  block,
  demo,
}: {
  block: DecisionMatrixBlock;
  demo: DecisionDemoState;
}) {
  return (
    <GenUiArrangementPauseZone cycle={demo}>
      <DecisionMatrix block={block} arrangement={demo.arrangement.id} />
    </GenUiArrangementPauseZone>
  );
}
