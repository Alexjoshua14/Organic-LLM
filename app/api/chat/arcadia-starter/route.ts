import { setThreadArcadiaStarterKey } from "@/data/supabase/chat";
import { createArcadiaStarterHandler } from "@/lib/api/arcadia-starter-handler";
import { requireLlmChatActor } from "@/lib/api/chat-llm-gate";

export const PATCH = createArcadiaStarterHandler({
  requireActor: () => requireLlmChatActor({ planBudget: false }),
  setStarterKey: setThreadArcadiaStarterKey,
});
