"use client";

import { createContext, useContext, ReactNode, useState, useCallback } from "react";
import { ArchetypePayload } from "@/packages/organic-ui/src/schemas/archetype";
import { Result } from "@/types";
import { useSharedChatContext } from "./chat-context";
import z from "zod";
import { tool } from "ai";

interface ArchetypeContextValue {
  // Data
  archetypeData: ArchetypePayload | null;
  setArchetypeData: (data: ArchetypePayload | null) => Result<{ success: boolean }>;

  // UI Controls
  showArchetype: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setAndOpen: (data: ArchetypePayload) => Result<{ success: boolean }>;
}

const ArchetypeContext = createContext<ArchetypeContextValue | undefined>(undefined);

/**
 * ArchetypeProvider is the centralized orchestrator for Archetype functionality
 * 
 * @param children - The children to render
 * @returns 
 */
export function ArchetypeProvider({ children }: { children: ReactNode }) {
  const [archetypeData, setArchetypeData] = useState<ArchetypePayload | null>(null);
  const [showArchetype, setShowArchetype] = useState(false);

  const open = useCallback(() => {
    setShowArchetype(true);
  }, [setShowArchetype]);

  const close = useCallback(() => {
    setShowArchetype(false);

  }, [setShowArchetype]);

  const toggle = useCallback(() => {
    setShowArchetype((prev) => !prev);
  }, [setShowArchetype]);

  const setAndOpen = useCallback((data: ArchetypePayload) => {
    setArchetypeData(data);
    open();
    return { data: { success: true }, error: null };
  }, [open, setArchetypeData]);

  const handleSetArchetypeData = useCallback((data: ArchetypePayload | null) => {
    setArchetypeData(data);
    return { data: { success: true }, error: null };
  }, [setArchetypeData]);


  return (
    <ArchetypeContext.Provider value={{
      archetypeData,
      setArchetypeData: handleSetArchetypeData,
      showArchetype,
      open,
      close,
      toggle,
      setAndOpen
    }}
    >
      {children}
    </ArchetypeContext.Provider>
  )

}

export function useArchetypeContext() {
  const context = useContext(ArchetypeContext);
  if (!context) {
    throw new Error("useArchetypeContext must be used within an ArchetypeProvider");
  }
  return context;
}


/**
 * LLM Handles
 */

/**
 * Set the state of the archetype
 */
export const setArchetypeStateTool = tool({
  description: "Open the archetype",
  inputSchema: z.object({
    open: z.boolean().describe("Whether to open the archetype"),
  }),
  execute: () => { }
});

/**
 * View the currently opened Archetype
 */
export const viewArchetypeTool = tool({
  description: "View the currently opened Archetype",
  inputSchema: z.object({}),
  execute: () => { }
});
