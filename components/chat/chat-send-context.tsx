"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

type ChatSendContextValue = {
  /** Send a plain-text user message into the owning chat (e.g. Stratum form answers). */
  sendText: (text: string) => void;
};

const ChatSendContext = createContext<ChatSendContextValue | null>(null);

/**
 * Exposes the chat's `sendMessage` to interactive tool-result components rendered
 * deep inside the thread (forms that submit answers as a user message), without
 * threading the callback through every memoized message component.
 */
export function ChatSendProvider({
  sendText,
  children,
}: {
  sendText: (text: string) => void;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ sendText }), [sendText]);

  return <ChatSendContext.Provider value={value}>{children}</ChatSendContext.Provider>;
}

/** Null when the surface didn't provide a sender — components should degrade gracefully. */
export function useChatSend(): ChatSendContextValue | null {
  return useContext(ChatSendContext);
}
