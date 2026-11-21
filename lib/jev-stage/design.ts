import "server-only";

import type { StageState } from "@/lib/stage/schema";

import { after } from "next/server";

import { acquireJevStageLease, mutateJevStage, releaseJevStageLease } from "./store";

import { generateStageDesign } from "@/lib/stage/agent";
import { describeStageDesignFailure } from "@/lib/stage/design-failure";
import { availableStageChildSlot, repairStageLayout, StageLayoutError } from "@/lib/stage/layout";
import { STAGE_OVERVIEW } from "@/lib/stage/placements";
import { mergeStageDesignPlan, sanitizeDesignPlan } from "@/lib/stage/reconcile";

const DESIGN_MODEL_DEADLINE_MS = 180_000;
const DESIGN_COMMIT_DEADLINE_MS = 260_000;

type Identity = { ownerId: string; clerkUserId: string };

const designRuntime = {
  acquire: acquireJevStageLease,
  mutate: mutateJevStage,
  release: releaseJevStageLease,
  generate: generateStageDesign,
};

export function scheduleJevStageDesign(identity: Identity, state: StageState) {
  if (state.design?.status !== "working") return;
  const jobId = state.design.id;

  after(() => runJevStageDesign(identity, jobId));
}

export async function runJevStageDesign(
  identity: Identity,
  jobId: string,
  runtime = designRuntime
) {
  const lease = await runtime.acquire(identity.ownerId, "design");

  if (!lease) return;
  const deadline = AbortSignal.timeout(DESIGN_COMMIT_DEADLINE_MS);

  try {
    let started = false;
    const start = await runtime.mutate(identity.ownerId, (current) => {
      const job = current.stage.design;

      if (job?.id !== jobId || job.status !== "working") return current;
      if (
        job.phase === "working" &&
        Date.now() - Date.parse(job.startedAt) >= DESIGN_COMMIT_DEADLINE_MS
      ) {
        return {
          ...current,
          stage: {
            ...current.stage,
            revision: current.stage.revision + 1,
            design: {
              ...job,
              status: "failed",
              error: "The designer stopped before finishing. Retry when ready.",
            },
          },
        };
      }
      const slot = availableStageChildSlot(current.stage, jobId);

      if (slot === null) return current;
      started = true;

      return {
        ...current,
        stage: repairStageLayout({
          ...current.stage,
          revision: current.stage.revision + 1,
          design: { ...job, slot, phase: "working", startedAt: new Date().toISOString() },
        }),
      };
    });

    if (!started || !start) return;
    const job = start.stage.design;

    if (job?.id !== jobId || job.status !== "working" || job.phase !== "working") return;
    const signal = AbortSignal.any([deadline, AbortSignal.timeout(DESIGN_MODEL_DEADLINE_MS)]);
    let base = start.stage;
    let feedback: string | undefined;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await runtime.generate({
        ...identity,
        state: base,
        brief: `${job.brief}\nIf the brief requests code examples, show them in the supported code-diff block as added example files. The code is for display only.`,
        feedback,
        signal,
      });
      const { plan, dropped } = sanitizeDesignPlan(result.plan);

      try {
        if (!plan.operations.length) {
          throw new StageLayoutError(dropped[0] ?? "The designer returned no stage pieces.");
        }
        await runtime.mutate(
          identity.ownerId,
          (current) => {
            const stage = current.stage;

            if (stage.design?.id !== jobId || stage.design.status !== "working") return current;
            const chatIds = new Map<number, string>();

            plan.operations.forEach((operation, index) => {
              if (
                operation.operation === "upsert" &&
                operation.kind === "chat" &&
                !operation.targetId
              )
                chatIds.set(index, crypto.randomUUID());
            });
            try {
              const widgets = mergeStageDesignPlan(stage, base, plan, chatIds);
              const [next, ...pendingDesigns] = stage.pendingDesigns;
              const showPieces =
                (stage.presentation?.view.kind ?? "organic") === "organic" &&
                plan.operations.some((operation) => operation.operation === "upsert");

              return {
                ...current,
                stage: {
                  ...stage,
                  revision: stage.revision + 1,
                  lastModel: result.model,
                  widgets,
                  pendingDesigns,
                  design: next
                    ? {
                        ...next,
                        status: "working",
                        phase: "queued",
                        startedAt: new Date().toISOString(),
                      }
                    : null,
                  ...(showPieces
                    ? { viewCommand: { id: crypto.randomUUID(), target: STAGE_OVERVIEW } }
                    : {}),
                },
              };
            } catch (error) {
              base = stage;
              throw error;
            }
          },
          deadline
        );

        return;
      } catch (error) {
        if (attempt || !(error instanceof StageLayoutError)) throw error;
        feedback = error.message;
      }
    }
  } catch (error) {
    const failure = describeStageDesignFailure(error);

    await runtime.mutate(identity.ownerId, (current) =>
      current.stage.design?.id === jobId
        ? {
            ...current,
            stage: {
              ...current.stage,
              revision: current.stage.revision + 1,
              design: { ...current.stage.design, status: "failed", error: failure.message },
            },
          }
        : current
    );
  } finally {
    await runtime.release(identity.ownerId, lease, "design");
  }
}

export async function retryJevStageDesign(ownerId: string) {
  return mutateJevStage(ownerId, (current) => {
    const job = current.stage.design;

    if (job?.status !== "failed") return current;

    return {
      ...current,
      stage: {
        ...current.stage,
        revision: current.stage.revision + 1,
        design: {
          id: job.id,
          brief: job.brief,
          status: "working",
          phase: "queued",
          startedAt: new Date().toISOString(),
        },
      },
    };
  });
}

export async function cancelJevStageDesign(ownerId: string, jobId: string) {
  return mutateJevStage(ownerId, (current) => {
    const stage = current.stage;

    if (stage.design?.id !== jobId) return current;
    const [next, ...pendingDesigns] = stage.pendingDesigns;

    return {
      ...current,
      stage: {
        ...stage,
        revision: stage.revision + 1,
        pendingDesigns,
        design: next
          ? { ...next, status: "working", phase: "queued", startedAt: new Date().toISOString() }
          : null,
      },
    };
  });
}
