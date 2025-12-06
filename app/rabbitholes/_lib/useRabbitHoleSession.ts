"use client";

import { useState, useTransition, useEffect } from "react";
import {
  RabbitHoleSession,
  RabbitHoleNodeId,
  RabbitHoleSessionSchema,
} from "./types";
import {
  createRabbitHoleSession,
  followRabbitHoleBranch,
  generateQuickPreview,
} from "../actions";
import { saveSession, getSessionById } from "./sessionStorage";

const STORAGE_KEY = "rabbit-hole-session"; // Keep for backward compatibility

function getStoredSession(sessionId?: string): RabbitHoleSession | null {
  if (typeof window === "undefined") return null;

  try {
    // If sessionId is provided, load that specific session
    if (sessionId) {
      return getSessionById(sessionId);
    }

    // Otherwise, try to load the current session (for backward compatibility)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const validated = RabbitHoleSessionSchema.safeParse(parsed);

    if (validated.success) {
      return validated.data;
    }

    // Invalid schema - clear it
    localStorage.removeItem(STORAGE_KEY);
    return null;
  } catch (error) {
    // Handle quota exceeded, disabled, etc.
    console.warn("Failed to read from localStorage:", error);
    return null;
  }
}

function saveSessionToStorage(session: RabbitHoleSession | null): void {
  if (typeof window === "undefined") return;

  try {
    if (session) {
      // Save to new multi-session storage
      saveSession(session);
      // Also save to old key for backward compatibility
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (error) {
    // Handle quota exceeded, disabled, etc.
    console.warn("Failed to save to localStorage:", error);
  }
}

export function useRabbitHoleSession(initialSessionId?: string) {
  const [session, setSession] = useState<RabbitHoleSession | null>(() => {
    // Initialize from localStorage on mount
    return getStoredSession(initialSessionId);
  });
  const [isLoading, setIsLoading] = useState(false);
  const [generatingNodeId, setGeneratingNodeId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Save session to localStorage whenever it changes
  useEffect(() => {
    saveSessionToStorage(session);
  }, [session]);

  async function start(question: string) {
    if (!question.trim()) {
      setError("Please enter a question");
      return;
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    // Generate quick preview first
    generateQuickPreview(question).then((previewResult) => {
      if (previewResult.data) {
        setPreview(previewResult.data);
      }
    });

    startTransition(async () => {
      try {
        const result = await createRabbitHoleSession(question);

        if (result.error) {
          // Clear session on error since we're starting fresh - nothing to show
          setError(result.error.message);
          setSession(null);
          setGeneratingNodeId(null);
          setPreview(null);
        } else if (result.data) {
          setSession(result.data);
          setError(null);
          setGeneratingNodeId(result.data.activeNodeId);
          // Clear preview when full content arrives
          setPreview(null);
        }
      } catch (err) {
        // Clear session on error since we're starting fresh - nothing to show
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setSession(null);
        setGeneratingNodeId(null);
        setPreview(null);
      } finally {
        setIsLoading(false);
        setGeneratingNodeId(null);
      }
    });
  }

  async function followBranch(branchId: string) {
    if (!session) {
      setError("No active session");
      return;
    }

    const activeNode = session.activeNodeId
      ? session.nodesById[session.activeNodeId]
      : null;
    const branch = activeNode?.branchSuggestions.find((b) => b.id === branchId);

    setIsLoading(true);
    setError(null);
    setPreview(null);

    // Generate quick preview first
    if (branch) {
      generateQuickPreview(branch.label, {
        rootQuestion: session.rootQuestion,
        pathHistory: session.path.map((seg) => seg.label).join(" → "),
        branchLabel: branch.label,
      }).then((previewResult) => {
        if (previewResult.data) {
          setPreview(previewResult.data);
        }
      });
    }

    startTransition(async () => {
      try {
        const result = await followRabbitHoleBranch(session, branchId);

        if (result.error) {
          // Preserve session on error so user can see previous content and retry
          setError(result.error.message);
          setGeneratingNodeId(null);
          setPreview(null);
          // Session remains unchanged - user can still navigate existing nodes
        } else if (result.data) {
          setSession(result.data);
          setError(null);
          setGeneratingNodeId(result.data.activeNodeId);
          // Clear preview when full content arrives
          setPreview(null);
        }
      } catch (err) {
        // Preserve session on error so user can see previous content and retry
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
        setGeneratingNodeId(null);
        setPreview(null);
        // Session remains unchanged - user can still navigate existing nodes
      } finally {
        setIsLoading(false);
        setGeneratingNodeId(null);
      }
    });
  }

  function setActiveNode(nodeId: RabbitHoleNodeId) {
    if (!session) return;

    // Allow navigation even during loading - this enables background generation
    if (session.nodesById[nodeId]) {
      setSession({
        ...session,
        activeNodeId: nodeId,
      });
    }
  }

  function reset() {
    setSession(null);
    setError(null);
    setIsLoading(false);
    // localStorage will be cleared by the useEffect above
  }

  return {
    session,
    isLoading: isLoading || isPending,
    generatingNodeId,
    preview,
    error,
    start,
    followBranch,
    setActiveNode,
    reset,
  };
}
