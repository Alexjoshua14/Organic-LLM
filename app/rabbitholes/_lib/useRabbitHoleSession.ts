"use client";

/**
 * @deprecated The Rabbit Hole client hook has moved to `lib/rabbit-holes/useRabbitHoles.ts`.
 * This file is kept temporarily for backward compatibility while UI imports are migrated.
 *
 * Prefer:
 * - `lib/rabbit-holes/useRabbitHoles.ts` for the client hook
 * - `lib/rabbit-holes/actions.ts` for server-side Rabbit Hole actions
 */

import { useState, useTransition, useEffect, useContext } from "react";
import {
  RabbitHoleSession,
  RabbitHoleNodeId,
  RabbitHoleSessionSchema,
  RabbitHoleSource,
  RabbitHoleSourceAnalysis,
} from "@/lib/schemas/rabbitHoleSchemas";
import {
  createRabbitHoleSession,
  followRabbitHoleBranch,
  generateQuickPreview,
  analyzeSource,
} from "../actions";
import { migrateSession } from "./sessionStorage";
import { saveSession, getSessionById } from "@/data/supabase/rabbitholes";
import { createLogger } from "@/lib/logger";
import { cleanupOldAudio } from "./audioStorage";
import { RabbitHoleContext } from "@/lib/context/rabbithole-context";

const logger = createLogger("useRabbitHoleSession");

const STORAGE_KEY = "rabbit-hole-session"; // Keep for backward compatibility

/**
 * @deprecated Legacy storage helper for the old `app/rabbitholes/*` implementation.
 */
async function getStoredSession(
  sessionId?: string
): Promise<RabbitHoleSession | null> {
  if (typeof window === "undefined") return null;

  try {
    // If sessionId is provided, load that specific session
    if (sessionId) {
      const res = await getSessionById(sessionId);
      if (res.data) {
        return res.data;
      } else {
        return null;
      }
    }

    // Otherwise, try to load the current session (for backward compatibility)
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    const migrated = migrateSession(parsed);

    if (migrated) {
      return migrated;
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

/**
 * @deprecated Legacy persistence helper for the old `app/rabbitholes/*` implementation.
 */
async function saveSessionToStorage(
  session: RabbitHoleSession | null
): Promise<void> {
  try {
    if (!session) {
      logger.log(
        "saveSessionToStorage",
        "No session provided to saveSessionToStorage; skipping save."
      );
      // localStorage.removeItem(STORAGE_KEY); // TODO: Check whether this should be here
      return;
    }

    // Avoid persisting optimistic/pending nodes to storage
    const hasPending = session.path.some(
      (seg) =>
        typeof seg.nodeId === "string" && seg.nodeId.startsWith("pending-")
    );
    if (hasPending) {
      logger.log(
        "saveSessionToStorage",
        `Session ${session.sessionId} has pending nodes; skipping save to storage.`
      );
      return;
    }

    logger.log(
      "saveSessionToStorage",
      "Serializing session for transmission to server side.."
    );

    const serialized = JSON.stringify(session);
    logger.log("saveSessionToStorage", `Serialized session.`);

    logger.log(
      "saveSessionToStorage",
      `Saving session with ID ${session.sessionId} to storage...`
    );
    const res = await saveSession(serialized);
    logger.log(
      "saveSessionToStorage",
      `Session save result: ${JSON.stringify(res, null, 2)}`
    );
  } catch (error) {
    // Handle quota exceeded, disabled, etc.
    logger.warn("saveSessionToStorage", `Failed to save to Database: ${error}`);
  }
}

/**
 * @deprecated Use `useRabbitHoles` from `lib/rabbit-holes/useRabbitHoles.ts`.
 */
export function useRabbitHoleSession() {
  const {
    sessionId,
    session,
    setSession,
    clearSession,
    isLoading,
    setIsLoading,
    generatingNodeId,
    setGeneratingNodeId,
  } = useContext(RabbitHoleContext);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceAnalysis, setSourceAnalysis] =
    useState<RabbitHoleSourceAnalysis | null>(null);
  const [sourceAnalysisCache, setSourceAnalysisCache] = useState<
    Record<string, RabbitHoleSourceAnalysis>
  >({});
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Save session to localStorage whenever it changes
  useEffect(() => {
    console.log("Saving session");
    saveSessionToStorage(session);
  }, [session]);

  useEffect(() => {
    if (sessionId && (session === null || sessionId !== session.sessionId)) {
      clearSession();
      setIsLoading(true);
      const retrieveSession = async () => {
        const res = await getStoredSession(sessionId);
        if (res) {
          setSession(res);
        } else {
          logger.error("useRabbitHoleSession", "New session detected");
          setSession({
            sessionId: sessionId,
            rootQuestion: "",
            activeNodeId: null,
            nodesById: {},
            edges: [],
            path: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        setIsLoading(false);
      };

      retrieveSession();
    } else {
      if (!sessionId) {
        logger.log("useRabbitHoleSession", "No session ID provided");
      } else {
        logger.log("useRabbitHoleSession", "Session is already loaded");
      }
    }
  }, [sessionId]);

  // Cleanup old audio on mount
  useEffect(() => {
    logger.log("useRabbitHoleSession", "Cleaning up old audio...");
    cleanupOldAudio();
  }, []);

  /**
   * Handles search for new question
   *
   * Structure to be implemented:
   * 1. Validate question
   * 2.
   *  a. Create new root node
   *  b. Generate quick preview
   * 3. Start server job to generate full node data
   *      Server job should create a new node first so that if user clicks away
   *       when they return they either see that the data is still loading or full response.
   *
   * Note subitems should happen in parallel
   *
   * @param question
   * @returns
   */
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
      if (previewResult.error || previewResult.data === null) {
        logger.error(
          "start",
          `Issue generating quick preview: ${JSON.stringify(previewResult.error, null, 2)}`
        );
        return;
      }
      setPreview(previewResult.data);
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
      } finally {
        setIsLoading(false);
        setGeneratingNodeId(null);
        setPreview(null);
      }
    });
  }

  async function selectSource(source: RabbitHoleSource) {
    setSelectedSourceId(source.id);

    // If cached, use immediately
    if (sourceAnalysisCache[source.id]) {
      setSourceAnalysis(sourceAnalysisCache[source.id]);
      return;
    }

    setIsAnalyzingSource(true);
    setSourceAnalysis(null);

    try {
      setPreview(`Analyzing the following source, ${source.title}..`);

      const result = await analyzeSource(
        source.url,
        source.title,
        source.snippet ?? undefined
      );
      if (result.error || !result.data) {
        logger.error(
          "selectSource",
          `Error analyzing source ${source.id}: ${result.error?.message ?? "unknown"}`
        );
        setSelectedSourceId(null);
      } else {
        setSourceAnalysis(result.data);
        setSourceAnalysisCache((prev) => ({
          ...prev,
          [source.id]: result.data!,
        }));
      }
    } catch (err) {
      logger.error(
        "selectSource",
        `Unexpected error analyzing source ${source.id}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      setSelectedSourceId(null);
    } finally {
      setIsAnalyzingSource(false);
    }
  }

  function clearSourceSelection() {
    setSelectedSourceId(null);
    setSourceAnalysis(null);
  }

  function resetSourceAnalysisState() {
    setSelectedSourceId(null);
    setSourceAnalysis(null);
    setSourceAnalysisCache({});
    setIsAnalyzingSource(false);
  }

  async function followBranch(branchId: string) {
    if (!session) {
      setError("No active session");
      return;
    }

    const previousSession = session;

    const activeNode = session.activeNodeId
      ? session.nodesById[session.activeNodeId]
      : null;
    const branch = activeNode?.branchSuggestions?.find(
      (b) => b.id === branchId
    );

    // If we've already explored a node with the same prompt/label, reuse it instead of regenerating
    if (branch) {
      const existingNodeEntry = Object.entries(session.nodesById).find(
        ([, node]) => node.rawPrompt === branch.label
      );
      if (existingNodeEntry) {
        const existingNodeId = existingNodeEntry[0];
        const existingNode = existingNodeEntry[1];

        // Check if this node is already in the path
        const currentPathIndex = session.activeNodeId
          ? session.path.findIndex((seg) => seg.nodeId === session.activeNodeId)
          : -1;
        const isInPath = session.path.some(
          (seg) => seg.nodeId === existingNodeId
        );

        const edgeExists =
          session.activeNodeId &&
          (session.edges ?? []).some(
            (e) => e.from === session.activeNodeId && e.to === existingNodeId
          );

        if (isInPath) {
          // Node is already in path, ensure edge exists then activate it
          const updatedEdges =
            session.activeNodeId && !edgeExists
              ? [
                  ...(session.edges ?? []),
                  { from: session.activeNodeId, to: existingNodeId },
                ]
              : (session.edges ?? []);

          setSession({
            ...session,
            edges: updatedEdges,
            activeNodeId: existingNodeId,
          });
        } else {
          // Node exists but isn't in path - add it to path after current node and activate
          const pathSegment = {
            nodeId: existingNodeId,
            label:
              branch.label.substring(0, 60) +
              (branch.label.length > 60 ? "..." : ""),
            parentNodeId: session.activeNodeId ?? null,
          };

          // Insert after current node, or at end if current node not found
          const newPath =
            currentPathIndex >= 0
              ? [
                  ...session.path.slice(0, currentPathIndex + 1),
                  pathSegment,
                  ...session.path.slice(currentPathIndex + 1),
                ]
              : [...session.path, pathSegment];

          const updatedEdges =
            session.activeNodeId && !edgeExists
              ? [
                  ...(session.edges ?? []),
                  { from: session.activeNodeId, to: existingNodeId },
                ]
              : (session.edges ?? []);

          setSession({
            ...session,
            path: newPath,
            activeNodeId: existingNodeId,
            edges: updatedEdges,
          });
        }
        setError(null);
        setPreview(null);
        return;
      }
    }

    setIsLoading(true);
    setError(null);
    setPreview(null);

    // Optimistically add a placeholder path entry so it shows up immediately
    const tempNodeId = `pending-${branchId}-${Date.now()}`;
    const optimisticPathSegment = {
      nodeId: tempNodeId,
      label:
        branch?.label.substring(0, 60) +
          ((branch?.label.length ?? 0) > 60 ? "..." : "") || branchId,
      parentNodeId: session.activeNodeId ?? null,
    };
    const optimisticEdge =
      session.activeNodeId != null
        ? { from: session.activeNodeId, to: tempNodeId }
        : null;

    setGeneratingNodeId(tempNodeId);
    setSession({
      ...session,
      path: [...session.path, optimisticPathSegment],
      edges: optimisticEdge
        ? [...(session.edges ?? []), optimisticEdge]
        : session.edges,
      activeNodeId: tempNodeId,
    });

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
          // Direct to error handler section
          throw result.error;
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
        setSession(previousSession);
        setGeneratingNodeId(null);
        setPreview(null);
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
    resetSourceAnalysisState();
    // localStorage will be cleared by the useEffect above
  }

  return {
    session,
    isLoading: isLoading || isPending,
    generatingNodeId,
    preview,
    error,
    selectedSourceId,
    sourceAnalysis,
    isAnalyzingSource,
    start,
    followBranch,
    selectSource,
    clearSourceSelection,
    resetSourceAnalysisState,
    setActiveNode,
    reset,
    saveSessionToStorage,
  };
}
