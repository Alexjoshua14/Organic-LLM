import type { StageWorkerPiece } from "./worker-output";

import { placeStageWorkerPieces } from "./artifacts";
import {
  STAGE_MAX_SUBAGENTS,
  stageSubagentActive,
  type StageState,
  type StageSubagent,
  type StageSubagentAssignment,
  type StageTurnSettings,
} from "./schema";

export function assignStageSubagents(
  state: StageState,
  assignments: StageSubagentAssignment[],
  settings?: StageTurnSettings
): StageState {
  const active = (state.subagents ?? []).filter(stageSubagentActive);
  const accepted = assignments.slice(0, STAGE_MAX_SUBAGENTS - active.length);

  if (!accepted.length) return state;
  const startedAt = new Date().toISOString();

  return {
    ...state,
    subagents: [
      ...active,
      ...accepted.map(
        (assignment): StageSubagent => ({
          ...assignment,
          id: crypto.randomUUID(),
          status: "queued",
          startedAt,
          result: null,
          memory: settings?.memory === true,
          webSearch: settings?.webSearch === true,
        })
      ),
    ],
  };
}

/** Cancel wins over a late model result. Completed work never resurrects a stopped child. */
export function settleStageSubagent(
  state: StageState,
  id: string,
  status: "done" | "failed" | "canceled",
  result: string | null,
  pieces: StageWorkerPiece[] = []
): StageState | null {
  const agent = state.subagents?.find((item) => item.id === id);

  if (!agent || !stageSubagentActive(agent)) return null;
  const finalStatus = agent.status === "canceling" ? "canceled" : status;
  const text =
    finalStatus === "done"
      ? (result ?? "Finished this goal.")
      : finalStatus === "canceled"
        ? `${agent.name} was stopped.`
        : `${agent.name} couldn’t finish this goal. You can ask Organic to try again.`;

  const settled: StageState = {
    ...state,
    subagents: state.subagents!.map((item) =>
      item.id === id
        ? { ...item, status: finalStatus, result: finalStatus === "done" ? result : null }
        : item
    ),
    messages: [
      ...state.messages,
      {
        id: crypto.randomUUID(),
        role: "assistant" as const,
        text: text.slice(0, 8000),
        author: { id: agent.id, name: agent.name, kind: "subagent" as const },
      },
    ].slice(-24),
  };

  return finalStatus === "done" && result
    ? placeStageWorkerPieces(settled, pieces, { id: agent.id, name: agent.name }, result)
    : settled;
}
