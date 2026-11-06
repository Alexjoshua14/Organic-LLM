"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Content the multitask dashboard places directly above CoreInput — the condensed subagent row.
 * The dashboard owns the layout; Chat only renders the slot, so CoreInput keeps its own place.
 */
const MultitaskComposerSlotContext = createContext<{
  slot: ReactNode;
  conversationHidden: boolean;
}>({ slot: null, conversationHidden: false });

export function MultitaskComposerSlotProvider({
  slot,
  conversationHidden = false,
  children,
}: {
  slot: ReactNode;
  conversationHidden?: boolean;
  children: ReactNode;
}) {
  return (
    <MultitaskComposerSlotContext.Provider value={{ slot, conversationHidden }}>
      {children}
    </MultitaskComposerSlotContext.Provider>
  );
}

export function useMultitaskComposerSlot(): ReactNode {
  return useContext(MultitaskComposerSlotContext).slot;
}

export function useMultitaskConversationHidden(): boolean {
  return useContext(MultitaskComposerSlotContext).conversationHidden;
}
