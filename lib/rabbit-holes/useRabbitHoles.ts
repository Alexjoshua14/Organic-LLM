"use client";

import { useCallback, useContext, useEffect, useState, useTransition } from "react";

import { RabbitHoleContext } from "../context/rabbithole-context";

import { analyzeSource, generateQuickPreview } from "./actions";
import { RABBIT_HOLE_UNTITLED } from "./constants";

import {
  RabbitHoleSession,
  RabbitHoleNodeId,
  RabbitHoleSource,
  RabbitHoleSourceAnalysis,
  RabbitHoleNode,
} from "@/lib/schemas/rabbitHoleSchemas";
import { useGenerationCompletion } from "@/lib/rabbit-holes/useGenerationCompletion";
import { createLogger } from "@/lib/logger";
import { Result, SimpleResult } from "@/types";
import { getSessionById, saveSession } from "@/data/supabase/rabbitholes";
import { clientRandomUUID } from "@/lib/client-uuid";

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
  const [activeNodeId, setActiveNodeId] = useState<RabbitHoleNodeId | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSavingSession, setIsSavingSession] = useState(false);
  const [isGeneratingNode, startTransition] = useTransition();
  const [generatingNodeId, setGeneratingNodeId] = useState<RabbitHoleNodeId | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceAnalysis, setSourceAnalysis] = useState<RabbitHoleSourceAnalysis | null>(null);
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);

  const { session: ctxSession, setSession: setCtxSession } = useContext(RabbitHoleContext);

  useEffect(() => {
    // Keep context in sync
    if (session && session.sessionId !== ctxSession?.sessionId) {
      setCtxSession(session);
    }
  }, [session]);

  const handleGenerationComplete = useCallback((updated: RabbitHoleSession) => {
    setSession(updated);
    setGeneratingNodeId(null);
    setPreview(null);
  }, []);

  useGenerationCompletion(
    session?.sessionId ?? null,
    session?.generatingNodeId ?? null,
    handleGenerationComplete
  );

  /**
   * @internal
   * @returns A result object containing a new RabbitHoleSession or an error.
   */
  function newSession(): Result<RabbitHoleSession, Error> {
    try {
      const newSession: RabbitHoleSession = {
        sessionId: clientRandomUUID(),
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
    setIsSavingSession(true);
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
        logger.error("loadExistingSession", "Error loading existing session", res.error);
        setError(res.error?.message ?? "Unknown error loading session");

        return {
          ok: false,
          error: res.error ?? new Error("Unknown error loading session"),
        };
      }

      const session = res.data;

      setSession(session);
      setActiveNodeId(session.activeNodeId ?? session.rootNodeId ?? null);
      // If a node is still generating, restore generating state + preview from the session
      if (session.generatingNodeId) {
        setGeneratingNodeId(session.generatingNodeId);
        const generatingNode = session.nodesById[session.generatingNodeId];

        if (generatingNode && generatingNode.preview) {
          setPreview(generatingNode.preview);
        }
      }

      return {
        ok: true,
        error: null,
      };
    } catch (error) {
      logger.error("loadExistingSession", "Error loading existing session", error);
      setError(error instanceof Error ? error.message : "Unknown loading session error");

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
      id: id ?? clientRandomUUID(),
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
  async function exploreQuestion(question: string, id?: string): Promise<SimpleResult> {
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
          logger.error("exploreQuestion", "Error creating new session", newSessionResult.error);
          setError(newSessionResult.error?.message ?? "Unknown error creating new session");

          return {
            ok: false,
            error: newSessionResult.error ?? new Error("Unknown error creating new session"),
          };
        }

        baseSession = newSessionResult.data;
      } else {
        baseSession = session;
      }

      /* Create new node for this question */
      const node = createNode(question, id);

      /* Check if this is the root node */
      const isFirstNode = !baseSession.rootNodeId && baseSession.path.length === 0;

      /** Create copy of session object for temporary updates */
      let updatedSession: RabbitHoleSession = {
        ...baseSession,
        rootQuestion: baseSession.rootQuestion === "" ? question : baseSession.rootQuestion,
        rootNodeId: isFirstNode ? node.id : baseSession.rootNodeId,
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
            label: RABBIT_HOLE_UNTITLED,
            parentNodeId: baseSession.activeNodeId ?? null,
          },
        ],
      };

      setGeneratingNodeId(node.id);
      setActiveNodeId(node.id);
      setSession(updatedSession);

      /* First save on send: call generate API before preview so server persists session and kicks off orchestrator. */
      const res = await fetch(`/api/rabbitholes/${baseSession.sessionId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId: node.id,
          session: JSON.stringify(updatedSession),
        }),
      });

      if (res.status === 202) {
        const json = (await res.json()) as {
          jobId: string;
          sessionId: string;
          nodeId: string;
        };

        setSession({
          ...updatedSession,
          generatingNodeId: json.nodeId,
          generationStep: "sources",
        });
        /* Preview in parallel after 202 so UI can show it without blocking first save. */
        generateQuickPreview(question).then((quickPreview) => {
          if (quickPreview.error) {
            logger.error("exploreQuestion", "Error generating quick preview", quickPreview.error);
            setError(quickPreview.error.message);
            setPreview("Unable to generate preview");

            return;
          }

          if (quickPreview.data) {
            setPreview(quickPreview.data);

            // Persist preview on the generating node so it survives refresh.
            setSession((prev) => {
              if (!prev || !prev.generatingNodeId) return prev;
              const node = prev.nodesById[prev.generatingNodeId];

              if (!node) return prev;

              const updatedNode: RabbitHoleNode = {
                ...node,
                preview: quickPreview.data,
              };
              const updatedSession: RabbitHoleSession = {
                ...prev,
                nodesById: {
                  ...prev.nodesById,
                  [updatedNode.id]: updatedNode,
                },
              };

              // Fire-and-forget save; errors will surface via logger in saveSessionToStorage.
              void saveSessionToStorage(updatedSession);

              return updatedSession;
            });
          }
        });
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };

        setError(body?.error ?? `Request failed (${res.status})`);
        setGeneratingNodeId(null);
        setPreview(null);
      }

      return {
        ok: true,
        error: null,
      };
    } catch (error) {
      logger.error("exploreQuestion", "Error exploring question", error);
      setError(error instanceof Error ? error.message : "Unknown exploration error");

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
    logger.log("followBranch", "Following branch:\n", JSON.stringify(branch, null, 2));

    return await exploreQuestion(branch.label, branchId);
  }

  async function selectSource(source: RabbitHoleSource) {
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
        const errorMessage = error instanceof Error ? error.message : "Error analyzing source";

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
    sourceId?: string | null
  ) => {
    if (!session || !activeNodeId) return;
    if (!sourceId) sourceId = selectedSourceId;

    setSession((prevSession) => {
      if (!prevSession || !activeNodeId) return prevSession;

      const node = prevSession.nodesById[activeNodeId];

      if (!node) return prevSession;

      const updatedSources =
        node.sources?.map((s) =>
          s.id === sourceId ? { ...s, status, ...(analysis && { analysis }) } : s
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
    logger.log("clearSourceSelection", "Not yet fully implemented");
    setSelectedSourceId(null);
    setIsAnalyzingSource(false);

    return;
  }

  function resetSourceAnalysisState() {
    logger.log("resetSourceAnalysisState", "Not yet implemented");

    return;
  }

  function setActiveNode(nodeId: RabbitHoleNodeId) {
    /** Don't allow setting any arbitrary node as active */
    if (!session?.nodesById[nodeId]) {
      logger.error("setActiveNode", "Node not found", nodeId);
      setError("Node not found");

      return;
    }

    /** Skip updates when node is already active */
    if (nodeId === activeNodeId) {
      logger.log("setActiveNode", "Node is already active", nodeId);

      return;
    }

    setActiveNodeId(nodeId);
    setSession((prevSession) => {
      if (!prevSession) return prevSession;

      return {
        ...prevSession,
        activeNodeId: nodeId,
      };
    });
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
