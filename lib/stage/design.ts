import "server-only";

import { generateStageDesign, StageGenerationError } from "./agent";
import { mergeStageDesignPlan } from "./reconcile";
import { acquireStageLease, mutateStage, readStage, releaseStageLease } from "./store";
import type { StageEvent, StageState } from "./schema";

const DESIGN_TIMEOUT_MS = 90_000;

export async function runStageDesign(args: {
  ownerId: string; clerkUserId: string; jobId: string; base: StageState; brief: string;
}) {
  const lease = await acquireStageLease(args.ownerId, "design");
  if (!lease) return;
  let usage: StageEvent["usage"] = null;
  let model: string | null = null;
  try {
    const current = await readStage(args.ownerId);
    if (current.state.design?.id !== args.jobId || current.state.design.status !== "working") return;
    // Read the durable current layout, including edits made before this worker actually starts.
    const base = current.state;
    const result = await generateStageDesign({ ownerId: args.ownerId, clerkUserId: args.clerkUserId, state: base, brief: args.brief });
    usage = result.usage;
    model = result.model;
    const chatIds = new Map<number, string>();
    const widgetIds = new Map<number, string>();
    for (const [index, operation] of result.plan.operations.entries()) {
      if (operation.operation !== "upsert" || operation.targetId) continue;
      widgetIds.set(index, crypto.randomUUID());
      // Persist the server-owned identity now; hydrate its real thread only after the layout commits.
      if (operation.kind === "chat") chatIds.set(index, crypto.randomUUID());
    }
    const stillCurrent = await readStage(args.ownerId);
    if (stillCurrent.state.design?.id !== args.jobId) {
      await mutateStage(args.ownerId, "design-complete", (state) => ({ ...state, lastModel: result.model }), {
        usage, call: { operation: "design", model: result.model, outcome: "superseded" },
      });
      return;
    }
    // Validate before committing; every CAS retry reconciles against concurrent user changes.
    mergeStageDesignPlan(stillCurrent.state, base, result.plan, chatIds, widgetIds);
    await mutateStage(args.ownerId, "design-complete", (state) => {
      if (state.design?.id !== args.jobId) return { ...state, lastModel: result.model };
      const [next, ...pendingDesigns] = state.pendingDesigns;
      return {
        ...state, widgets: mergeStageDesignPlan(state, base, result.plan, chatIds, widgetIds),
        lastModel: result.model, pendingDesigns,
        design: next ? { ...next, status: "working", startedAt: new Date().toISOString() } : null,
      };
    }, { usage, lease, call: { operation: "design", model: result.model, outcome: "complete" } });
  } catch (error) {
    if (error instanceof StageGenerationError) { usage = error.usage; model = error.model; }
    await mutateStage(args.ownerId, "design-failed", (state) => ({
      ...state, lastModel: model ?? state.lastModel,
      design: state.design?.id === args.jobId
        ? { ...state.design, status: "failed", error: "Design could not finish. Retry when ready." }
        : state.design,
    }), { usage, call: model ? { operation: "design", model, outcome: "failed" } : null });
  } finally {
    await releaseStageLease(args.ownerId, lease);
  }
}

export function designIsStale(state: StageState) {
  return state.design?.status === "working" &&
    Date.now() - Date.parse(state.design.startedAt) > DESIGN_TIMEOUT_MS;
}
