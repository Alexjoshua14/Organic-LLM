"use client";

import {
  RabbitHoleSession,
  RabbitHoleNodeId,
  RabbitHoleSource,
  RabbitHoleSourceAnalysis,
  RabbitHoleNode,
} from "@/lib/schemas/rabbitHoleSchemas";
import { useState, useTransition } from "react";
import { createLogger } from "@/lib/logger";
import { analyzeSource, generateQuickPreview } from "@/app/rabbitholes/actions";
import { generateRabbitHoleNode } from "./actions";
import { Result, SimpleResult } from "@/types";
import { getSessionById, saveSession } from "@/data/supabase/rabbitholes";

const logger = createLogger("useRabbitHoles");

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
  createSession: () => void;
  loadExistingSession: (sessionId: string) => Promise<SimpleResult>;
  exploreQuestion: (question: string, id?: string) => Promise<SimpleResult>;
  followBranch: (branchId: string) => Promise<SimpleResult>;
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
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isGeneratingNode, startTransition] = useTransition();
  const [generatingNodeId, setGeneratingNodeId] =
    useState<RabbitHoleNodeId | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceAnalysis, setSourceAnalysis] =
    useState<RabbitHoleSourceAnalysis | null>(null);
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);

  /**
   * @internal
   * @returns A result object containing a new RabbitHoleSession or an error.
   */
  function newSession(): Result<RabbitHoleSession, Error> {
    try {
      const newSession: RabbitHoleSession = {
        sessionId: globalThis.crypto.randomUUID(),
        rootQuestion: "",
        activeNodeId: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        path: [],
        nodesById: {},
        edges: [],
      };

      return {
        data: newSession,
        error: null,
      };
    } catch (error) {
      logger.error("newSession", "Error creating new session", error);
      return {
        data: null,
        error: error instanceof Error ? error : new Error("Unknown error"),
      };
    }
  }

  /**
   * Creates a new rabbit hole session and updates the session state.
   * If there is an error creating the session, sets the error state accordingly.
   */
  function createSession() {
    const res = newSession();
    if (res.error || !res.data) {
      setError(res.error?.message ?? "Unknown error creating new session");
      return;
    }

    setSession(res.data);
  }

  async function saveSessionToStorage(session: RabbitHoleSession | null) {
    // Null implementation
    setIsSavingSession(true);
    logger.log("saveSession", "Not yet implemented");
    const serilizedSession = JSON.stringify(session);
    const res = await saveSession(serilizedSession);

    if (res.error) {
      logger.error("saveSessionToStorage", "Error saving session", res.error);
      setError(res.error?.message ?? "Unknown error saving session");
    }

    setIsSavingSession(false);
  }

  async function loadExistingSession(sessionId: string): Promise<SimpleResult> {
    setIsLoading(true);
    try {
      const res = await getSessionById(sessionId);
      if (res.error || !res.data) {
        logger.error(
          "loadExistingSession",
          "Error loading existing session",
          res.error,
        );
        setError(res.error?.message ?? "Unknown error loading session");
        return {
          ok: false,
          error: res.error ?? new Error("Unknown error loading session"),
        };
      }

      const session = res.data;
      setSession(session);
      setActiveNodeId(session.activeNodeId ?? session.rootNodeId ?? null);
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
  function createNode(question: string, id?: string): RabbitHoleNode {
    const node: RabbitHoleNode = {
      id: id ?? globalThis.crypto.randomUUID(),
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
   * @returns A Promise that resolves to a SimpleResult:
   *   - { ok: true, error: null } if the exploration was successful
   *   - { ok: false, error: Error } if there was a validation or generation error
   * The result indicates whether the exploration and node creation succeeded or failed,
   * and provides an Error object describing the issue if it failed.
   */
  async function exploreQuestion(
    question: string,
    id?: string,
  ): Promise<SimpleResult> {
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
      let baseSession: RabbitHoleSession;
      /** Create new session if one doesn't exist */
      if (!session) {
        const newSessionResult = await newSession();
        if (newSessionResult.error || !newSessionResult.data) {
          logger.error(
            "exploreQuestion",
            "Error creating new session",
            newSessionResult.error,
          );
          setError(
            newSessionResult.error?.message ??
              "Unknown error creating new session",
          );
          return {
            ok: false,
            error:
              newSessionResult.error ??
              new Error("Unknown error creating new session"),
          };
        }

        baseSession = newSessionResult.data;
      } else {
        baseSession = session;
      }

      /* Create new node for this question */
      const node = createNode(question, id);

      /** Create copy of session object for temporary updates */
      let updatedSession: RabbitHoleSession = {
        ...baseSession,
        rootQuestion:
          baseSession.rootQuestion === "" ? question : baseSession.rootQuestion,
        activeNodeId: node.id,
        updatedAt: new Date().toISOString(),
        nodesById: {
          ...baseSession.nodesById,
          [node.id]: node,
        },
        path: [
          ...baseSession.path,
          {
            nodeId: node.id,
            label: question,
            parentNodeId: baseSession.activeNodeId ?? null,
          },
        ],
      };

      /* Set the generating node ID to the new node ID */
      setGeneratingNodeId(node.id);
      setActiveNodeId(node.id);

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

  async function followBranch(branchId: string): Promise<SimpleResult> {
    if (!session || !activeNodeId) {
      setError("No active session or node");
      return {
        ok: false,
        error: new Error("No active session or node"),
      };
    }

    const activeNode = session.nodesById[activeNodeId];
    if (!activeNode) {
      setError("No active node");
      return {
        ok: false,
        error: new Error("No active node"),
      };
    }

    const branch = activeNode.branchSuggestions?.find((b) => b.id === branchId);
    if (!branch) {
      setError("Branch not found");
      return {
        ok: false,
        error: new Error("Branch not found"),
      };
    }

    if (session.nodesById[branchId]) {
      setActiveNodeId(branchId);
      return {
        ok: true,
        error: null,
      };
    }

    // Rely on main generation function, providing branchId for
    // proper linking
    return await exploreQuestion(branch.label, branchId);
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
    updateSourceStatus("pending", undefined, source.id);
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
        updateSourceStatus("complete", result.data, source.id);
        setSourceAnalysis(result.data);
      } catch (error) {
        logger.error("selectSource", "Error analyzing source", error);
        const errorMessage =
          error instanceof Error ? error.message : "Error analyzing source";
        setError(errorMessage);
        updateSourceStatus("error", undefined, source.id);
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
    sourceId?: string | null,
  ) => {
    if (!session || !activeNodeId) return;
    if (!sourceId) sourceId = selectedSourceId;

    setSession((prevSession) => {
      if (!prevSession || !activeNodeId) return prevSession;

      const node = prevSession.nodesById[activeNodeId];
      if (!node) return prevSession;

      const updatedSources =
        node.sources?.map((s) =>
          s.id === sourceId
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
    createSession,
    loadExistingSession,
    exploreQuestion,
    followBranch,
    selectSource,
    clearSourceSelection,
    resetSourceAnalysisState,
    setActiveNode,
    reset,
    saveSessionToStorage,
  };
}
