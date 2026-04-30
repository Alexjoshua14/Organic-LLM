import { SYSTEM_PROMPT } from "@/lib/system-prompt/prompt-v0";

/** Same appendix as today when getContext fails or messages fail validation. */
export const MAIN_CHAT_CONTEXT_FAILURE_NOTE =
  "\n\n[System note: Chat context (conversation summary and recent messages) could not be loaded for this request. Only the user's latest message is in context. Use get_more_chat_history or get_full_chat_history if you need prior conversation or memories to answer well.]";

export function mainChatSystemPromptWhenContextFailed(): string {
  return SYSTEM_PROMPT + MAIN_CHAT_CONTEXT_FAILURE_NOTE;
}
