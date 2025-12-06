"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { useRabbitHoleSession } from "../_lib/useRabbitHoleSession";
import { RabbitHolePathRail } from "./RabbitHolePathRail";
import { RabbitHoleKeyTakeaways } from "./RabbitHoleKeyTakeaways";
import { RabbitHoleArticle } from "./RabbitHoleArticle";
import { RabbitHoleBranchGrid } from "./RabbitHoleBranchGrid";
import { RabbitHoleSourceList } from "./RabbitHoleSourceList";
import { RabbitHoleSourceAnalysis } from "./RabbitHoleSourceAnalysis";
import { RabbitHoleAmbientLayer } from "./RabbitHoleAmbientLayer";
import { RabbitHolePromptBar } from "./RabbitHolePromptBar";
import { RabbitHoleLoadingState } from "./RabbitHoleLoadingState";
import { analyzeSource } from "../actions";
import { RabbitHoleSource, RabbitHoleSourceAnalysis as SourceAnalysisType } from "../_lib/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@heroui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";

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
    reset,
  } = useRabbitHoleSession(sessionId);

  const [activeTakeawayIndex, setActiveTakeawayIndex] = useState<number | null>(
    null,
  );
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [sourceAnalysis, setSourceAnalysis] = useState<SourceAnalysisType | null>(null);
  const [isAnalyzingSource, setIsAnalyzingSource] = useState(false);

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

  const activeNode = session?.activeNodeId
    ? session.nodesById[session.activeNodeId]
    : null;

  const handleSourceClick = async (source: RabbitHoleSource) => {
    setSelectedSourceId(source.id);
    setIsAnalyzingSource(true);
    setSourceAnalysis(null);

    try {
      const result = await analyzeSource(source.url, source.title, source.snippet);
      if (result.error) {
        console.error("Error analyzing source:", result.error);
        setSelectedSourceId(null);
      } else if (result.data) {
        setSourceAnalysis(result.data);
      }
    } catch (error) {
      console.error("Error analyzing source:", error);
      setSelectedSourceId(null);
    } finally {
      setIsAnalyzingSource(false);
    }
  };

  const handleBackToArticle = () => {
    setSelectedSourceId(null);
    setSourceAnalysis(null);
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
      <RabbitHoleAmbientLayer />
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        <header className="shrink-0 px-12 pt-8 pb-6 relative z-20">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <Link
              href="/"
              className="font-satoshi text-[#5C5E5E] dark:text-[#A0A2A2] hover:text-[#2D2B26] dark:hover:text-[#F3F4F3] transition-colors text-sm tracking-wide pointer-events-auto"
            >
              ← Back to Organic LLM
            </Link>
            <h1 className="font-commissioner text-2xl font-light tracking-wide text-[#2D2B26] dark:text-[#F3F4F3]">
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
              onNewRabbitHole={reset}
            />
          </aside>

          {/* Center: Article or Source Analysis */}
          <section className="flex-1 max-w-3xl mx-auto min-w-0 flex flex-col overflow-hidden">
            {/* Navigation Arrows */}
            {session && session.path.length > 1 && !selectedSourceId && (
              <div className="flex items-center justify-between mb-6 shrink-0 px-4">
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={handleNavigateBack}
                  isDisabled={!canGoBack()}
                  className={cn(
                    "text-[#5C5E5E] dark:text-[#A0A2A2]",
                    "hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                  )}
                >
                  <ChevronLeft size={20} />
                </Button>
                <div className="font-satoshi text-xs text-[#5C5E5E] dark:text-[#A0A2A2]">
                  {getCurrentPathIndex() + 1} / {session.path.length}
                </div>
                <Button
                  isIconOnly
                  variant="ghost"
                  onPress={handleNavigateForward}
                  isDisabled={!canGoForward()}
                  className={cn(
                    "text-[#5C5E5E] dark:text-[#A0A2A2]",
                    "hover:text-[#2D2B26] dark:hover:text-[#F3F4F3]",
                    "disabled:opacity-30 disabled:cursor-not-allowed",
                  )}
                >
                  <ChevronRight size={20} />
                </Button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto pr-2 px-4">
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
                    <RabbitHoleKeyTakeaways
                      takeaways={activeNode.keyTakeaways}
                      activeTakeawayIndex={activeTakeawayIndex}
                    />
                    <RabbitHoleArticle
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
                    <p className="font-commissioner text-[#5C5E5E] dark:text-[#A0A2A2] text-xl mb-4 font-light">
                      Start exploring a topic
                    </p>
                    <p className="font-satoshi text-[#5C5E5E]/70 dark:text-[#A0A2A2]/70 text-sm">
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
              {error && (
                <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-700 dark:text-red-400 mt-4 font-satoshi">
                  {error}
                </div>
              )}
            </div>
            <div className="px-4">
              <RabbitHolePromptBar
                onStart={start}
                onReset={reset}
                hasSession={!!session}
                isLoading={isLoading}
              />
            </div>
          </section>

          {/* Right: Sources & Branches */}
          <aside className="w-full lg:w-[20%] shrink-0 overflow-y-auto pr-2">
            <AnimatePresence>
              {!isLoading && activeNode && (
                <div key={activeNode.id} className="flex flex-col h-full">
                  <RabbitHoleSourceList
                    sources={activeNode.sources}
                    onSourceClick={handleSourceClick}
                    hasBranches={activeNode.branchSuggestions.length > 0}
                  />
                  <RabbitHoleBranchGrid
                    branches={activeNode.branchSuggestions}
                    onBranchClick={followBranch}
                    isLoading={isLoading}
                    hasSources={activeNode.sources.length > 0}
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

