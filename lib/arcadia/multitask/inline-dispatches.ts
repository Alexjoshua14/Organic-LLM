import type { UIMessage } from "ai";
import type { ArcadiaSubagent } from "./types";

import { getToolOrDynamicToolName, isToolUIPart } from "ai";

export type InlineSubagentDispatch = {
  toolCallId: string;
  goalId: string;
  agentId: string;
  name: string;
  brief: string;
  threadId?: string;
  modelId?: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Only accepted, persisted dispatches become agent rows. Errors and previews stay as tools. */
export function inlineSubagentDispatch(
  part: UIMessage["parts"][number]
): InlineSubagentDispatch | null {
  if (
    !isToolUIPart(part) ||
    getToolOrDynamicToolName(part) !== "dispatch_subagent" ||
    part.state !== "output-available"
  )
    return null;
  const output = record(part.output);

  if (
    output?.success !== true ||
    output.dryRun === true ||
    typeof output.agentId !== "string" ||
    !output.agentId ||
    typeof output.goalId !== "string" ||
    !output.goalId
  )
    return null;
  const input = record(part.input);

  return {
    toolCallId: part.toolCallId,
    goalId: output.goalId,
    agentId: output.agentId,
    name: typeof output.name === "string" ? output.name : output.agentId,
    brief: typeof input?.brief === "string" ? input.brief : "Delegated assignment",
    threadId: typeof output.threadId === "string" ? output.threadId : undefined,
    modelId: typeof output.modelId === "string" ? output.modelId : undefined,
  };
}

/** Live state belongs to an assignment, never every historical row for the same agent. */
export function liveAgentForDispatch(
  dispatch: InlineSubagentDispatch,
  agents: readonly ArcadiaSubagent[]
): ArcadiaSubagent | undefined {
  return agents.find(
    (agent) => agent.id === dispatch.agentId && agent.latestGoalId === dispatch.goalId
  );
}
