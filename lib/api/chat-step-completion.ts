import type { PrepareStepResult, ToolSet } from "ai";

/** Reserve the last model step for a reply instead of ending on tool results. */
export function prepareChatCompletionStep({
  stepNumber,
  maxSteps,
  hasTools,
  instructions,
}: {
  stepNumber: number;
  maxSteps: number;
  hasTools: boolean;
  instructions: string;
}): PrepareStepResult<ToolSet> {
  if (!hasTools) return {};
  const remainingSteps = maxSteps - stepNumber;

  if (remainingSteps <= 1) {
    return {
      activeTools: [],
      toolChoice: "none",
      instructions: `${instructions}\n\nThis is your final response step for this turn. Tools are unavailable. Finish your response using the results already available. Clearly state any unfinished work or uncertainty; do not claim actions succeeded unless their results confirm it.`,
    };
  }
  if (remainingSteps === 2) {
    return {
      instructions: `${instructions}\n\nYou have two model steps remaining, including this one. This is your last opportunity to use tools before a final response with tools disabled. Make at most one more tool call, choosing the most important remaining action, or finish now if you have enough information. Do not start work that requires further tool rounds.`,
    };
  }

  return {};
}
