"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useRabbitHoleSession } from "../_lib/useRabbitHoleSession";
import { RabbitHolePathRail } from "./RabbitHolePathRail";
import { RabbitHoleArticle } from "./RabbitHoleArticle";
import { RabbitHoleBranchGrid } from "./RabbitHoleBranchGrid";
import { RabbitHoleSourceList } from "./RabbitHoleSourceList";
import { RabbitHoleSourceAnalysis } from "./RabbitHoleSourceAnalysis";
import { RabbitHoleAmbientLayer } from "./RabbitHoleAmbientLayer";
import { RabbitHolePromptBar } from "./RabbitHolePromptBar";
import { RabbitHoleLoadingState } from "./RabbitHoleLoadingState";
import { RabbitHoleSource } from "../_lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface RabbitHoleShellProps {
  sessionId?: string;
}

export function RabbitHoleShell({ sessionId }: RabbitHoleShellProps = {}) {
  const router = useRouter();
  const {
    session,
    isLoading,
    generatingNodeId,
    preview,
    error,
    start,
    followBranch,
    setActiveNode,
    selectedSourceId,
    sourceAnalysis,
    isAnalyzingSource,
    selectSource,
    clearSourceSelection,
    reset,
    saveSessionToStorage
  } = useRabbitHoleSession(sessionId);

  const [activeTakeawayIndex, setActiveTakeawayIndex] = useState<number | null>(
    null,
  );

  // If sessionId was provided but session is null after mount, redirect to browse
  useEffect(() => {
    if (sessionId && !session && !isLoading) {
      // Session not found, redirect to browse after a short delay
      const timer = setTimeout(() => {
        router.push("/rabbitholes/browse");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionId, session, isLoading, router]);

  // Surface errors via toast
  useEffect(() => {
    if (error) {
      toast.error(error);
    }
  }, [error]);

  const activeNode = session?.activeNodeId
    ? session.nodesById[session.activeNodeId]
    : null;

  const handleBackToArticle = () => {
    clearSourceSelection();
  };

  const handleReset = () => {
    reset();
  };

  // Navigation helpers
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

  return (
    <div className="relative h-screen bg-background overflow-hidden">
      <Button className="z-40 absolute top-20 right-0" onPress={() => saveSessionToStorage(session)}>
        Manual Save
      </Button>
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

        <main className="flex-1 flex flex-col lg:flex-row gap-12 px-12 pt-8 min-h-0 max-h-full max-w-7xl mx-auto w-full overflow-hidden">
          {/* Left: Path Rail */}
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
            {/* Navigation Arrows */}
            {session && session.path.length > 1 && !selectedSourceId && (
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
                {isAnalyzingSource && (
                  <RabbitHoleLoadingState
                    key="analyzing-source"
                    variant="sources"
                  />
                )}
                {!isAnalyzingSource && selectedSourceId && sourceAnalysis && (
                  <RabbitHoleSourceAnalysis
                    key={selectedSourceId}
                    analysis={sourceAnalysis}
                    sourceId={selectedSourceId}
                    onBack={handleBackToArticle}
                  />
                )}
                {!isAnalyzingSource && !selectedSourceId && isLoading && generatingNodeId === activeNode?.id && (
                  <RabbitHoleLoadingState
                    key="loading-active"
                    variant={session ? "branch" : "initial"}
                    preview={preview}
                  />
                )}
                {!isAnalyzingSource && !selectedSourceId && activeNode && (!isLoading || generatingNodeId !== activeNode.id) && (
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
                {!isAnalyzingSource && !selectedSourceId && !activeNode && !isLoading && (
                  <div
                    key="empty"
                    className="flex flex-col items-center justify-center h-full text-center px-8"
                  >
                    <p className="font-commissioner text-muted-foreground text-xl mb-4 font-light">
                      Start exploring a topic
                    </p>
                    <p className="text-muted-foreground/70 text-sm">
                      Enter a question below to begin your rabbit hole journey
                    </p>
                  </div>
                )}
                {!isAnalyzingSource && !selectedSourceId && !activeNode && isLoading && (
                  <RabbitHoleLoadingState
                    key="loading-initial"
                    variant="initial"
                    preview={preview}
                  />
                )}
              </AnimatePresence>
              <div className="h-24" /> {/** Spacer */}
            </div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">
              <div className="pointer-events-auto max-w-3xl mx-auto">
                <RabbitHolePromptBar
                  onStart={start}
                  onReset={handleReset}
                  hasSession={!!session}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </section>

          {/* Right: Sources & Branches */}
          <aside className="w-full lg:w-[20%] shrink-0 overflow-y-auto pr-2">
            <AnimatePresence>
              {!isLoading && activeNode && (
                <div key={activeNode.id} className="flex flex-col h-full">
                  <RabbitHoleSourceList
                    sources={activeNode.sources ?? []}
                    onSourceClick={selectSource}
                    hasBranches={(activeNode.branchSuggestions ?? []).length > 0}
                  />
                  <RabbitHoleBranchGrid
                    branches={activeNode.branchSuggestions ?? []}
                    onBranchClick={followBranch}
                    isLoading={isLoading}
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

