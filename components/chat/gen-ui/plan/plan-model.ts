import type { PlanStepStatus, PlanTimelineBlock, PlanTimelineStep } from "@/lib/schemas/gen-ui";

/**
 * Everything the plan UI states is derived here from the declared block, and only from it.
 * The schema has no dates, durations, owners or percent complete, so none appear: counts are
 * counts of steps, `time` / `estimate` are opaque strings that are never parsed or summed, and
 * order is array order.
 */

/** What one `dependsOn` entry resolves to. Ids are not validated by the schema. */
export type PlanDependency =
  | { kind: "step"; id: string; index: number; /** how many steps share this id */ matches: number }
  | { kind: "self"; id: string }
  | { kind: "missing"; id: string };

export type PlanStepView = {
  index: number;
  /** Ids are not unique in the schema, so React keys include the position. */
  key: string;
  /** Two-digit position shown to the reader: "03". */
  number: string;
  step: PlanTimelineStep;
  dependsOn: PlanDependency[];
  /** Indices of steps that declare this one as a dependency (first match of a shared id). */
  neededBy: number[];
  substeps: { total: number; done: number };
};

export type PlanTally = Record<PlanStepStatus, number> & { total: number };

export type PlanModel = {
  steps: PlanStepView[];
  tally: PlanTally;
  /** Where the focus starts when the reader has not chosen a step. */
  lead: number;
  /** Indices of every step marked `now`. */
  nowIndexes: number[];
  /** True when any step or substep carries a `time` (decides whether a time rail is worth it). */
  timed: boolean;
};

export function formatStepNumber(index: number): string {
  return String(index + 1).padStart(2, "0");
}

function resolveDependencies(
  id: string,
  ownIndex: number,
  indexesById: Map<string, number[]>
): PlanDependency | null {
  const matches = indexesById.get(id) ?? [];

  if (matches.length === 0) return { kind: "missing", id };

  const other = matches.find((index) => index !== ownIndex);

  if (other === undefined) return { kind: "self", id };

  return { kind: "step", id, index: other, matches: matches.length };
}

/** First `now`, else first `blocked`, else first `next`, else the last step. */
export function pickLeadIndex(steps: readonly Pick<PlanTimelineStep, "status">[]): number {
  for (const status of ["now", "blocked", "next"] as const) {
    const found = steps.findIndex((step) => step.status === status);

    if (found >= 0) return found;
  }

  return Math.max(0, steps.length - 1);
}

export function derivePlan(block: Pick<PlanTimelineBlock, "steps">): PlanModel {
  const indexesById = new Map<string, number[]>();

  block.steps.forEach((step, index) => {
    indexesById.set(step.id, [...(indexesById.get(step.id) ?? []), index]);
  });

  const tally: PlanTally = { done: 0, now: 0, next: 0, blocked: 0, total: block.steps.length };
  const nowIndexes: number[] = [];

  const steps: PlanStepView[] = block.steps.map((step, index) => {
    tally[step.status] += 1;
    if (step.status === "now") nowIndexes.push(index);

    const seen = new Set<string>();
    const dependsOn: PlanDependency[] = [];

    for (const id of step.dependsOn ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      const dependency = resolveDependencies(id, index, indexesById);

      if (dependency) dependsOn.push(dependency);
    }

    return {
      index,
      key: `${index}:${step.id}`,
      number: formatStepNumber(index),
      step,
      dependsOn,
      neededBy: [],
      substeps: {
        total: step.substeps?.length ?? 0,
        done: step.substeps?.filter((sub) => sub.done === true).length ?? 0,
      },
    };
  });

  for (const view of steps) {
    for (const dependency of view.dependsOn) {
      if (dependency.kind === "step") steps[dependency.index]?.neededBy.push(view.index);
    }
  }

  return {
    steps,
    tally,
    lead: pickLeadIndex(block.steps),
    nowIndexes,
    timed: block.steps.some(
      (step) => Boolean(step.time) || step.substeps?.some((sub) => Boolean(sub.time))
    ),
  };
}

/** "2 of 6 steps done · 1 now · 1 blocked · 2 next" — a labelled count, never a percentage. */
export function describeTally(tally: PlanTally): string {
  const noun = tally.total === 1 ? "step" : "steps";
  const parts = [
    tally.done === tally.total
      ? `All ${tally.total} ${noun} done`
      : `${tally.done} of ${tally.total} ${noun} done`,
  ];

  if (tally.now > 0) parts.push(`${tally.now} now`);
  else if (tally.done < tally.total) parts.push("none marked now");
  if (tally.blocked > 0) parts.push(`${tally.blocked} blocked`);
  if (tally.next > 0) parts.push(`${tally.next} next`);

  return parts.join(" · ");
}

/** "Needs 02, 03" / "Needs 02 · 1 unknown" for the index meta line; null when nothing declared. */
export function describeNeeds(view: PlanStepView): string | null {
  const resolved = view.dependsOn.flatMap((dep) =>
    dep.kind === "step" ? [formatStepNumber(dep.index)] : []
  );
  const unknown = view.dependsOn.filter((dep) => dep.kind === "missing").length;
  const selfRef = view.dependsOn.some((dep) => dep.kind === "self");
  const parts: string[] = [];

  if (resolved.length > 0) parts.push(resolved.join(", "));
  if (unknown > 0) parts.push(`${unknown} unknown`);
  if (selfRef) parts.push("itself");

  return parts.length > 0 ? `Needs ${parts.join(" · ")}` : null;
}

/**
 * Whether opening a step shows anything its collapsed row does not. A row without detail is not a
 * control — there is nothing to reveal, so it never pretends to be expandable. A blocked step's
 * note is its reason, which the row always shows, so it does not count as detail.
 */
export function stepHasDetail(view: PlanStepView): boolean {
  const { step } = view;

  return (
    (Boolean(step.note) && step.status !== "blocked") ||
    Boolean(step.time && step.estimate) ||
    view.substeps.total > 0 ||
    view.dependsOn.length > 0 ||
    view.neededBy.length > 0
  );
}

/** The step open by default: the lead — unless every step is done, then nothing needs opening. */
export function pickOpenIndex(model: Pick<PlanModel, "lead" | "tally">): number {
  return model.tally.total > 0 && model.tally.done === model.tally.total ? -1 : model.lead;
}
