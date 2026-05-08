"use client";

import type { Vector4 } from "@organic-llm/morph-physics";

import { useMorphPhysics } from "@organic-llm/morph-physics/react";
import { snapshot } from "@organic-llm/morph-physics";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  morphSpringConfigForPlaybackPercent,
  type MorphDemoSpeedPercent,
} from "../../_lib/morph-demo-spring-presets";
import {
  MORPH_CHAT_RABBIT_ACTIVE_NODE_ID,
  MORPH_CHAT_RABBIT_MESSAGES,
  MORPH_CHAT_RABBIT_SESSION,
} from "../../_lib/morph-chat-rabbit-fixtures";
import { MorphDemoDevHud, type MorphLiveMetrics } from "../morph-demo-dev-hud";
import { MorphDemoReactScan } from "../morph-demo-react-scan";

import { RabbitHoleArticle } from "@/app/rabbitholes/_components/RabbitHoleArticle";
import { RabbitHoleBranchSuggestionsBlock } from "@/app/rabbitholes/_components/RabbitHoleBranchSuggestionsBlock";
import { RabbitHolePathRail } from "@/app/rabbitholes/_components/RabbitHolePathRail";
import { RabbitHoleSourceList } from "@/app/rabbitholes/_components/RabbitHoleSourceList";
import AdaptiveLiquidChrome from "@/components/background/AdaptiveLiquidChrome";
import { Conversation } from "@/components/third-party/ai-elements/conversation";
import { ChatThread } from "@/components/chat/chat-thread";
import Page from "@/components/layout/page";
import { Button } from "@/components/third-party/ui/button";
import { layout as layoutTokens } from "@/lib/rabbit-holes/designTokens";
import { cn } from "@/lib/utils";

type ArchetypeLayout = "chat" | "rabbit";

const RAIL_TRANSITION = { duration: 0.34, ease: [0.22, 0.8, 0.22, 1] as const };

export function MorphChatRabbitDemo() {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const chatMeasureRef = useRef<HTMLDivElement | null>(null);
  const rabbitMeasureRef = useRef<HTMLDivElement | null>(null);
  const variantRef = useRef<ArchetypeLayout>("chat");
  const chatVecRef = useRef<Vector4 | null>(null);
  const rabbitVecRef = useRef<Vector4 | null>(null);
  const prevSampleRef = useRef<{ t: number; rect: Vector4 } | null>(null);
  const speedEffectPrimedRef = useRef(false);

  const [devHudExpanded, setDevHudExpanded] = useState(true);
  const [layout, setLayout] = useState<ArchetypeLayout>("chat");
  const layoutRef = useRef<ArchetypeLayout>(layout);
  const [speedPercent, setSpeedPercent] = useState<MorphDemoSpeedPercent>(100);
  const [measuredTargets, setMeasuredTargets] = useState<{
    chat: Vector4 | null;
    rabbit: Vector4 | null;
  }>({ chat: null, rabbit: null });
  const [liveMetrics, setLiveMetrics] = useState<MorphLiveMetrics | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string>(MORPH_CHAT_RABBIT_ACTIVE_NODE_ID);
  const [activeTakeawayIndex, setActiveTakeawayIndex] = useState<number | null>(null);

  const sessionForRails = useMemo(
    () => ({ ...MORPH_CHAT_RABBIT_SESSION, activeNodeId }),
    [activeNodeId]
  );

  const activeNode = sessionForRails.activeNodeId
    ? sessionForRails.nodesById[sessionForRails.activeNodeId]
    : null;

  const springConfig = useMemo(
    () => morphSpringConfigForPlaybackPercent(speedPercent),
    [speedPercent]
  );

  const { elementRef, reset, morphTo } = useMorphPhysics({
    config: springConfig,
  });

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  const applyLayout = useCallback(
    (next: ArchetypeLayout) => {
      const cv = chatVecRef.current;
      const rv = rabbitVecRef.current;

      if (!cv || !rv) return;
      variantRef.current = next;
      setLayout(next);
      morphTo(next === "chat" ? cv : rv);
    },
    [morphTo]
  );

  const measureAndSync = useCallback(() => {
    const stage = stageRef.current;
    const chatEl = chatMeasureRef.current;
    const rabbitEl = rabbitMeasureRef.current;

    if (!stage || !chatEl || !rabbitEl) return;

    const cv = snapshot(chatEl, stage);
    const rv = snapshot(rabbitEl, stage);

    chatVecRef.current = cv;
    rabbitVecRef.current = rv;

    setMeasuredTargets({ chat: { ...cv }, rabbit: { ...rv } });

    const current = variantRef.current === "chat" ? cv : rv;

    reset(current);
  }, [reset]);

  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => {
      measureAndSync();
    });

    return () => cancelAnimationFrame(id);
  }, [measureAndSync]);

  useEffect(() => {
    variantRef.current = layout;
  }, [layout]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !e.shiftKey) return;
      e.preventDefault();
      const next = layoutRef.current === "chat" ? "rabbit" : "chat";

      applyLayout(next);
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [applyLayout]);

  useEffect(() => {
    const stage = stageRef.current;

    if (!stage) return;

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        measureAndSync();
      });
    });

    ro.observe(stage);

    return () => ro.disconnect();
  }, [measureAndSync]);

  useEffect(() => {
    const id = setInterval(() => {
      const el = elementRef.current;
      const stage = stageRef.current;

      if (!el || !stage) {
        setLiveMetrics(null);

        return;
      }

      const er = el.getBoundingClientRect();
      const sr = stage.getBoundingClientRect();
      const x = er.x - sr.x;
      const y = er.y - sr.y;
      const w = er.width;
      const h = er.height;

      const lay = layoutRef.current;
      const tgt = lay === "chat" ? measuredTargets.chat : measuredTargets.rabbit;

      let l1Err: number | null = null;

      if (tgt) {
        l1Err =
          Math.abs(x - tgt.x) + Math.abs(y - tgt.y) + Math.abs(w - tgt.w) + Math.abs(h - tgt.h);
      }

      const now = performance.now();
      const prev = prevSampleRef.current;

      let l1Vel: number | null = null;

      if (prev) {
        const dt = (now - prev.t) / 1000;

        if (dt > 1e-3) {
          l1Vel =
            (Math.abs(x - prev.rect.x) +
              Math.abs(y - prev.rect.y) +
              Math.abs(w - prev.rect.w) +
              Math.abs(h - prev.rect.h)) /
            dt;
        }
      }

      prevSampleRef.current = { t: now, rect: { x, y, w, h } };

      const settled =
        tgt != null && l1Err != null && l1Vel != null ? l1Err < 1.5 && l1Vel < 35 : null;

      setLiveMetrics({ x, y, w, h, l1Err, l1Vel, settled });
    }, 48);

    return () => {
      clearInterval(id);
      prevSampleRef.current = null;
    };
  }, [measuredTargets]);

  useEffect(() => {
    if (!speedEffectPrimedRef.current) {
      speedEffectPrimedRef.current = true;

      return;
    }
    const cv = chatVecRef.current;
    const rv = rabbitVecRef.current;

    if (!cv || !rv) return;
    morphTo(layoutRef.current === "chat" ? cv : rv);
  }, [speedPercent, morphTo]);

  const onToggleMorph = () => {
    applyLayout(layout === "chat" ? "rabbit" : "chat");
  };

  const demoRightRail = activeNode?.articleHtml ? (
    <div className="flex flex-col gap-3">
      <RabbitHoleSourceList
        hasBranches={(activeNode.branchSuggestions ?? []).length > 0}
        sources={activeNode.sources ?? []}
        onSourceClick={() => undefined}
      />
      <RabbitHoleBranchSuggestionsBlock
        branches={activeNode.branchSuggestions ?? []}
        hasSources={(activeNode.sources ?? []).length > 0}
        isLoading={false}
        onBranchClick={() => undefined}
      />
    </div>
  ) : null;

  const centerArticle =
    activeNode?.articleHtml && activeNode.keyTakeaways ? (
      <RabbitHoleArticle
        activeTakeawayIndex={activeTakeawayIndex}
        articleHtml={activeNode.articleHtml}
        nodeId={activeNode.id}
        takeaways={activeNode.keyTakeaways}
        title={activeNode.title?.trim() || "Untitled"}
        onActiveSectionChange={setActiveTakeawayIndex}
        onBranchClick={() => undefined}
      />
    ) : null;

  return (
    <Page transparentBackground className="items-stretch justify-start gap-0 overflow-hidden">
      <AdaptiveLiquidChrome dimIntensity={0.45} />
      <MorphDemoReactScan debugPanelExpanded={devHudExpanded} />
      <MorphDemoDevHud
        layout={layout}
        live={liveMetrics}
        speedPercent={speedPercent}
        spring={springConfig}
        targetLabelAlpha="chat"
        targetLabelBeta="rabbit"
        targets={{ alpha: measuredTargets.chat, beta: measuredTargets.rabbit }}
        onPanelOpenChange={setDevHudExpanded}
        onSpeedChange={setSpeedPercent}
      />
      <div className="relative z-10 flex h-full min-h-0 w-full flex-col pt-4">
        <nav className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 px-4">
          <Link
            className="text-sm text-muted-foreground transition-colors select-none hover:text-foreground"
            href="/sandbox/prototypes"
          >
            ← Prototypes
          </Link>
          <Link
            className="text-sm text-muted-foreground transition-colors select-none hover:text-foreground"
            href="/sandbox/prototypes/morphs"
          >
            Morph input demo
          </Link>
        </nav>
        <header
          className={cn(
            "shrink-0 px-4 pt-4 text-center",
            devHudExpanded ? "pr-[min(18rem,100vw-1rem)] sm:pr-4" : "pr-4"
          )}
        >
          <h1 className="font-commissioner text-2xl font-light tracking-tight text-foreground">
            Morph: chat thread ↔ rabbit-hole article
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Center bounds use{" "}
            <code className="rounded bg-muted/50 px-1 py-0.5 text-xs">
              @organic-llm/morph-physics
            </code>
            ; rails use Framer slide.{" "}
            <span className="hidden sm:inline">
              <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
                Shift
              </kbd>
              {" + "}
              <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-xs">
                Tab
              </kbd>{" "}
              or the button.
            </span>
            <span className="sm:hidden">Use the button.</span> At the{" "}
            <code className="rounded bg-muted/50 px-1 py-0.5 text-xs">lg</code> breakpoint and
            above, the ghost grid uses{" "}
            <code className="rounded bg-muted/50 px-1 py-0.5 text-xs">{layoutTokens.gridCols}</code>
            .
          </p>
        </header>

        <div
          ref={stageRef}
          className="relative mt-4 min-h-[min(72vh,680px)] w-full flex-1 px-2 sm:px-4"
        >
          {/* Ghost: chat — centered reading column */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-0">
            <div className="flex h-full justify-center px-3 pt-6">
              <div ref={chatMeasureRef} className="w-full max-w-4xl min-w-0">
                <Conversation
                  className={cn(
                    "flex h-[min(58vh,560px)] max-h-[560px] min-h-0 w-full flex-col overflow-hidden"
                  )}
                >
                  <ChatThread className="min-h-0 flex-1" messages={MORPH_CHAT_RABBIT_MESSAGES} />
                </Conversation>
              </div>
            </div>
          </div>

          {/* Ghost: rabbit — production grid, measure center column only */}
          <div aria-hidden className="pointer-events-none absolute inset-0 z-0 opacity-0">
            <div
              className={cn(
                "mx-auto grid h-full w-full max-w-7xl grid-cols-1 gap-8 px-3 pt-6",
                layoutTokens.gridCols
              )}
            >
              <aside className="min-w-0 lg:col-start-1">
                <RabbitHolePathRail
                  activeNodeId={sessionForRails.activeNodeId}
                  session={sessionForRails}
                  onNodeClick={setActiveNodeId}
                />
              </aside>
              <div ref={rabbitMeasureRef} className="min-w-0 lg:col-start-2">
                {centerArticle}
              </div>
              <aside className="min-w-0 lg:col-start-3">{demoRightRail}</aside>
            </div>
          </div>

          {/* Visible rails (outside morph elementRef) */}
          <div className="pointer-events-none absolute inset-0 z-10 hidden lg:block">
            <motion.aside
              animate={{ x: layout === "rabbit" ? "0%" : "-115%" }}
              className={cn(
                "absolute top-6 left-3 w-[260px] max-w-[260px]",
                layout === "rabbit" ? "pointer-events-auto" : "pointer-events-none"
              )}
              initial={false}
              transition={RAIL_TRANSITION}
            >
              <RabbitHolePathRail
                activeNodeId={sessionForRails.activeNodeId}
                generatingNodeId={null}
                session={sessionForRails}
                onNodeClick={setActiveNodeId}
              />
            </motion.aside>
            <motion.aside
              animate={{ x: layout === "rabbit" ? "0%" : "115%" }}
              className={cn(
                "absolute top-6 right-3 w-[260px] max-w-[260px]",
                layout === "rabbit" ? "pointer-events-auto" : "pointer-events-none"
              )}
              initial={false}
              transition={RAIL_TRANSITION}
            >
              <AnimatePresence>
                {layout === "rabbit" ? (
                  <motion.div
                    key="morph-rh-right"
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                  >
                    {demoRightRail}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.aside>
          </div>

          <div
            ref={elementRef}
            className={cn(
              "pointer-events-auto absolute top-0 left-0 z-20 overflow-hidden rounded-xl",
              "border border-border/20 bg-background/80 shadow-sm backdrop-blur-sm",
              "will-change-[transform,width,height]"
            )}
          >
            {layout === "chat" ? (
              <div className="flex h-full min-h-0 flex-col">
                <Conversation className="flex h-full min-h-0 flex-col overflow-hidden">
                  <ChatThread className="min-h-0 flex-1" messages={MORPH_CHAT_RABBIT_MESSAGES} />
                </Conversation>
              </div>
            ) : (
              <div className="h-full min-h-0 overflow-y-auto px-2 py-2">{centerArticle}</div>
            )}
          </div>
        </div>

        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
          <Button
            className="pointer-events-auto shadow-lg"
            type="button"
            variant="secondary"
            onClick={onToggleMorph}
          >
            {layout === "chat" ? "Morph to rabbit-hole view" : "Morph to chat view"}
          </Button>
        </div>
      </div>
    </Page>
  );
}
