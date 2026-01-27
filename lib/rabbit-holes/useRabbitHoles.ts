"use client";

import {
  RabbitHoleSession,
  RabbitHoleNodeId,
  RabbitHoleSource,
  RabbitHoleSourceAnalysis,
  RabbitHoleNode,
} from "@/lib/schemas/rabbitHoleSchemas";
import { randomUUID } from "crypto";
import { useEffect, useState, useTransition } from "react";
import { createLogger } from "@/lib/logger";
import { analyzeSource, generateQuickPreview } from "@/app/rabbitholes/actions";
import { generateRabbitHoleNode } from "./actions";
import { SimpleResult } from "@/types";

const logger = createLogger("useRabbitHoles");

/**
 * Retrieves a stored rabbit hole session by ID or from localStorage
 * @param sessionId - Optional session ID to load a specific session
 * @returns The session if found, null otherwise
 */
async function getStoredSession(
  sessionId?: string,
): Promise<RabbitHoleSession | null> {
  // Null implementation for temporary
  return null;
}

/**
 * Saves a rabbit hole session to storage
 * @param session - The session to save, or null to clear
 * @returns Promise that resolves when save is complete
 */
async function saveSessionToStorage(
  session: RabbitHoleSession | null,
): Promise<void> {
  // Null implementation for temporary
  return;
}

/**
 * Hook return type for useRabbitHoles
 */
export interface UseRabbitHolesReturn {
  session: RabbitHoleSession | null;
  isLoading: boolean;
  isGeneratingNode: boolean;
  generatingNodeId: RabbitHoleNodeId | null;
  preview: string | null;
  error: string | null;
  selectedSourceId: string | null;
  sourceAnalysis: RabbitHoleSourceAnalysis | null;
  isAnalyzingSource: boolean;
  newSession: () => void;
  loadExistingSession: (sessionId: string) => SimpleResult;
  exploreQuestion: (question: string) => Promise<SimpleResult>;
  selectSource: (source: RabbitHoleSource) => Promise<void>;
  clearSourceSelection: () => void;
  resetSourceAnalysisState: () => void;
  setActiveNode: (nodeId: RabbitHoleNodeId) => void;
  reset: () => void;
  saveSessionToStorage: (session: RabbitHoleSession | null) => Promise<void>;
}

/**
 * Main hook for managing rabbit hole sessions
 * @returns Object containing session state and control functions
 */
export function useRabbitHoles(): UseRabbitHolesReturn {
  const [session, setSession] = useState<RabbitHoleSession | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<RabbitHoleNodeId | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isGeneratingNode, startTransition] = useTransition();
  const [generatingNodeId, setGeneratingNodeId] =
    useState<RabbitHoleNodeId | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceAnalysis, setSourceAnalysis] =
    useState<RabbitHoleSourceAnalysis | null>(null);
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);

  function newSession() {
    setIsLoading(true);

    try {
      const newSession: RabbitHoleSession = {
        sessionId: randomUUID(),
        rootQuestion: "",
        activeNodeId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        path: [],
        nodesById: {},
        edges: [],
      };

      setSession(newSession);
    } catch (error) {
      logger.error("newSession", "Error creating new session", error);
    } finally {
      setIsLoading(false);
    }
  }

  function loadExistingSession(sessionId: string): SimpleResult {
    setIsLoading(true);
    try {
      const session = getStoredSession(sessionId);
      return {
        ok: true,
        error: null,
      };
    } catch (error) {
      logger.error(
        "loadExistingSession",
        "Error loading existing session",
        error,
      );
      setError(
        error instanceof Error
          ? error.message
          : "Unknown loading session error",
      );
      return {
        ok: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * @internal
   * Creates a new RabbitHoleNode object from a given question string.
   * Initializes all fields required for a new node in the session graph.
   *
   * @param question - The user's question for the node
   * @returns A fully constructed RabbitHoleNode object
   */
  function createNode(question: string): RabbitHoleNode {
    const node: RabbitHoleNode = {
      id: randomUUID(),
      rawPrompt: question,
      userQuestion: question,
      createdAt: new Date().toISOString(),
      sources: [],
      branchSuggestions: [],
      keyTakeaways: [],
      articleHtml: "",
      preview: null,
    };

    return node;
  }

  /**
   * Main entry point for exploring a question in Rabbit Holes.
   * Handles validation, session management, optimistic node creation,
   * preview generation, and state updates.
   * @param question The question string to explore.
   /**
    * @returns A Promise that resolves to a SimpleResult:
    *   - { ok: true, error: null } if the exploration was successful
    *   - { ok: false, error: Error } if there was a validation or generation error
    * The result indicates whether the exploration and node creation succeeded or failed,
    * and provides an Error object describing the issue if it failed.
    */
  async function exploreQuestion(question: string): Promise<SimpleResult> {
    if (!question.trim()) {
      setError("Please enter a question");
      return {
        ok: false,
        error: new Error("Please enter a question"),
      };
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      /** Create new session if one doesn't exist */
      if (!session) {
        newSession();
      }

      /** If session is still not found, throw an error */
      if (!session) {
        throw new Error("Session not found");
      }

      /** Create copy of session object for temporary updates */
      let updatedSession: RabbitHoleSession = { ...session };

      /* If no root question, set it to the new question */
      if (session.rootQuestion === "") {
        updatedSession.rootQuestion = question;
      }

      /* Create new node for this question */
      const node = createNode(question);

      /* Add new node to session */
      updatedSession.nodesById[node.id] = node;
      const previousNode = session.activeNodeId; // TODO: Consider making this decoupled from active state
      updatedSession.activeNodeId = node.id;

      updatedSession.path.push({
        nodeId: node.id,
        label: question,
        parentNodeId: previousNode ?? null,
      });

      /* Set the generating node ID to the new node ID */
      setGeneratingNodeId(node.id);

      /* Generate quick preview of the new node */
      const quickPreview = await generateQuickPreview(question);

      // On preview error, continue node creation but inform user via error message
      if (quickPreview.error) {
        logger.error(
          "exploreQuestion",
          "Error generating quick preview",
          quickPreview.error,
        );
        setError(quickPreview.error.message);
        setPreview("Unable to generate preview");
      } else {
        /* Update the new node with the preview data
         * and set the preview object for quick UI feedback
         */
        updatedSession.nodesById[node.id].preview = quickPreview.data;
        setPreview(quickPreview.data);
      }

      /*
       *
       *  Perform heavy work of generating actual node content now
       * Using startTransition to avoid blocking main processes
       *
       */

      startTransition(async () => {
        try {
          const result = await generateRabbitHoleNode(updatedSession, node.id);

          if (result.error || result.data === null) {
            logger.error(
              "exploreQuestion",
              "Error generating rabbit hole node",
              result.error,
            );
            setError(result.error?.message ?? "Unknown generation error");
            return;
          }
          updatedSession = result.data;

          setSession(updatedSession);
        } catch (error) {
          logger.error(
            "exploreQuestion",
            "Error generating rabbit hole node",
            error,
          );
          setError(
            error instanceof Error ? error.message : "Unknown generation error",
          );
          return;
        } finally {
          setGeneratingNodeId(null);
          setPreview(null);
        }
      });

      setSession(updatedSession);
      return {
        ok: true,
        error: null,
      };
    } catch (error) {
      logger.error("exploreQuestion", "Error exploring question", error);
      setError(
        error instanceof Error ? error.message : "Unknown exploration error",
      );
      return {
        ok: false,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    } finally {
      setIsLoading(false);
    }
  }

  async function followBranch(branchId: string) {
    logger.log("followBranch", "Not yet implemented");
    return;
  }

  async function selectSource(source: RabbitHoleSource) {
    logger.log("selectSource", "Not yet implemented");
    setSelectedSourceId(source.id);

    if (source.status === "complete" && source.analysis) {
      setSourceAnalysis(source.analysis);
      return;
    }

    if (source.status === "pending") {
      return;
    }

    if (source.status === "error") {
      logger.error("selectSource", "Source analysis error", source);
      setError("Error analyzing source");
      return;
    }

    // Immediately mark as pending (non-blocking, synchronous update)
    updateSourceStatus("pending");
    setIsAnalyzingSource(true);
    setSourceAnalysis(null);

    // Wrap heavy async work in transition to keep UI responsive
    startTransition(async () => {
      try {
        const result = await analyzeSource(source.url, source.title);

        if (result.error || !result.data) {
          logger.error("selectSource", "Error analyzing source", result.error);
          throw result.error ?? new Error("Error analyzing source");
        }

        // Update to complete with analysis
        updateSourceStatus("complete", result.data);
        setSourceAnalysis(result.data);
      } catch (error) {
        logger.error("selectSource", "Error analyzing source", error);
        const errorMessage =
          error instanceof Error ? error.message : "Error analyzing source";
        setError(errorMessage);
        updateSourceStatus("error");
      } finally {
        setIsAnalyzingSource(false);
      }
    });
  }

  /**
   * @internal
   * Updates the status (and optionally the analysis) of the currently selected source
   * for the active node in the session. Used when analysis of a source is pending,
   * completed, or errored.
   *
   * @param status - The new status of the source ("pending", "complete", or "error").
   * @param analysis - Optional updated analysis object to attach to the source.
   */
  const updateSourceStatus = (
    status: "pending" | "complete" | "error",
    analysis?: RabbitHoleSourceAnalysis,
  ) => {
    if (!session || !activeNodeId) return;

    setSession((prevSession) => {
      if (!prevSession || !activeNodeId) return prevSession;

      const node = prevSession.nodesById[activeNodeId];
      if (!node) return prevSession;

      const updatedSources =
        node.sources?.map((s) =>
          s.id === selectedSourceId
            ? { ...s, status, ...(analysis && { analysis }) }
            : s,
        ) ?? [];

      return {
        ...prevSession,
        nodesById: {
          ...prevSession.nodesById,
          [activeNodeId]: {
            ...node,
            sources: updatedSources,
          },
        },
      };
    });
  };

  function clearSourceSelection() {
    logger.log("clearSourceSelection", "Not yet implemented");
    setSelectedSourceId(null);
    setIsAnalyzingSource(false);
    return;
  }

  function resetSourceAnalysisState() {
    logger.log("resetSourceAnalysisState", "Not yet implemented");
    return;
  }

  function setActiveNode(nodeId: RabbitHoleNodeId) {
    logger.log("setActiveNode", "Not yet implemented");
    return;
  }

  function reset() {
    logger.log("reset", "Resetting session");
    setSession(null);
    setError(null);
    setIsLoading(false);
    setGeneratingNodeId(null);
    setPreview(null);
    setSelectedSourceId(null);
    setSourceAnalysis(null);
    setIsAnalyzingSource(false);
    return;
  }

  async function saveSessionToStorage(session: RabbitHoleSession | null) {
    // Null implementation
    logger.log("saveSessionToStorage", "Not yet implemented");
    return;
  }

  // Null implementation for temporary (all methods do nothing or return null/defaults)
  return {
    session: session,
    isLoading: isLoading,
    isGeneratingNode: isGeneratingNode,
    generatingNodeId: generatingNodeId,
    preview: preview,
    error: error,
    selectedSourceId: selectedSourceId,
    sourceAnalysis: sourceAnalysis,
    isAnalyzingSource: isAnalyzingSource,
    newSession,
    loadExistingSession,
    exploreQuestion,
    selectSource,
    clearSourceSelection,
    resetSourceAnalysisState,
    setActiveNode,
    reset,
    saveSessionToStorage,
  };
}

/**
 * Starts a new rabbit hole session with a question
 * @param question - The initial question to explore
 * @returns Promise that resolves when the session is created
 */
async function start(question: string): Promise<void> {
  // Null implementation for temporary
  return;
}

/**
 * Follows a branch suggestion to explore a new direction
 * @param branchId - The ID of the branch to follow
 * @returns Promise that resolves when the branch is explored
 */
async function followBranch(branchId: string): Promise<void> {
  // Null implementation for temporary
  return;
}

/**
 * Selects and analyzes a source from the current node
 * @param source - The source to analyze
 * @returns Promise that resolves when analysis is complete
 */
async function selectSource(source: RabbitHoleSource): Promise<void> {
  // Null implementation for temporary
  return;
}

/**
 * Clears the currently selected source and its analysis
 */
function clearSourceSelection(): void {
  // Null implementation for temporary
  return;
}

/**
 * Resets all source analysis state including cache
 */
function resetSourceAnalysisState(): void {
  // Null implementation for temporary
  return;
}

/**
 * Sets the active node in the session
 * @param nodeId - The ID of the node to activate
 */
function setActiveNode(nodeId: RabbitHoleNodeId): void {
  // Null implementation for temporary
  return;
}

/**
 * Resets the entire session and clears all state
 */
function reset(): void {
  // Null implementation for temporary
  return;
}
