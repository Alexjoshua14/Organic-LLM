import type { ModelMessage, PrepareStepResult, ToolSet } from "ai";

export const PENULTIMATE_STEP_NOTICE =
  "You have two model steps remaining, including this one. This is your last opportunity to use tools before a final response with tools disabled. Make at most one more tool call, choosing the most important remaining action, or finish now if you have enough information. Do not start work that requires further tool rounds.";

export const FINAL_STEP_NOTICE =
  "This is your final response step for this turn. Tools are now unavailable. Finish your response using the results already available. Clearly state any unfinished work or uncertainty; do not claim actions succeeded unless their results confirm it.";

/**
 * Appends a runtime notice after the conversation instead of editing `instructions`.
 *
 * Instructions and tool definitions precede every message in the provider prompt, so changing
 * either invalidates the prompt-cache prefix for the whole turn — on its most expensive steps.
 * A trailing message keeps the prefix intact. Messages returned from `prepareStep` carry into
 * later steps in AI SDK 7, and are not response messages, so they are never saved to the thread.
 * User role, because Anthropic rejects system messages after the conversation has started.
 */
function withNotice(messages: ModelMessage[], notice: string): ModelMessage[] {
  return [
    ...messages,
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `<runtime_notice>\nAutomated notice from the chat runtime, not from the user.\n${notice}\n</runtime_notice>`,
        },
      ],
    },
  ];
}

/**
 * Appends per-turn runtime state (the Arcadia subagent board, worktable, routing) after the
 * conversation instead of folding it into `instructions`, for the same cache reason as
 * {@link withNotice}: that state changes on every orchestrator turn, and in the system prompt it
 * re-billed the whole history uncached each time. Not saved to the thread, so the next turn's
 * prefix is this turn's history plus its reply.
 */
export function withTurnContext(
  messages: ModelMessage[],
  fragments: ReadonlyArray<string>
): ModelMessage[] {
  if (fragments.length === 0) return messages;

  return [
    ...messages,
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `<turn_context>\nCurrent state from the chat runtime for this turn, not from the user.\n\n${fragments.join("\n\n")}\n</turn_context>`,
        },
      ],
    },
  ];
}

/** Reserve the last model step for a reply instead of ending on tool results. */
export function prepareChatCompletionStep({
  stepNumber,
  maxSteps,
  hasTools,
  messages,
}: {
  stepNumber: number;
  maxSteps: number;
  hasTools: boolean;
  messages: ModelMessage[];
}): PrepareStepResult<ToolSet> {
  if (!hasTools) return {};
  const remainingSteps = maxSteps - stepNumber;

  if (remainingSteps <= 1) {
    // Keep the tool definitions (no `activeTools: []`): removing them also breaks the cache
    // prefix, and the final step still carries tool calls and results from earlier steps.
    return { toolChoice: "none", messages: withNotice(messages, FINAL_STEP_NOTICE) };
  }
  if (remainingSteps === 2) {
    return { messages: withNotice(messages, PENULTIMATE_STEP_NOTICE) };
  }

  return {};
}
