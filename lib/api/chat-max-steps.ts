import type { ChatExperience } from "@/lib/chat/chat-experience";

/** Maximum model steps for main-chat turns with tools. */
export const MAX_TOOL_STEPS = 16;

export type ComputeMainChatMaxStepsParams = {
  experience: ChatExperience | undefined;
  hasTools: boolean;
};

export function computeMainChatMaxSteps(params: ComputeMainChatMaxStepsParams): number {
  const { experience, hasTools } = params;

  let maxSteps = hasTools ? MAX_TOOL_STEPS : 8;

  if (experience === "strata_hub") {
    maxSteps = Math.min(maxSteps, 8);
  }

  return maxSteps;
}
