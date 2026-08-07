import type { DrawerChatDisplayInput } from "@/lib/rabbit-holes/drawer-chat-ui-budget";

import { computeDrawerChatBudget } from "@/lib/rabbit-holes/drawer-chat-ui-budget";
import {
  RABBIT_HOLE_DRAWER_SYSTEM_APPEND,
  RABBIT_HOLE_TOOL_INSTRUCTIONS,
} from "@/lib/system-prompt/rabbit-hole-drawer";

export function appendRabbitHoleDrawerSystemFragments(
  systemPrompt: string,
  opts?: { drawerDisplay?: DrawerChatDisplayInput; includeToolInstructions?: boolean }
): string {
  let out = `${systemPrompt}\n\n${RABBIT_HOLE_DRAWER_SYSTEM_APPEND}`;

  if (opts?.drawerDisplay) {
    const budget = computeDrawerChatBudget(opts.drawerDisplay);

    out += `\n\n${budget.promptText}`;
  }

  if (opts?.includeToolInstructions) {
    out += `\n\nTool Instructions:\n${RABBIT_HOLE_TOOL_INSTRUCTIONS}`;
  }

  return out;
}
