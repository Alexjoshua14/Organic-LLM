import type { ChatExperience } from "@/lib/chat/chat-experience";

/** Same cap as historical app/api/chat/route.ts */
export const MAX_TOOL_STEPS = 10;

export type ComputeMainChatMaxStepsParams = {
  experience: ChatExperience | undefined;
  hasTools: boolean;
};

export function computeMainChatMaxSteps(params: ComputeMainChatMaxStepsParams): number {
  const { experience, hasTools } = params;

  let maxSteps = hasTools ? MAX_TOOL_STEPS : 2;

  if (experience === "strata_hub") {
    maxSteps = Math.min(maxSteps, 8);
  }

  return maxSteps;
}
