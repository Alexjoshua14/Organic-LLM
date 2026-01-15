'use client';
/**
 * Creates context for sharing current Session ID
 * 
 */

import { RabbitHoleSessionMetadata } from "@/app/rabbitholes/_lib/sessionStorage";
import { RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";
import { createContext, Dispatch, SetStateAction, useState } from "react";

interface RabbitHoleContextValue {
  sessionId: string | null;
  setSessionId: (sessionId: string | null) => void;
  sessions: RabbitHoleSessionMetadata[];
  setSessions: Dispatch<SetStateAction<RabbitHoleSessionMetadata[]>>
  session: RabbitHoleSession | null;
  setSession: Dispatch<SetStateAction<RabbitHoleSession | null>>
  isLoading: boolean;
  setIsLoading: Dispatch<SetStateAction<boolean>>
  generatingNodeId: string | null;
  setGeneratingNodeId: Dispatch<SetStateAction<string | null>>
  clearSession: () => void;
}

export const RabbitHoleContext = createContext<RabbitHoleContextValue>({
  sessionId: null,
  setSessionId: () => { },
  sessions: [],
  setSessions: () => { },
  session: null,
  setSession: () => { },
  isLoading: false,
  setIsLoading: () => { },
  generatingNodeId: null,
  setGeneratingNodeId: () => { },
  clearSession: () => { }
});

/**
 * RabbitHoleProvider is the centralized orchestrator for Rabbit Hole functionality
 * 
 * @param children - The children to render
 * @returns 
 */
export function RabbitHoleProvider({ children }: { children: React.ReactNode }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RabbitHoleSessionMetadata[]>([]);
  const [session, setSession] = useState<RabbitHoleSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);

  function clearSession() {
    setSessionId(null);
    setSession(null);
    setGeneratingNodeId(null);
    setIsLoading(false);
  }

  return (
    <RabbitHoleContext.Provider
      value={{
        sessionId,
        setSessionId,
        sessions,
        setSessions,
        session,
        setSession,
        isLoading,
        setIsLoading,
        generatingNodeId,
        setGeneratingNodeId,
        clearSession
      }}>
      {children}
    </RabbitHoleContext.Provider>
  );
}