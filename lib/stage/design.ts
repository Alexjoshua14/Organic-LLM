import "server-only";

import type { StageEvent, StageState } from "./schema";

import { describeStageDesignFailure } from "./design-failure";
import { generateStageDesign, StageGenerationError } from "./agent";
import { availableStageChildSlot, repairStageLayout } from "./layout";
import { mergeStageDesignPlan } from "./reconcile";
import { acquireStageLease, mutateStage, readStage, releaseStageLease } from "./store";

import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/stage/design.ts");

const DESIGN_TIMEOUT_MS = 90_000;
const controllers = new Map<string, AbortController>();

function releaseDesign(state: StageState): StageState {
  const [next, ...pendingDesigns] = state.pendingDesigns;

  return {
    ...state,
    pendingDesigns,
    design: next
      ? { ...next, status: "working", phase: "queued", startedAt: new Date().toISOString() }
      : null,
  };
}

export async function cancelStageDesign(ownerId: string, jobId: string) {
  const state = await mutateStage(ownerId, "design-failed", (current) =>
    current.design?.id === jobId
      ? current.design.phase === "queued" || current.design.status === "failed"
        ? releaseDesign(current)
        : { ...current, design: { ...current.design, status: "canceling" } }
      : null
  );

  controllers.get(`${ownerId}:${jobId}`)?.abort();

  return state ?? (await readStage(ownerId)).state;
}

export async function runStageDesign(args: {
  ownerId: string;
  clerkUserId: string;
  jobId: string;
  base: StageState;
  brief: string;
}) {
  const lease = await acquireStageLease(args.ownerId, "design");

  if (!lease) return;
  let usage: StageEvent["usage"] = null;
  let model: string | null = null;
  const controller = new AbortController();
  const controllerKey = `${args.ownerId}:${args.jobId}`;

  controllers.set(controllerKey, controller);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;
  const poll = async () => {
    try {
      const { state } = await readStage(args.ownerId);

      if (state.design?.id !== args.jobId || state.design.status === "canceling")
        controller.abort();
    } catch {
      controller.abort();
    }
    if (!disposed && !controller.signal.aborted) timer = setTimeout(poll, 750);
  };

  try {
    const current = await readStage(args.ownerId);

    if (current.state.design?.id !== args.jobId) return;
    if (current.state.design.status === "canceling") {
      await mutateStage(args.ownerId, "design-failed", (state) =>
        state.design?.id === args.jobId ? releaseDesign(state) : null
      );

      return;
    }
    if (current.state.design.status !== "working") return;
    const base = await mutateStage(
      args.ownerId,
      "design-start",
      (state) => {
        if (state.design?.id !== args.jobId || state.design.status !== "working") return null;
        const slot = availableStageChildSlot(state, args.jobId);

        if (slot === null) return null;

        return repairStageLayout({
          ...state,
          design: { ...state.design, phase: "working", slot, startedAt: new Date().toISOString() },
        });
      },
      { lease }
    );

    if (!base) return;
    void poll();
    const result = await generateStageDesign({
      ownerId: args.ownerId,
      clerkUserId: args.clerkUserId,
      state: base,
      brief: args.brief,
      signal: controller.signal,
    });

    if (controller.signal.aborted) throw new DOMException("Designer stopped", "AbortError");
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

    if (
      stillCurrent.state.design?.id !== args.jobId ||
      stillCurrent.state.design.status !== "working"
    ) {
      if (
        stillCurrent.state.design?.id === args.jobId &&
        stillCurrent.state.design.status === "canceling"
      )
        throw new DOMException("Designer stopped", "AbortError");
      await mutateStage(
        args.ownerId,
        "design-complete",
        (state) => ({ ...state, lastModel: result.model }),
        {
          usage,
          call: { operation: "design", model: result.model, outcome: "superseded" },
        }
      );

      return;
    }
    // Validate before committing; every CAS retry reconciles against concurrent user changes.
    mergeStageDesignPlan(stillCurrent.state, base, result.plan, chatIds, widgetIds);
    await mutateStage(
      args.ownerId,
      "design-complete",
      (state) => {
        if (state.design?.id !== args.jobId || state.design.status !== "working")
          return { ...state, lastModel: result.model };
        const [next, ...pendingDesigns] = state.pendingDesigns;

        return {
          ...state,
          widgets: mergeStageDesignPlan(state, base, result.plan, chatIds, widgetIds),
          lastModel: result.model,
          pendingDesigns,
          design: next
            ? { ...next, status: "working", phase: "queued", startedAt: new Date().toISOString() }
            : null,
        };
      },
      { usage, lease, call: { operation: "design", model: result.model, outcome: "complete" } }
    );
  } catch (error) {
    if (error instanceof StageGenerationError) {
      usage = error.usage;
      model = error.model;
    }
    const failure = describeStageDesignFailure(error);

    logger.warn("runStageDesign", "design_failed", {
      jobId: args.jobId,
      model,
      code: failure.code,
    });
    await mutateStage(
      args.ownerId,
      "design-failed",
      (state) => ({
        ...state,
        lastModel: model ?? state.lastModel,
        ...(state.design?.id === args.jobId && state.design.status === "canceling"
          ? releaseDesign(state)
          : {}),
        design:
          state.design?.id === args.jobId && state.design.status === "canceling"
            ? releaseDesign(state).design
            : state.design?.id === args.jobId
              ? {
                  ...state.design,
                  status: "failed",
                  error: failure.message,
                }
              : state.design,
      }),
      { usage, call: model ? { operation: "design", model, outcome: "failed" } : null }
    );
  } finally {
    disposed = true;
    if (timer) clearTimeout(timer);
    controllers.delete(controllerKey);
    await releaseStageLease(args.ownerId, lease);
  }
}

export function designIsStale(state: StageState) {
  return (
    (state.design?.status === "working" || state.design?.status === "canceling") &&
    state.design.phase !== "queued" &&
    Date.now() - Date.parse(state.design.startedAt) > DESIGN_TIMEOUT_MS
  );
}
