"use client";

import type { DecisionMatrixBlock } from "@/lib/schemas/gen-ui";
import type { GenUiPreviewSize } from "./GenUiArchetypeViewTabs";

import { useState } from "react";

import {
  GEN_UI_ARRANGEMENT_INTERVAL_MS,
  useGenUiArrangementCycle,
} from "../_hooks/use-gen-ui-arrangement-cycle";

import { GenUiArrangementPauseZone, GenUiArrangementToolbar } from "./GenUiArrangementToolbar";

import {
  DecisionMatrix,
  type DecisionArrangement,
} from "@/components/chat/gen-ui/blocks/DecisionMatrix";
import { DecisionRecommendation } from "@/components/chat/gen-ui/decision/DecisionRecommendation";
import { formatMatrixScoreValue } from "@/lib/schemas/gen-ui";

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
    name: "Condensed briefing",
    intent: "Keep the comparison close to the surrounding conversation with a smaller footprint.",
  },
];

export function useGenUiDecisionDemo(active = true) {
  const cycle = useGenUiArrangementCycle(ARRANGEMENTS, active);
  const size: GenUiPreviewSize = cycle.arrangement.id === "compact" ? "condensed" : "full";

  return {
    ...cycle,
    sizeControl: {
      value: size,
      onChange: (next: GenUiPreviewSize) => {
        if (next === size) return;
        cycle.select(
          ARRANGEMENTS.findIndex(({ id }) => id === (next === "full" ? "overview" : "compact"))
        );
      },
    },
  };
}

type DecisionDemoState = ReturnType<typeof useGenUiDecisionDemo>;

/** Stays outside the scrolling, centered preview so arrangements cannot move its controls. */
export function GenUiDecisionDemoToolbar({ demo }: { demo: DecisionDemoState }) {
  return <GenUiArrangementToolbar cycle={demo} groupLabel="Comparison demo arrangements" />;
}

function CondensedDecision({ block }: { block: DecisionMatrixBlock }) {
  const [criterionId, setCriterionId] = useState(block.criteria[0].id);
  const criterion = block.criteria.find(({ id }) => id === criterionId) ?? block.criteria[0];

  return (
    <article className="mx-auto w-full max-w-sm space-y-stack-md">
      <h3 className="text-sm font-semibold wrap-anywhere">{block.question}</h3>
      <DecisionRecommendation block={block} />
      <label className="grid gap-y-stack-xs text-xs text-muted-foreground">
        Compare by criterion
        <select
          className="organic-focus min-h-11 min-w-0 rounded-md border border-border bg-background px-inset-sm text-sm text-foreground"
          value={criterion.id}
          onChange={(event) => setCriterionId(event.target.value)}
        >
          {block.criteria.map(({ id, label }) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <dl className="divide-y divide-border/60 text-sm">
        {block.options.map(({ id, name }) => {
          const score = block.scores[id]?.[criterion.id]?.value;

          return (
            <div key={id} className="flex items-baseline justify-between gap-inline-sm py-1">
              <dt className="min-w-0 wrap-anywhere">{name}</dt>
              <dd className="shrink-0 tabular-nums text-muted-foreground">
                {score === undefined ? "No score" : formatMatrixScoreValue(score)}
                {typeof score === "number" ? " / 5" : null}
              </dd>
            </div>
          );
        })}
      </dl>
    </article>
  );
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
      {demo.sizeControl.value === "condensed" ? (
        <CondensedDecision block={block} />
      ) : (
        <DecisionMatrix block={block} arrangement={demo.arrangement.id} />
      )}
    </GenUiArrangementPauseZone>
  );
}
