"use client";

import { createPersistentStore } from "@/lib/client-store/persistent-store";
import { DEFAULT_CHAT_STYLE, type ChatStyle } from "@/lib/chat/chat-style";

type ChatStyleStoreState = Record<string, ChatStyle>;

const store = createPersistentStore<ChatStyleStoreState>("organic-llm.chat-style.v1", {});

/** Read the selected style for a thread (synchronous; for request assembly). */
export function getChatStyle(threadId: string): ChatStyle {
  if (!threadId) return DEFAULT_CHAT_STYLE;

  return store.getState()[threadId] ?? DEFAULT_CHAT_STYLE;
}

export function setChatStyle(threadId: string, style: ChatStyle): void {
  if (!threadId) return;
  store.setState((prev) => ({ ...prev, [threadId]: style }));
}

/** React hook: subscribe to a thread's selected style. */
export function useChatStyle(threadId: string): ChatStyle {
  return store.useStore((s) => s[threadId] ?? DEFAULT_CHAT_STYLE);
}
