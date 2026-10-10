import type { UIMessage } from "ai";
import type { HardSetSubagent } from "@/lib/llm/subagents/hard-set/types";

import { randomUUID } from "crypto";

export const SUBAGENT_REFLEX_MESSAGE_SOURCE = "subagent-reflex";

export type SubagentReflexMessageMetadata = {
  source: typeof SUBAGENT_REFLEX_MESSAGE_SOURCE;
  agentId: string;
  reflex: "help";
};

/** System fragment for every model turn in a hard-set subagent's shell thread. */
export function formatHardSetShellFragment(agent: HardSetSubagent): string {
  return [
    `[Subagent shell: ${agent.name}]`,
    `You are ${agent.name}, the ${agent.role} subagent. This thread is your shell: the user is talking to you directly to try you out. Answer as ${agent.name}, in role, following your instructions below over any general persona.`,
    "",
    agent.instructions,
  ].join("\n");
}

/** The reflexive help menu as an assistant message — sent with no model call. */
export function buildHelpReflexMessage(
  agent: HardSetSubagent,
  id: string = randomUUID()
): UIMessage<SubagentReflexMessageMetadata> {
  return {
    id,
    role: "assistant",
    metadata: { source: SUBAGENT_REFLEX_MESSAGE_SOURCE, agentId: agent.id, reflex: "help" },
    parts: [{ type: "text", text: agent.helpMenu }],
  };
}
