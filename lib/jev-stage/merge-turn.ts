import { STAGE_MAX_PENDING_DESIGNS, type StageState } from "@/lib/stage/schema";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Preserve intervening writes. Layout fields have shared constraints and commit together. */
export function mergeJevStageTurn(base: StageState, result: StageState, current: StageState) {
  const state = {
    ...current,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString(),
  };
  let conflict = false;
  const merge = <K extends keyof StageState>(key: K) => {
    if (same(base[key], result[key])) return;
    if (same(current[key], base[key])) state[key] = result[key];
    else if (!same(current[key], result[key])) conflict = true;
  };

  const scene = ["widgets", "subagents", "presentation", "viewCommand"] as const;
  if (scene.some((key) => !same(base[key], result[key]))) {
    if (scene.every((key) => same(current[key], base[key]))) {
      for (const key of scene) merge(key);
    } else {
      conflict = true;
    }
  }
  merge("summary");
  merge("nextModel");
  if (base.lastModel !== result.lastModel) state.lastModel = result.lastModel;

  const oldMessages = new Set(base.messages.map((entry) => entry.id));
  state.messages = [
    ...current.messages,
    ...result.messages.filter((entry) => !oldMessages.has(entry.id)),
  ].slice(-24);

  // A designer can finish or another turn can queue a job while this model is running.
  // Rebase new briefs onto the current queue without replaying an old job.
  const oldJobs = new Set([base.design?.id, ...base.pendingDesigns.map((job) => job.id)]);
  const newJobs = [result.design, ...result.pendingDesigns].filter(
    (job): job is NonNullable<typeof job> => !!job && !oldJobs.has(job.id)
  );
  for (const { id, brief } of newJobs) {
    if (!state.design) {
      state.design = { id, brief, status: "working", phase: "queued", startedAt: state.updatedAt };
    } else if (state.pendingDesigns.length < STAGE_MAX_PENDING_DESIGNS) {
      state.pendingDesigns = [...state.pendingDesigns, { id, brief }];
    } else {
      conflict = true;
    }
  }

  return { state, conflict };
}
