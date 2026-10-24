"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ChatSettingsExpandContextValue = {
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  toggleExpanded: (id: string) => void;
};

const ChatSettingsExpandContext = createContext<ChatSettingsExpandContextValue | null>(null);

export function ChatSettingsExpandProvider({ children }: { children: ReactNode }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const toggleExpanded = useCallback((id: string) => {
    setExpandedId((cur) => (cur === id ? null : id));
  }, []);

  const value = useMemo(
    () => ({ expandedId, setExpandedId, toggleExpanded }),
    [expandedId, toggleExpanded]
  );

  return (
    <ChatSettingsExpandContext.Provider value={value}>
      {children}
    </ChatSettingsExpandContext.Provider>
  );
}

export function useChatSettingsExpand(): ChatSettingsExpandContextValue {
  const ctx = useContext(ChatSettingsExpandContext);

  if (!ctx) {
    throw new Error("useChatSettingsExpand must be used within ChatSettingsExpandProvider");
  }

  return ctx;
}
