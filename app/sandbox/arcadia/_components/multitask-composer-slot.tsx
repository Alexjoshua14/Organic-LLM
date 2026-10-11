"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Content the multitask dashboard places directly above CoreInput — the condensed subagent row.
 * The dashboard owns the layout; Chat only renders the slot, so CoreInput keeps its own place.
 */
const MultitaskComposerSlotContext = createContext<ReactNode>(null);

export function MultitaskComposerSlotProvider({
  slot,
  children,
}: {
  slot: ReactNode;
  children: ReactNode;
}) {
  return (
    <MultitaskComposerSlotContext.Provider value={slot}>
      {children}
    </MultitaskComposerSlotContext.Provider>
  );
}

export function useMultitaskComposerSlot(): ReactNode {
  return useContext(MultitaskComposerSlotContext);
}
