import "server-only";

import type { StageEvent, StageState } from "./schema";

import { describeStageDesignFailure } from "./design-failure";
import { generateStageDesign, StageGenerationError } from "./agent";
import { availableStageChildSlot, repairStageLayout, StageLayoutError } from "./layout";
import { mergeStageDesignPlan, sanitizeDesignPlan } from "./reconcile";
import {
  acquireStageLease,
  mutateStage,
  readStage,
  releaseStageLease,
  renewStageLease,
  StageLeaseLostError,
} from "./store";

import { createLogger } from "@/lib/logger";

const logger = createLogger("lib/stage/design.ts");

// Covers two generation attempts (50s each) plus one layout-level regeneration.
const DESIGN_TIMEOUT_MS = 240_000;
// How often a running designer renews its lease and checks for a cancel or a newer job.
const DESIGN_WATCH_MS = 750;
// A watch tick that errors (a Redis hiccup) is retried; the run only stops once renewals have
// failed for this long, which stays under the 30s design lease.
const DESIGN_LEASE_GRACE_MS = 20_000;
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
  let leaseLost = false;
  let seenRevision = 0;
  let renewedAt = Date.now();
  // Keeps the lease alive for as long as the run is, and stops the run on a cancel or a newer job.
  // One Redis command per tick; only a changed revision is worth decoding the whole stage for.
  const poll = async () => {
    try {
      const revision = await renewStageLease(args.ownerId, lease);

      if (revision === null) {
        leaseLost = true;
        controller.abort();
      } else {
        renewedAt = Date.now();
        if (revision !== seenRevision) {
          const { state } = await readStage(args.ownerId);

          seenRevision = revision;
          if (state.design?.id !== args.jobId || state.design.status === "canceling")
            controller.abort();
        }
      }
    } catch {
      if (Date.now() - renewedAt > DESIGN_LEASE_GRACE_MS) {
        leaseLost = true;
        controller.abort();
      }
    }
    if (!disposed && !controller.signal.aborted) timer = setTimeout(poll, DESIGN_WATCH_MS);
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
    const startBase = await mutateStage(
      args.ownerId,
      "design-start",
      (state) => {
        if (state.design?.id !== args.jobId || state.design.status !== "working") return null;
        const slot = availableStageChildSlot(state, args.jobId);

        if (slot === null) return null;

        // A worker taking over a job already under way keeps its start, so the stale-job timeout
        // still bounds the job as a whole rather than restarting with every takeover.
        const startedAt =
          state.design.phase === "working" ? state.design.startedAt : new Date().toISOString();

        return repairStageLayout({
          ...state,
          design: { ...state.design, phase: "working", slot, startedAt },
        });
      },
      { lease }
    );

    if (!startBase) return;
    void poll();
    let result: Awaited<ReturnType<typeof generateStageDesign>>;
    let feedback: string | undefined;
    let planBase = startBase;
    let chatIds = new Map<number, string>();
    let widgetIds = new Map<number, string>();
    let stillCurrent: Awaited<ReturnType<typeof readStage>>;
    const spent = { inputTokens: 0, outputTokens: 0 };

    // A plan the layout engine rejects (no free space, a target the user just changed) is
    // regenerated once against fresh state with the reason, instead of failing the whole job.
    for (;;) {
      result = await generateStageDesign({
        ownerId: args.ownerId,
        clerkUserId: args.clerkUserId,
        state: planBase,
        brief: args.brief,
        feedback,
        signal: controller.signal,
      });

      if (controller.signal.aborted) throw new DOMException("Designer stopped", "AbortError");
      const { plan: usable, dropped } = sanitizeDesignPlan(result.plan);

      // Unusable operations are dropped. Only a plan with nothing left is worth another attempt.
      if (dropped.length && !usable.operations.length && !feedback) {
        feedback = dropped.join("; ");
        spent.inputTokens += result.usage.inputTokens;
        spent.outputTokens += result.usage.outputTokens;
        continue;
      }
      // Second attempt also unusable: say why, rather than completing as if nothing was asked.
      if (dropped.length && !usable.operations.length) throw new StageLayoutError(dropped[0]);
      result = { ...result, plan: usable };
      spent.inputTokens += result.usage.inputTokens;
      spent.outputTokens += result.usage.outputTokens;
      usage = { ...spent };
      model = result.model;
      chatIds = new Map<number, string>();
      widgetIds = new Map<number, string>();

      for (const [index, operation] of result.plan.operations.entries()) {
        if (operation.operation !== "upsert" || operation.targetId) continue;
        widgetIds.set(index, crypto.randomUUID());
        // Persist the server-owned identity now; hydrate its real thread only after the layout commits.
        if (operation.kind === "chat") chatIds.set(index, crypto.randomUUID());
      }
      stillCurrent = await readStage(args.ownerId);

      if (
        stillCurrent.state.design?.id !== args.jobId ||
        stillCurrent.state.design.status !== "working"
      )
        break;
      try {
        // Validate before committing; every CAS retry reconciles against concurrent user changes.
        mergeStageDesignPlan(stillCurrent.state, planBase, result.plan, chatIds, widgetIds);
        break;
      } catch (error) {
        if (!(error instanceof StageLayoutError) || feedback) throw error;
        feedback = error.message;
        planBase = stillCurrent.state;
      }
    }
    const base = planBase;

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
    if (error instanceof StageLeaseLostError) leaseLost = true;
    const failure = describeStageDesignFailure(leaseLost ? new StageLeaseLostError() : error);

    logger.warn("runStageDesign", "design_failed", {
      jobId: args.jobId,
      model,
      code: failure.code,
    });
    // Another worker may own the job now; failing it here would end that worker's run. If nobody
    // does, the next read finds the job stale or schedules it again.
    if (leaseLost) return;
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
