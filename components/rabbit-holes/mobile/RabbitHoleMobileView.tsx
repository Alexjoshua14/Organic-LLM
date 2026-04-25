"use client";

import type { CenterViewState } from "@/lib/rabbit-holes/centerViewState";
import type {
  RabbitHoleBranchSuggestion,
  RabbitHoleNode,
  RabbitHoleSession,
  RabbitHoleSource,
  RabbitHoleSourceAnalysis as RabbitHoleSourceAnalysisType,
} from "@/lib/schemas/rabbitHoleSchemas";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, GitBranch, Paperclip } from "lucide-react";

import { MobileBottomSheet, type MobileSheetSnap } from "./MobileBottomSheet";
import { MobileHeader } from "./MobileHeader";
import { MobileSourcePills } from "./MobileSourcePills";

import { RabbitHoleAmbientLayer } from "@/app/rabbitholes/_components/RabbitHoleAmbientLayer";
import { RabbitHoleArticle } from "@/app/rabbitholes/_components/RabbitHoleArticle";
import { RabbitHoleLoadingState } from "@/app/rabbitholes/_components/RabbitHoleLoadingState";
import { RabbitHoleSourceAnalysis } from "@/app/rabbitholes/_components/RabbitHoleSourceAnalysis";
import { DelayedContent } from "@/app/rabbitholes/_components/DelayedContent";
import { RabbitHolePromptBar } from "@/components/rabbit-holes/RabbitHolePromptBar";
import { RabbitHoleEmptyState } from "@/components/rabbit-holes/main/RabbitHoleEmptyState";
import { cn } from "@/lib/utils";
import { RABBIT_HOLE_UNTITLED } from "@/lib/rabbit-holes/constants";

const PEEK_PAD_COLLAPSED = 170;
const PEEK_PAD_EXPANDED = 320;

export interface RabbitHoleMobileViewProps {
  session: RabbitHoleSession | null;
  activeNode: RabbitHoleNode | null;
  centerViewState: CenterViewState;
  activeTakeawayIndex: number | null;
  setActiveTakeawayIndex: (i: number | null) => void;
  preview: string | null;
  isBusy: boolean;
  generatingNodeId: string | null;
  sourceAnalysis: RabbitHoleSourceAnalysisType | null;
  followBranch: (branchId: string) => void;
  selectSource: (source: RabbitHoleSource) => void;
  clearSourceSelection: () => void;
  reset: () => void;
  /** Start exploration (shell wires URL + exploreQuestion) */
  onStartQuestion: (q: string) => Promise<void>;
  setActiveNode: (id: string) => void;
  getCurrentPathIndex: () => number;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  navigateBack: () => void;
  navigateForward: () => void;
}

function MobileBranchRows({
  branches,
  isLoading,
  onBranchClick,
}: {
  branches: RabbitHoleBranchSuggestion[];
  isLoading: boolean;
  onBranchClick: (id: string) => void;
}) {
  if (branches.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="font-commissioner mb-2 text-[10px] font-light uppercase tracking-[0.2em] text-muted-foreground">
        Explore further
      </p>
      <ul className="flex flex-col gap-2">
        {branches.map((b) => (
          <li key={b.id}>
            <button
              className={cn(
                "flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-border/50",
                "bg-card/50 px-3 py-2.5 text-left text-sm font-medium text-foreground",
                "transition-colors active:bg-card/80 disabled:opacity-40"
              )}
              disabled={isLoading}
              type="button"
              onClick={() => onBranchClick(b.id)}
            >
              <span className="line-clamp-2">{b.label}</span>
              <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function useSwipeArticleNavigate(
  canGoBack: boolean,
  canGoForward: boolean,
  onBack: () => void,
  onForward: () => void
) {
  const touchRef = useRef<{ x: number; y: number; t: number } | null>(null);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];

    touchRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    const start = touchRef.current;

    touchRef.current = null;
    if (!start) return;

    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Math.max(1, Date.now() - start.t);

    if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dt > 700) return;

    if (dx > 0 && canGoBack) onBack();
    else if (dx < 0 && canGoForward) onForward();
  };

  return { onTouchStart, onTouchEnd };
}

export function RabbitHoleMobileView({
  session,
  activeNode,
  centerViewState,
  activeTakeawayIndex,
  setActiveTakeawayIndex,
  preview,
  isBusy,
  generatingNodeId,
  sourceAnalysis,
  followBranch,
  selectSource,
  clearSourceSelection,
  reset,
  onStartQuestion,
  setActiveNode,
  getCurrentPathIndex,
  canGoBack,
  canGoForward,
  navigateBack,
  navigateForward,
}: RabbitHoleMobileViewProps) {
  const [sheetSnap, setSheetSnap] = useState<MobileSheetSnap>("collapsed");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [readPct, setReadPct] = useState(0);
  const rafRef = useRef<number | null>(null);

  /** Keep prompt reachable unless source analysis overlay is open */
  const showSheet = centerViewState.kind !== "viewing_source_analysis";

  const sources = activeNode?.sources ?? [];
  const branches = generatingNodeId === activeNode?.id ? [] : (activeNode?.branchSuggestions ?? []);

  const peekPad = sheetSnap === "collapsed" ? PEEK_PAD_COLLAPSED : PEEK_PAD_EXPANDED;

  const onScrollArticle = useCallback(() => {
    const el = scrollRef.current;

    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    rafRef.current = requestAnimationFrame(() => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const max = Math.max(1, scrollHeight - clientHeight);
      const pct = Math.min(100, Math.max(0, (scrollTop / max) * 100));

      setReadPct(pct);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const swipeNav = useSwipeArticleNavigate(
    canGoBack(),
    canGoForward(),
    navigateBack,
    navigateForward
  );

  const summaryRow = useMemo(() => {
    if (centerViewState.kind !== "article_loaded" || !activeNode) return null;

    return (
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Paperclip aria-hidden className="size-3.5" />
          {sources.length} sources
        </span>
        <span className="inline-flex items-center gap-1">
          <GitBranch aria-hidden className="size-3.5" />
          {branches.length} branches
        </span>
      </div>
    );
  }, [activeNode, branches.length, centerViewState.kind, sources.length]);

  return (
    <div
      className="relative flex h-dvh flex-col overflow-hidden bg-background"
      data-rabbit-hole-explorer
    >
      <RabbitHoleAmbientLayer />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden">
        <MobileHeader
          activeNodeId={session?.activeNodeId ?? null}
          getCurrentPathIndex={getCurrentPathIndex}
          session={session}
          onNewRabbitHole={reset}
          onNodeSelect={setActiveNode}
        />

        <div
          aria-hidden
          className="relative z-20 h-0.5 w-full shrink-0 overflow-hidden bg-border/40"
        >
          <div
            className="h-full bg-accent transition-[width] duration-150 ease-out"
            style={{ width: `${readPct}%` }}
          />
        </div>

        <div
          ref={scrollRef}
          className={cn(
            "rabbit-hole-mobile-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-5 pt-3",
            showSheet && "pb-[var(--rh-mobile-peek-pad,200px)]"
          )}
          style={{ ["--rh-mobile-peek-pad" as string]: `${peekPad}px` }}
          onScroll={onScrollArticle}
        >
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

            {centerViewState.kind === "generating_new_node" && (
              <DelayedContent key={`generating-${centerViewState.variant}`} delayMs={400}>
                <RabbitHoleLoadingState preview={preview} variant={centerViewState.variant} />
              </DelayedContent>
            )}

            {centerViewState.kind === "article_loaded" && activeNode?.articleHtml && (
              <motion.div
                key={activeNode.id}
                animate={{ opacity: 1, x: 0 }}
                className={cn(
                  "relative",
                  session &&
                    session.path.length > 1 &&
                    "before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:w-2 before:bg-linear-to-r before:from-accent/10 before:to-transparent",
                  session &&
                    session.path.length > 1 &&
                    "after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-2 after:bg-linear-to-l after:from-accent/10 after:to-transparent"
                )}
                exit={{ opacity: 0, x: -12 }}
                initial={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.25 }}
                {...swipeNav}
              >
                <RabbitHoleArticle
                  activeTakeawayIndex={activeTakeawayIndex}
                  articleHtml={activeNode.articleHtml}
                  compact
                  nodeId={activeNode.id}
                  takeaways={activeNode.keyTakeaways}
                  title={activeNode.title?.trim() || RABBIT_HOLE_UNTITLED}
                  onActiveSectionChange={setActiveTakeawayIndex}
                  onBranchClick={followBranch}
                />
              </motion.div>
            )}

            {centerViewState.kind === "empty" && (
              <RabbitHoleEmptyState
                key="empty"
                compact
                subtitle="Enter a question in the bar below to begin."
                title="Start exploring a topic"
              />
            )}
          </AnimatePresence>
        </div>

        {showSheet && (
          <MobileBottomSheet
            footer={
              <RabbitHolePromptBar
                hasSession={!!session}
                isBusy={isBusy}
                isLoading={isBusy}
                onReset={reset}
                onStart={onStartQuestion}
              />
            }
            summaryRow={summaryRow ?? undefined}
            onSnapChange={setSheetSnap}
          >
            {centerViewState.kind === "article_loaded" && activeNode ? (
              <>
                <MobileSourcePills sources={sources} onSourceClick={selectSource} />
                <MobileBranchRows
                  branches={branches}
                  isLoading={isBusy}
                  onBranchClick={followBranch}
                />
              </>
            ) : centerViewState.kind === "loading_source_analysis" ? (
              <p className="text-center text-xs text-muted-foreground">Analyzing source…</p>
            ) : (
              <p className="text-center text-xs text-muted-foreground">
                Ask a question to collect sources and branches here.
              </p>
            )}
          </MobileBottomSheet>
        )}
      </div>

      <AnimatePresence>
        {centerViewState.kind === "viewing_source_analysis" && sourceAnalysis && (
          <motion.div
            key="source-analysis-overlay"
            animate={{ x: 0, opacity: 1 }}
            className="fixed inset-0 z-60 flex flex-col bg-background"
            exit={{ x: "100%", opacity: 0.98 }}
            initial={{ x: "100%", opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 38 }}
          >
            <motion.div
              className="flex min-h-0 flex-1 flex-col"
              drag="x"
              dragConstraints={{ left: 0, right: 120 }}
              dragElastic={0.12}
              onDragEnd={(_, info) => {
                if (info.offset.x > 56 || info.velocity.x > 320) {
                  clearSourceSelection();
                }
              }}
            >
              <div className="shrink-0 border-b border-border/40 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="flex items-center justify-between gap-2">
                  <button
                    className="min-h-11 text-sm text-muted-foreground"
                    type="button"
                    onClick={clearSourceSelection}
                  >
                    ← Article
                  </button>
                  <span className="text-2xs text-muted-foreground">Swipe right to close</span>
                </div>
              </div>
              <div className="rabbit-hole-mobile-source-analysis min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
                <RabbitHoleSourceAnalysis
                  analysis={sourceAnalysis}
                  mobile
                  sourceId={centerViewState.sourceId}
                  onBack={clearSourceSelection}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
