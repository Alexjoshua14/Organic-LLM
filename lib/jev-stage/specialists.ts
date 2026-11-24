import "server-only";

import { JEV_STAGE_TURN_DEADLINE_MS } from "./constants";
import { withJevStageSteering } from "./steering";
import { mutateJevStage, readJevStage } from "./store";
import { cacheByProvider, finishModelCall, summarizeCalls } from "./trace";

import {
  cancelStageSubagent,
  recoverStaleStageSubagents,
  scheduleStageSubagents,
  type StageSubagentRuntime,
} from "@/lib/stage/subagents";
import type { StageState } from "@/lib/stage/schema";

type Identity = { ownerId: string; clerkUserId: string };

function specialistRuntime(ownerId: string): StageSubagentRuntime {
  return {
    namespace: "jev-stage",
    route: "/api/prototypes/jev-stage",
    read: async (id) => ({ state: (await readJevStage(id)).stage }),
    async mutate(id, _cause, update) {
      let changed = false;
      const bundle = await mutateJevStage(
        id,
        (current) => {
          const state = update(current.stage);

          if (!state) return current;
          changed = true;
          return {
            ...current,
            stage: {
              ...state,
              revision: current.stage.revision + 1,
              updatedAt: new Date().toISOString(),
            },
          };
        },
        AbortSignal.timeout(JEV_STAGE_TURN_DEADLINE_MS)
      );

      return changed ? (bundle?.stage ?? null) : null;
    },
    steer: (job, run) => withJevStageSteering(ownerId, job.id, `${job.name}: ${job.goal}`, run),
    async onUsage(job, { steps, ...usage }) {
      const call = finishModelCall({
        ...usage,
        id: job.id,
        operation: "specialist",
        cacheByProvider: cacheByProvider(usage.model, steps),
      });

      await mutateJevStage(
        ownerId,
        (current) => {
          if (!current.insights.some((entry) => entry.specialistIds?.includes(job.id)))
            return current;
          return {
            stage: { ...current.stage, revision: current.stage.revision + 1 },
            insights: current.insights.map((entry) => {
              if (!entry.specialistIds?.includes(job.id)) return entry;
              const calls = [...entry.calls.filter((item) => item.id !== job.id), call];
              const totals = summarizeCalls(calls);

              return {
                ...entry,
                ...totals,
                calls,
                trace: entry.trace?.map((event) =>
                  event.kind === "done" ? { ...event, totals: totals.totals } : event
                ),
              };
            }),
          };
        },
        AbortSignal.timeout(JEV_STAGE_TURN_DEADLINE_MS)
      );
    },
  };
}

export function scheduleJevStageSpecialists(identity: Identity, state: StageState) {
  scheduleStageSubagents(identity, state, specialistRuntime(identity.ownerId));
}

export async function recoverJevStageSpecialists(ownerId: string, state: StageState) {
  return recoverStaleStageSubagents(ownerId, state, specialistRuntime(ownerId));
}

export async function cancelJevStageSpecialist(ownerId: string, jobId: string) {
  await cancelStageSubagent(ownerId, jobId, specialistRuntime(ownerId));
  return readJevStage(ownerId);
}
