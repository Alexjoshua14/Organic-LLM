import type { StageState } from "./schema";

import { placeStageWorkerPieces } from "./artifacts";
import { repairStageLayout } from "./layout";

/** Bring prior preview snapshots onto the current reservation and response contracts. */
export function restoreStageLayout(state: StageState): StageState {
  let next = repairStageLayout(state);
  const messages = next.messages.map((message) => {
    if (message.role !== "assistant" || message.author) return message;
    const agent = next.subagents?.find(
      (item) => item.result && message.text === `${item.name} finished.\n\n${item.result}`
    );

    return agent
      ? {
          ...message,
          text: agent.result!,
          author: { id: agent.id, name: agent.name, kind: "subagent" as const },
        }
      : message;
  });

  if (messages.some((message, index) => message !== next.messages[index]))
    next = { ...next, messages };
  for (const agent of next.subagents ?? [])
    if (agent.status === "done" && agent.result)
      next = placeStageWorkerPieces(next, [], { id: agent.id, name: agent.name }, agent.result);

  return next;
}
