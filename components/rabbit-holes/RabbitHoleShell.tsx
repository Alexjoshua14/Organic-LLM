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
import {
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { glass } from "../design-system/primitives";
import { useSidebar } from "../third-party/ui/sidebar";

import { cn } from "@/lib/utils";
import { createLogger } from "@/lib/logger";
import { useRabbitHoles } from "@/lib/rabbit-holes/useRabbitHoles";

// UI subcomponents still live under app/ during migration
import { RabbitHolePathRail } from "@/app/rabbitholes/_components/RabbitHolePathRail";
import { RabbitHoleArticle } from "@/app/rabbitholes/_components/RabbitHoleArticle";
import { RabbitHoleBranchSuggestionsBlock } from "@/app/rabbitholes/_components/RabbitHoleBranchSuggestionsBlock";
import { RabbitHoleSourceList } from "@/app/rabbitholes/_components/RabbitHoleSourceList";
import { RabbitHoleSourceAnalysis } from "@/app/rabbitholes/_components/RabbitHoleSourceAnalysis";
import { RabbitHoleAmbientLayer } from "@/app/rabbitholes/_components/RabbitHoleAmbientLayer";
import { RabbitHoleLoadingState } from "@/app/rabbitholes/_components/RabbitHoleLoadingState";
import { DelayedContent } from "@/app/rabbitholes/_components/DelayedContent";
import { RabbitHolePromptBar } from "@/components/rabbit-holes/RabbitHolePromptBar";
import { RabbitHoleEmptyState } from "@/components/rabbit-holes/main/RabbitHoleEmptyState";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/third-party/ui/collapsible";
import { RabbitHoleNode, RabbitHoleSession } from "@/lib/schemas/rabbitHoleSchemas";

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

  const [activeTakeawayIndex, setActiveTakeawayIndex] = useState<number | null>(null);
  const { open } = useSidebar();

  /** True when we're loading, generating a node, or a specific node is generating (blocks some UI). */
  const isBusy = isGeneratingNode || generatingNodeId != null;

  // --- Load past session when opened from browse ---
  // Prefer URL search param so the ID is available on mount (avoids race with context update).
  const sessionIdToLoad = searchParams.get("sessionId") ?? null;

  useEffect(() => {
    if (!sessionIdToLoad || error) return;
    const currentId = session?.sessionId ?? null;

    if (currentId === sessionIdToLoad) {
      return;
    }
    let cancelled = false;

    loadExistingSession(sessionIdToLoad).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        logger.error("RabbitHoleShell", "Failed to load session from browse", result.error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [sessionIdToLoad, loadExistingSession, session?.sessionId, router]);

  // --- Error feedback ---
  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  // --- Derived: the node currently being viewed (article + sources/branches) ---
  const activeNode = session?.activeNodeId ? session.nodesById[session.activeNodeId] : null;

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

    const isGeneratingThisNode = activeNode && generatingNodeId === activeNode.id;
    const hasRealArticle = !!activeNode?.articleHtml?.trim();

    if (isGeneratingThisNode && !hasRealArticle) {
      const variant = activeNode ? "branch" : "initial";

      return { kind: "generating_new_node", variant };
    }

    if (activeNode) return { kind: "article_loaded", nodeId: activeNode.id };

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
    generatingNodeId,
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

    // After a new session is created and generation starts, ensure the URL
    // includes ?sessionId= so refreshes stay attached to the same session/node.
    if (session?.sessionId) {
      const current = sessionIdToLoad;

      if (current !== session.sessionId) {
        const params = new URLSearchParams(searchParams.toString());

        params.set("sessionId", session.sessionId);
        router.replace(`?${params.toString()}`);
      }
    }
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
        <header className="px-8 md:px-10 lg:px-12 pt-16 md:pt-8 pb-6 relative z-20 w-full">
          <div className="flex items-center justify-between max-w-7xl mx-auto h-6">
            {!open && (
              <Link
                className="text-muted-foreground hover:text-foreground transition-colors text-sm tracking-wide pointer-events-auto"
                href="/rabbitholes/browse"
              >
                ← Back to Browser
              </Link>
            )}
            <h1 className="absolute left-1/2 -translate-x-1/2 font-commissioner text-2xl font-light tracking-wide text-foreground">
              <Link href="/rabbitholes/browse">
                Rabbit Hole Explorer
              </Link>
            </h1>
            <div className="w-24" /> {/* Spacer for centering */}
          </div>
        </header>
        {/* Dev-only collapsible debug panel — remove this block when done developing */}
        <RabbitHoleDebugPanel
          activeNode={activeNode}
          centerViewState={centerViewState}
          generatingNodeId={generatingNodeId}
          session={session}
        />

        <main className="flex-1 flex flex-col lg:flex-row gap-12 px-12 pt-8 min-h-0 max-w-7xl mx-auto w-full overflow-y-auto">
          {/* Left: breadcrumb path through nodes; click to switch node, option to start new session. */}
          <aside className="lg:sticky lg:top-0 w-full lg:w-[20%] shrink-0 overflow-y-auto pr-2">
            <RabbitHolePathRail
              activeNodeId={session?.activeNodeId ?? null}
              generatingNodeId={generatingNodeId}
              session={session}
              onNewRabbitHole={handleReset}
              onNodeClick={setActiveNode}
            />
          </aside>

          {/* Center: Article or Source Analysis */}
          <section className="flex-1 max-w-3xl mx-auto min-w-0 flex flex-col">
            {/* Navigation Arrows (only when viewing article, not source analysis) */}
            {session && session.path.length > 1 && centerViewState.kind === "article_loaded" && (
              <div className="flex items-center justify-between mb-6 shrink-0 px-4">
                <Button
                  isIconOnly
                  className={cn(
                    "text-muted-foreground",
                    "hover:text-foreground",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                  isDisabled={!canGoBack()}
                  variant="ghost"
                  onPress={handleNavigateBack}
                >
                  <ChevronLeft size={20} />
                </Button>
                <div className="text-xs text-muted-foreground">
                  {getCurrentPathIndex() + 1} / {session.path.length}
                </div>
                <Button
                  isIconOnly
                  className={cn(
                    "text-muted-foreground",
                    "hover:text-foreground",
                    "disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                  isDisabled={!canGoForward()}
                  variant="ghost"
                  onPress={handleNavigateForward}
                >
                  <ChevronRight size={20} />
                </Button>
              </div>
            )}

            <div className="flex-1 h-full pr-2 px-4 pt-4 pb-36">
              <AnimatePresence mode="wait">
                {centerViewState.kind === "loading_previous_session" && (
                  <DelayedContent key="loading-session" delayMs={400}>
                    <RabbitHoleLoadingState message="Loading session..." variant="sources" />
                  </DelayedContent>
                )}

                {centerViewState.kind === "loading_source_analysis" && (
                  <DelayedContent key="analyzing-source" delayMs={400}>
                    <RabbitHoleLoadingState variant="sources" />
                  </DelayedContent>
                )}

                {centerViewState.kind === "viewing_source_analysis" && sourceAnalysis && (
                  <RabbitHoleSourceAnalysis
                    key={centerViewState.sourceId}
                    analysis={sourceAnalysis}
                    sourceId={centerViewState.sourceId}
                    onBack={handleBackToArticle}
                  />
                )}

                {centerViewState.kind === "generating_new_node" && (
                  <DelayedContent key={`generating-${centerViewState.variant}`} delayMs={400}>
                    <RabbitHoleLoadingState preview={preview} variant={centerViewState.variant} />
                  </DelayedContent>
                )}

                {centerViewState.kind === "article_loaded" &&
                  activeNode &&
                  activeNode.articleHtml && (
                    <div key={activeNode.id}>
                      <RabbitHoleArticle
                        activeTakeawayIndex={activeTakeawayIndex}
                        articleHtml={activeNode.articleHtml}
                        nodeId={activeNode.id}
                        takeaways={activeNode.keyTakeaways}
                        title={activeNode.title ?? activeNode.userQuestion}
                        onActiveSectionChange={setActiveTakeawayIndex}
                        onBranchClick={followBranch}
                      />
                    </div>
                  )}

                {centerViewState.kind === "empty" && <RabbitHoleEmptyState />}
              </AnimatePresence>
              <div className="h-24" /> {/** Spacer */}
            </div>

            {/* Fixed at bottom; parent is pointer-events-none so scroll doesn't capture, child re-enables. */}
            <div className="pointer-events-none absolute inset-x-0 left-1/2 -translate-x-1/2 bottom-0 px-4 pb-4 flex justify-center items-center">
              <div className="pointer-events-auto min-w-fit md:max-w-xl w-full mx-auto">
                <RabbitHolePromptBar
                  hasSession={!!session}
                  isBusy={isBusy}
                  isLoading={isBusy}
                  onReset={handleReset}
                  onStart={handleStart}
                />
              </div>
            </div>
          </section>

          {/* Right: sources and branches (only when viewing an article). Explore Further only when branch suggestions are generated. */}
          <aside className="w-full lg:w-[20%] shrink-0 pr-2">
            <AnimatePresence>
              {centerViewState.kind === "article_loaded" && activeNode && (
                <div key={activeNode.id} className="flex flex-col h-full">
                  <RabbitHoleSourceList
                    hasBranches={
                      generatingNodeId !== activeNode.id &&
                      (activeNode.branchSuggestions ?? []).length > 0
                    }
                    sources={activeNode.sources ?? []}
                    onSourceClick={selectSource}
                  />
                  {generatingNodeId !== activeNode.id && (
                    <RabbitHoleBranchSuggestionsBlock
                      branches={activeNode.branchSuggestions ?? []}
                      hasSources={(activeNode.sources ?? []).length > 0}
                      isLoading={isBusy}
                      onBranchClick={followBranch}
                    />
                  )}
                </div>
              )}
            </AnimatePresence>
          </aside>
        </main>
      </div>
    </div>
  );
}

const RabbitHoleDebugPanel = ({
  session,
  activeNode,
  centerViewState,
  generatingNodeId,
}: {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  centerViewState: CenterViewState;
  generatingNodeId: string | null;
}) => {
  const [debugPanelOpen, setDebugPanelOpen] = useState(false);

  if (process.env.NODE_ENV === "development") {
    const debugSections = [
      { label: "Session", value: session },
      { label: "Active node", value: activeNode },
      { label: "Center view state", value: centerViewState },
      { label: "Generating node ID", value: generatingNodeId },
    ] as const;

    return (
      <div className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2 flex-row items-center justify-end">
        <button
          aria-label={debugPanelOpen ? "Close debug panel" : "Open debug panel"}
          className={cn(
            "flex h-12 w-6 shrink-0 items-center justify-center rounded-l-md border border-r-0 border-border/60 bg-muted/80 text-muted-foreground shadow-sm transition-all duration-200 hover:bg-muted hover:text-foreground hover:w-7",
            debugPanelOpen && "border-r border-border/60 bg-muted"
          )}
          type="button"
          onClick={() => setDebugPanelOpen((o) => !o)}
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
              animate={{ width: 320, height: "55vh", opacity: 1 }}
              className={cn(
                "flex w-80 max-h-[55vh] shrink-0 flex-col overflow-hidden rounded-l-xl border border-r-0 border-border/60 shadow-xl",
                glass()
              )}
              exit={{ width: 0, height: 0, opacity: 0 }}
              initial={{ width: 0, height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
                <Bug aria-hidden className="size-4 text-amber-500/90" />
                <span className="font-commissioner text-sm font-medium tracking-tight text-foreground">
                  Debug
                </span>
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-600 dark:text-amber-400/90">
                  dev
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                {debugSections.map(({ label, value }) => (
                  <Collapsible
                    key={label}
                    defaultOpen
                    className="rounded-lg border border-border/30 bg-muted/20"
                  >
                    <CollapsibleTrigger className="group flex w-full items-center justify-between px-2.5 py-2 text-left transition-colors hover:bg-muted/30 data-[state=open]:rounded-t-lg">
                      <h3 className="font-commissioner text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                        {label}
                      </h3>
                      <ChevronDown
                        aria-hidden
                        className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <pre className="min-h-8 overflow-x-auto rounded-b-lg rounded-t-none border-t border-border/20 bg-background/60 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-foreground/90">
                        {JSON.stringify(value, null, 2)}
                      </pre>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
};
