import "server-only";

import { after } from "next/server";

import { assignStageSubagents } from "./subagent-state";
import { scheduleStageSubagents } from "./subagents";
import { StageLayoutError } from "./layout";
import { generateStageTurn, modelForTier, StageGenerationError } from "./agent";
import { runStageDesign } from "./design";
import { STAGE_MAX_PENDING_DESIGNS, type StageState, type StageTurnSettings } from "./schema";
import {
  acquireStageLease,
  hasStageRequest,
  mutateStage,
  readStage,
  releaseStageLease,
} from "./store";

import { checkLlmMessageLimit } from "@/lib/rate-limit/llm";
import { requirePlanBudget } from "@/lib/api/plan-budget-gate";

export class StageTurnError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export function scheduleStageDesign(
  id: { ownerId: string; clerkUserId: string },
  state: StageState
) {
  const job = state.design;

  if (job?.status === "working")
    after(() => runStageDesign({ ...id, jobId: job.id, base: state, brief: job.brief }));
}

/** Text and voice share the same lease, idempotency, budget, history and designer queue. */
export async function runStageTurn(
  id: { ownerId: string; clerkUserId: string },
  message: string,
  requestId: string,
  settings?: StageTurnSettings
): Promise<StageState> {
  if (await hasStageRequest(id.ownerId, requestId)) return (await readStage(id.ownerId)).state;
  const lease = await acquireStageLease(id.ownerId, "turn");

  if (!lease)
    throw new StageTurnError("The central agent is answering another message. Retry shortly.", 409);
  try {
    if (await hasStageRequest(id.ownerId, requestId)) return (await readStage(id.ownerId)).state;
    const gate = await requirePlanBudget({ clerkUserId: id.clerkUserId, sbUserId: id.ownerId });

    if (gate) throw new StageTurnError("Your plan budget is exhausted.", gate.status);
    const { state: base } = await readStage(id.ownerId);
    const limited = await checkLlmMessageLimit(id.ownerId);

    if (!limited.success) throw new StageTurnError(limited.error ?? "Too many messages", 429);
    let result;

    try {
      result = await generateStageTurn({ ...id, state: base, message, settings });
    } catch (error) {
      if (error instanceof StageGenerationError) {
        await mutateStage(
          id.ownerId,
          "turn-failed",
          (current) => ({ ...current, lastModel: error.model }),
          {
            requestId,
            usage: error.usage,
            call: { operation: "turn", model: error.model, outcome: "failed" },
          }
        );
      }
      throw error;
    }
    const job = result.designBrief ? { id: crypto.randomUUID(), brief: result.designBrief } : null;
    const assistantId = crypto.randomUUID();
    const state = await mutateStage(
      id.ownerId,
      "turn",
      (current) => {
        const queueFull =
          !!job && !!current.design && current.pendingDesigns.length >= STAGE_MAX_PENDING_DESIGNS;
        let assigned = current;
        let delegationNote = "";

        try {
          assigned = assignStageSubagents(current, result.subagents ?? [], settings);
          const started =
            (assigned.subagents ?? []).filter((agent) => agent.status === "queued").length -
            (current.subagents ?? []).filter((agent) => agent.status === "queued").length;

          if ((result.subagents?.length ?? 0) > Math.max(0, started))
            delegationNote =
              "\n\nOnly two specialists can work at once. Ask for any remaining goals once a slot is free.";
        } catch (error) {
          if (!(error instanceof StageLayoutError)) throw error;
          delegationNote =
            "\n\nMake room below Organic before starting specialists. No subagents were started.";
        }
        const reply = queueFull
          ? `${result.reply}\n\nThe designer queue is full. Please ask for this arrangement again after a design finishes.`
          : result.reply;
        const design =
          job && !current.design
            ? { ...job, status: "working" as const, startedAt: new Date().toISOString() }
            : current.design;

        return {
          ...assigned,
          messages: [
            ...current.messages,
            { id: requestId, role: "user" as const, text: message },
            {
              id: assistantId,
              role: "assistant" as const,
              text: `${reply}${delegationNote}`.slice(0, 8000),
            },
          ].slice(-24),
          summary: result.summary,
          lastModel: result.model,
          nextModel: modelForTier(result.nextTier),
          design,
          pendingDesigns:
            job && current.design && !queueFull
              ? [...current.pendingDesigns, job]
              : current.pendingDesigns,
        };
      },
      {
        requestId,
        deduplicate: true,
        usage: result.usage,
        lease,
        call: { operation: "turn", model: result.model, outcome: "complete" },
      }
    );
    const latest = state ?? (await readStage(id.ownerId)).state;

    scheduleStageDesign(id, latest);
    scheduleStageSubagents(id, latest);

    return latest;
  } finally {
    await releaseStageLease(id.ownerId, lease);
  }
}
