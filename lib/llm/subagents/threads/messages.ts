import type { UIMessage } from "ai";

import { randomUUID } from "crypto";

/**
 * Message conventions inside a subagent's own thread. The orchestrator's assignment arrives as a
 * `user` turn tagged `source: "orchestrator"`, so the worker reads its thread like any chat.
 */
export const SUBAGENT_GOAL_MESSAGE_SOURCE = "orchestrator";
const SUBAGENT_GOAL_TEXT_PREFIX = "From the orchestrator:";
export const SUBAGENT_REPLY_MESSAGE_SOURCE = "subagent-worker";

export type SubagentGoalMessageMetadata = {
  source: typeof SUBAGENT_GOAL_MESSAGE_SOURCE;
  goalId: string;
  /**
   * The orchestrator's brief when context was sent with it (COA-258). The text holds brief plus
   * context; cards, snapshots and the worker's reminder use the brief alone.
   */
  brief?: string;
  /** Worktable bundles sent with this assignment. */
  bundles?: Array<{ id: string; name: string }>;
};

export type SubagentReplyMessageMetadata = {
  source: typeof SUBAGENT_REPLY_MESSAGE_SOURCE;
  goalId: string;
  modelId: string;
  failed?: true;
};

/** Plain text of a UI message (text parts only). */
export function uiMessageText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
}

/** Assignment text without the “From the orchestrator:” label. */
export function stripSubagentGoalPrefix(text: string): string {
  const trimmed = text.trim();

  return trimmed.startsWith(SUBAGENT_GOAL_TEXT_PREFIX)
    ? trimmed.slice(SUBAGENT_GOAL_TEXT_PREFIX.length).trim()
    : trimmed;
}

/** The assignment itself: the stored brief, else the text without its label. */
export function subagentGoalBrief(message: UIMessage): string {
  const brief = (message.metadata as Partial<SubagentGoalMessageMetadata> | undefined)?.brief;

  return typeof brief === "string" && brief.trim() ? brief.trim() : stripSubagentGoalPrefix(uiMessageText(message));
}

export function buildSubagentGoalMessage(args: {
  goal: string;
  goalId: string;
  id?: string;
  /** Rendered context sent below the brief. */
  context?: string;
  bundles?: Array<{ id: string; name: string }>;
}): UIMessage<SubagentGoalMessageMetadata> {
  const brief = args.goal.trim();
  const context = args.context?.trim();

  return {
    id: args.id ?? randomUUID(),
    role: "user",
    metadata: {
      source: SUBAGENT_GOAL_MESSAGE_SOURCE,
      goalId: args.goalId,
      ...(context ? { brief } : {}),
      ...(args.bundles?.length ? { bundles: args.bundles } : {}),
    },
    parts: [
      {
        type: "text",
        text: `${SUBAGENT_GOAL_TEXT_PREFIX}\n${brief}${context ? `\n\n${context}` : ""}`,
      },
    ],
  };
}

export function buildSubagentReplyMessage(args: {
  text: string;
  goalId: string;
  modelId: string;
  failed?: boolean;
  id?: string;
}): UIMessage<SubagentReplyMessageMetadata> {
  return {
    id: args.id ?? randomUUID(),
    role: "assistant",
    metadata: {
      source: SUBAGENT_REPLY_MESSAGE_SOURCE,
      goalId: args.goalId,
      modelId: args.modelId,
      ...(args.failed ? { failed: true as const } : {}),
    },
    parts: [{ type: "text", text: args.text }],
  };
}
