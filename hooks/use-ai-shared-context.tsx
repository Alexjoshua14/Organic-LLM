import React, { createContext, useContext, useState } from "react";
import { invokeAIServerAction } from "@/app/actions/ai-jobs";
import { AIServerFunction } from "@/lib/schemas/ai-jobs";
import { Result } from "@/types";

type SharedAIContextType = {
  userMessage: string;
  setUserMessage: (msg: string) => void;
  aiResponse: string;
  setAIResponse: (msg: string) => void;
  loading: boolean;
  setLoading: (val: boolean) => void;
  latestJobId: string | null;
  setLatestJobId: (jobId: string | null) => void;
  invokeAI: (
    functionName: AIServerFunction,
    parameters?: Record<string, unknown>,
    priority?: number
  ) => Promise<Result<{ jobId: string }>>;
};

const SharedAIContext = createContext<SharedAIContextType | undefined>(undefined);

export const SharedAIProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [userMessage, setUserMessage] = useState("");
  const [aiResponse, setAIResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [latestJobId, setLatestJobId] = useState<string | null>(null);

  /**
   * Invoke an AI server function and add it to the job queue
   * The job will run on the server even if the user disconnects
   * Automatically updates latestJobId when a job is successfully created
   * 
   * @param functionName - The AI server function to invoke (from enum)
   * @param parameters - Optional parameters for the function
   * @param priority - Job priority (1-5, default 3)
   * @returns Result containing the job ID or error
   */
  const invokeAI = async (
    functionName: AIServerFunction,
    parameters?: Record<string, unknown>,
    priority: number = 3
  ): Promise<Result<{ jobId: string }>> => {
    const result = await invokeAIServerAction(functionName, parameters, priority);

    // Update latestJobId if job was successfully created
    if (result.data?.jobId) {
      setLatestJobId(result.data.jobId);
    }

    return result;
  };

  return (
    <SharedAIContext.Provider
      value={{
        userMessage,
        setUserMessage,
        aiResponse,
        setAIResponse,
        loading,
        setLoading,
        latestJobId,
        setLatestJobId,
        invokeAI,
      }}
    >
      {children}
    </SharedAIContext.Provider>
  );
};

// Hook to use SharedAIContext
export function useSharedAIContext() {
  const context = useContext(SharedAIContext);
  if (!context) {
    throw new Error("useSharedAIContext must be used within a SharedAIProvider");
  }
  return context;
}
