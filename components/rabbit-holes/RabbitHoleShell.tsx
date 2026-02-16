/* eslint-disable @next/next/no-img-element */
"use client";

/**
 * RabbitHoleShell — Main explorer UI for Rabbit Hole sessions.
 *
 * Renders a three-column layout: path rail (left), article/source view (center),
 * and sources + branch suggestions (right). Handles loading a past session from
 * the browse page via URL search param (?sessionId=) or context, and coordinates
 * navigation, source analysis, and prompt bar with the useRabbitHoles hook.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";
import { useRabbitHoles } from "@/lib/rabbit-holes/useRabbitHoles";

// UI subcomponents still live under app/ during migration
import { RabbitHolePathRail } from "@/app/rabbitholes/_components/RabbitHolePathRail";
import { RabbitHoleArticle } from "@/app/rabbitholes/_components/RabbitHoleArticle";
import { RabbitHoleBranchGrid } from "@/app/rabbitholes/_components/RabbitHoleBranchGrid";
import { RabbitHoleSourceList } from "@/app/rabbitholes/_components/RabbitHoleSourceList";
import { RabbitHoleSourceAnalysis } from "@/app/rabbitholes/_components/RabbitHoleSourceAnalysis";
import { RabbitHoleAmbientLayer } from "@/app/rabbitholes/_components/RabbitHoleAmbientLayer";
import { RabbitHoleLoadingState } from "@/app/rabbitholes/_components/RabbitHoleLoadingState";

import { RabbitHolePromptBar } from "@/components/rabbit-holes/RabbitHolePromptBar";
import { RabbitHoleEmptyState } from "@/components/rabbit-holes/main/RabbitHoleEmptyState";
import { glass } from "../design-system/primitives";

const logger = createLogger("components/rabbit-holes/RabbitHoleShell");

/** Centralized center-column view state. One of these is active at a time. */
type CenterViewState =
  | { kind: "loading_previous_session" }
  | { kind: "empty" }
  | { kind: "article_loaded"; nodeId: string }
  | { kind: "generating_new_node"; variant: "initial" | "branch" }
  | { kind: "loading_source_analysis" }
  | { kind: "viewing_source_analysis"; sourceId: string };

export function RabbitHoleShell() {
  // --- Routing & context (for loading a session from browse) ---
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- Session state and actions from useRabbitHoles ---
  const {
    session,
    isLoading,
    isGeneratingNode,
    generatingNodeId,
    preview,
    error,
    exploreQuestion,
    followBranch,
    setActiveNode,
    selectedSourceId,
    sourceAnalysis,
    isAnalyzingSource,
    selectSource,
    clearSourceSelection,
    reset,
    saveSessionToStorage,
    loadExistingSession,
  } = useRabbitHoles();

  const [activeTakeawayIndex, setActiveTakeawayIndex] = useState<number | null>(
    null,
  );
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  /** True when we're loading, generating a node, or a specific node is generating (blocks some UI). */
  const isBusy = isLoading || isGeneratingNode || generatingNodeId != null;

  // --- Load past session when opened from browse ---
  // Prefer URL search param so the ID is available on mount (avoids race with context update).
  const sessionIdToLoad =
    searchParams.get("sessionId") ?? null;

  useEffect(() => {
    if (!sessionIdToLoad || error) return;
    const currentId = session?.sessionId ?? null;
    if (currentId === sessionIdToLoad) {
      if (searchParams.get("sessionId")) {
        router.replace("/rabbitholes", { scroll: false });
      }
      return;
    }
    let cancelled = false;
    loadExistingSession(sessionIdToLoad).then((result) => {
      if (cancelled) return;
      if (searchParams.get("sessionId")) {
        router.replace("/rabbitholes", { scroll: false });
      }
      if (!result.ok) {
        logger.error("RabbitHoleShell", "Failed to load session from browse", result.error);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    sessionIdToLoad,
    loadExistingSession,
    session?.sessionId,
    router,
  ]);

  // --- Error feedback ---
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Derived: the node currently being viewed (article + sources/branches) ---
  const activeNode = session?.activeNodeId
    ? session.nodesById[session.activeNodeId]
    : null;

  // --- Centralized center-column view state (single source of truth for what we show) ---
  const centerViewState: CenterViewState = useMemo(() => {
    const loadingPrevious =
      sessionIdToLoad != null &&
      isLoading &&
      (session == null || session.sessionId !== sessionIdToLoad);
    if (loadingPrevious) return { kind: "loading_previous_session" };

    if (isAnalyzingSource) return { kind: "loading_source_analysis" };

    if (selectedSourceId && sourceAnalysis)
      return { kind: "viewing_source_analysis", sourceId: selectedSourceId };

    if (isBusy) {
      const variant = activeNode ? "branch" : "initial";
      return { kind: "generating_new_node", variant };
    }

    if (activeNode)
      return { kind: "article_loaded", nodeId: activeNode.id };

    return { kind: "empty" };
  }, [
    sessionIdToLoad,
    isLoading,
    session?.sessionId,
    session,
    isAnalyzingSource,
    selectedSourceId,
    sourceAnalysis,
    isBusy,
    activeNode,
  ]);

  // --- Event handlers (thin wrappers around hook actions) ---
  const handleBackToArticle = () => {
    clearSourceSelection();
  };

  const handleReset = () => {
    reset();
  };

  const handleStart = async (question: string) => {
    await exploreQuestion(question);
  };

  // --- Path navigation (back/forward along session.path) ---
  const getCurrentPathIndex = () => {
    if (!session || !session.activeNodeId) return -1;
    return session.path.findIndex((seg) => seg.nodeId === session.activeNodeId);
  };

  const canGoBack = () => {
    const currentIndex = getCurrentPathIndex();
    return currentIndex > 0;
  };

  const canGoForward = () => {
    if (!session) return false;
    const currentIndex = getCurrentPathIndex();
    return currentIndex >= 0 && currentIndex < session.path.length - 1;
  };

  const handleNavigateBack = () => {
    if (!session || !canGoBack()) return;
    const currentIndex = getCurrentPathIndex();
    const prevNodeId = session.path[currentIndex - 1].nodeId;
    setActiveNode(prevNodeId);
  };

  const handleNavigateForward = () => {
    if (!session || !canGoForward()) return;
    const currentIndex = getCurrentPathIndex();
    const nextNodeId = session.path[currentIndex + 1].nodeId;
    setActiveNode(nextNodeId);
  };

  // --- Layout: ambient layer + header + main (path rail | article | sources & branches) ---
  return (
    <div className="relative h-screen bg-background overflow-hidden">
      <RabbitHoleAmbientLayer />
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <header className="shrink-0 px-12 pt-8 pb-6 relative z-20">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Link
              href="/rabbitholes/browse"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm tracking-wide pointer-events-auto"
            >
              ← Back to Rabbit Hole Browser
            </Link>
            <h1 className="font-commissioner text-2xl font-light tracking-wide text-foreground">
              Rabbit Hole Explorer
            </h1>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </header>
        {/* Dev-only collapsible debug panel — remove this block when done developing */}
        {process.env.NODE_ENV === "development" && (
          <div className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2">
            <button
              type="button"
              onClick={() => setDebugPanelOpen((o) => !o)}
              className={cn(
                "flex h-12 w-6 items-center justify-center rounded-l-md border border-r-0 border-border/60 bg-muted/80 text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground",
                debugPanelOpen && "border-r border-border/60",
              )}
              aria-label={debugPanelOpen ? "Close debug panel" : "Open debug panel"}
            >
              {debugPanelOpen ? (
                <PanelRightClose className="size-4" />
              ) : (
                <PanelRightOpen className="size-4" />
              )}
            </button>
            <AnimatePresence>
              {debugPanelOpen && (
                <motion.div
                  className={cn(
                    "w-80 max-h-[50vh] overflow-hidden rounded-l-lg border border-r-0 border-border/60 shadow-lg",
                    glass(),
                  )}
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 320, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col gap-3 overflow-y-auto p-4 text-xs">
                    <h2 className="font-semibold text-foreground">Debug</h2>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-medium text-muted-foreground">Session</h3>
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                        {JSON.stringify(session, null, 2)}
                      </pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-medium text-muted-foreground">Active node</h3>
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                        {JSON.stringify(activeNode, null, 2)}
                      </pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-medium text-muted-foreground">Center view state</h3>
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                        {JSON.stringify(centerViewState, null, 2)}
                      </pre>
                    </div>
                    <div className="flex flex-col gap-1">
                      <h3 className="font-medium text-muted-foreground">Generating node ID</h3>
                      <pre className="overflow-x-auto rounded bg-muted/50 p-2 text-[10px]">
                        {JSON.stringify(generatingNodeId, null, 2)}
                      </pre>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <main className="flex-1 flex flex-col lg:flex-row gap-12 px-12 pt-8 min-h-0 max-h-full max-w-7xl mx-auto w-full overflow-hidden">
          {/* Left: breadcrumb path through nodes; click to switch node, option to start new session. */}
          <aside className="w-full lg:w-[20%] shrink-0 overflow-y-auto pr-2">
            <RabbitHolePathRail
              session={session}
              activeNodeId={session?.activeNodeId ?? null}
              generatingNodeId={generatingNodeId}
              onNodeClick={setActiveNode}
              onNewRabbitHole={handleReset}
            />
          </aside>

          {/* Center: Article or Source Analysis */}
          <section className="relative flex-1 max-w-3xl mx-auto min-w-0 flex flex-col overflow-hidden">
            {/* Navigation Arrows (only when viewing article, not source analysis) */}
            {session &&
              session.path.length > 1 &&
              centerViewState.kind === "article_loaded" && (
                <div className="flex items-center justify-between mb-6 shrink-0 px-4">
                  <Button
                    isIconOnly
                    variant="ghost"
                    onPress={handleNavigateBack}
                    isDisabled={!canGoBack()}
                    className={cn(
                      "text-muted-foreground",
                      "hover:text-foreground",
                      "disabled:opacity-30 disabled:cursor-not-allowed",
                    )}
                  >
                    <ChevronLeft size={20} />
                  </Button>
                  <div className="text-xs text-muted-foreground">
                    {getCurrentPathIndex() + 1} / {session.path.length}
                  </div>
                  <Button
                    isIconOnly
                    variant="ghost"
                    onPress={handleNavigateForward}
                    isDisabled={!canGoForward()}
                    className={cn(
                      "text-muted-foreground",
                      "hover:text-foreground",
                      "disabled:opacity-30 disabled:cursor-not-allowed",
                    )}
                  >
                    <ChevronRight size={20} />
                  </Button>
                </div>
              )}

            <div className="flex-1 overflow-y-auto pr-2 px-4 pt-4 pb-36">
              <AnimatePresence mode="wait">
                {centerViewState.kind === "loading_previous_session" && (
                  <RabbitHoleLoadingState
                    key="loading-session"
                    variant="sources"
                    message="Loading session..."
                  />
                )}

                {centerViewState.kind === "loading_source_analysis" && (
                  <RabbitHoleLoadingState
                    key="analyzing-source"
                    variant="sources"
                  />
                )}

                {centerViewState.kind === "viewing_source_analysis" &&
                  sourceAnalysis && (
                    <RabbitHoleSourceAnalysis
                      key={centerViewState.sourceId}
                      analysis={sourceAnalysis}
                      sourceId={centerViewState.sourceId}
                      onBack={handleBackToArticle}
                    />
                  )}

                {centerViewState.kind === "generating_new_node" && (
                  <RabbitHoleLoadingState
                    key={`generating-${centerViewState.variant}`}
                    variant={centerViewState.variant}
                    preview={preview}
                  />
                )}

                {centerViewState.kind === "article_loaded" && activeNode && (
                  <div key={activeNode.id}>
                    <RabbitHoleArticle
                      title={activeNode.userQuestion}
                      takeaways={activeNode.keyTakeaways}
                      activeTakeawayIndex={activeTakeawayIndex}
                      articleHtml={activeNode.articleHtml}
                      nodeId={activeNode.id}
                      onBranchClick={followBranch}
                      onActiveSectionChange={setActiveTakeawayIndex}
                    />
                  </div>
                )}

                {centerViewState.kind === "empty" && <RabbitHoleEmptyState />}
              </AnimatePresence>
              <div className="h-24" /> {/** Spacer */}
            </div>

            {/* Fixed at bottom; parent is pointer-events-none so scroll doesn't capture, child re-enables. */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
              <div className="pointer-events-auto max-w-3xl mx-auto">
                <RabbitHolePromptBar
                  onStart={handleStart}
                  onReset={handleReset}
                  hasSession={!!session}
                  isLoading={isBusy}
                />
              </div>
            </div>
          </section>

          {/* Right: sources and branches (only when viewing an article). */}
          <aside className="w-full lg:w-[20%] shrink-0 overflow-y-auto pr-2">
            <AnimatePresence>
              {centerViewState.kind === "article_loaded" && activeNode && (
                <div key={activeNode.id} className="flex flex-col h-full">
                  <RabbitHoleSourceList
                    sources={activeNode.sources ?? []}
                    onSourceClick={selectSource}
                    hasBranches={(activeNode.branchSuggestions ?? []).length > 0}
                  />
                  <RabbitHoleBranchGrid
                    branches={activeNode.branchSuggestions ?? []}
                    onBranchClick={followBranch}
                    isLoading={isBusy}
                    hasSources={(activeNode.sources ?? []).length > 0}
                  />
                </div>
              )}
            </AnimatePresence>
          </aside>
        </main>
      </div>
    </div>
  );
}