"use client";

import type { CSSProperties, ReactNode } from "react";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Layers3, MessageSquare, X } from "lucide-react";

import { MultitaskComposerSlotProvider } from "./multitask-composer-slot";
import { MultitaskSidebarGate } from "./multitask-sidebar-gate";
import {
  MULTITASK_FOCUS_WIDTH_MS,
  MULTITASK_PANEL_EASE,
  MULTITASK_PANEL_ENTER_MS,
  MULTITASK_PANEL_EXIT_MS,
} from "./multitask-panel-timing";
import { useArcadiaMultitask } from "./multitask-provider";
import { runAnchoredLayoutChange } from "./multitask-scroll-anchor";
import { SendTargetPicker } from "./send-target-picker";
import { SubagentCard } from "./subagent-card";
import { SubagentDetail } from "./subagent-detail";
import { SubagentSwipeRow } from "./subagent-swipe-row";
import { useMultitaskCondensed } from "./use-multitask-condensed";
import { VoiceRosterLegend } from "./voice-roster-legend";

import { glass } from "@/components/design-system/primitives";
import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import {
  isArcadiaSubagentRunning,
  MULTITASK_DASHBOARD_WIDE_MIN_PX,
  MULTITASK_DESKTOP_GUTTER_PX,
  MULTITASK_DESKTOP_PAD_BOTTOM_PX,
  MULTITASK_DESKTOP_PAD_TOP_PX,
  MULTITASK_DESKTOP_PAD_X_PX,
} from "@/lib/arcadia/multitask/layout-mode";
import {
  multitaskShortcutAction,
  resolveMultitaskPanelShares,
  type MultitaskPanelFocus,
} from "@/lib/arcadia/multitask/panel-layout";
import { resolveSpeakBarPhase } from "@/lib/arcadia/multitask/speak-session";
import { cn } from "@/lib/utils";

type MultitaskDashboardProps = {
  children: ReactNode;
  /**
   * When false, render only the chat slot (same tree path) so toggling multitask
   * does not remount Arcadia Chat / CoreInput.
   */
  enabled?: boolean;
};

/**
 * User-toggled multiagent layout.
 *
 * Condensed (&lt; {@link MULTITASK_DASHBOARD_WIDE_MIN_PX}): chat keeps the full page so CoreInput
 * stays where it is in plain Arcadia, and subagents ride a swipe row just above the composer.
 * With chat hidden, the full board takes the page. Wide: chat beside board with focus shares,
 * Ctrl+Q/W panel slides, scroll eye-line pin.
 */
export function MultitaskDashboard({ children, enabled = true }: MultitaskDashboardProps) {
  const voice = useVoiceSessionOptional();
  const reduceMotion = useReducedMotion();
  const condensed = useMultitaskCondensed();
  const {
    agents,
    orchestratorThreadId,
    viewingSubagentId,
    selected,
    selectedId,
    liveSpeakAgentId,
    closingSpeakAgentId,
    chatOpen,
    setChatOpen,
    shellOpen,
    setShellOpen,
    selectAgent,
    speakTo,
    endSpeak,
    sendTarget,
    setSendTarget,
    toggleMultitaskView,
    toggleBlockedReason,
  } = useArcadiaMultitask();

  const [panelFocus, setPanelFocus] = useState<MultitaskPanelFocus>("orchestrator");
  const [chatMeasurePx, setChatMeasurePx] = useState<number | null>(null);
  const [boardMeasurePx, setBoardMeasurePx] = useState<number | null>(null);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const chatMeasureRef = useRef<HTMLDivElement | null>(null);
  const boardMeasureRef = useRef<HTMLDivElement | null>(null);
  const measureUnlockTimer = useRef<number | null>(null);

  const speakDisabled = !voice;
  const runningCount = agents.filter(isArcadiaSubagentRunning).length;
  const voicePhase = voice?.phase ?? "idle";
  const voiceConnecting = Boolean(voice?.connecting);
  const voiceConnected = Boolean(voice?.connected);
  const startedAt = voice?.startedAt ?? null;
  const localStream = voice?.localStream ?? null;
  const remoteStream = voice?.remoteStream ?? null;

  const shares = useMemo(
    () =>
      resolveMultitaskPanelShares({
        chatOpen,
        boardOpen: shellOpen,
        focus: panelFocus,
      }),
    [chatOpen, shellOpen, panelFocus]
  );

  const freezeReadingMeasures = useCallback(() => {
    const chatW = chatMeasureRef.current?.offsetWidth;
    const boardW = boardMeasureRef.current?.offsetWidth;

    if (chatW && chatW > 0) setChatMeasurePx(chatW);
    if (boardW && boardW > 0) setBoardMeasurePx(boardW);

    if (measureUnlockTimer.current != null) {
      window.clearTimeout(measureUnlockTimer.current);
    }

    const unlockMs = reduceMotion
      ? 0
      : Math.max(MULTITASK_PANEL_ENTER_MS, MULTITASK_FOCUS_WIDTH_MS) + 40;

    measureUnlockTimer.current = window.setTimeout(() => {
      setChatMeasurePx(null);
      setBoardMeasurePx(null);
      measureUnlockTimer.current = null;
    }, unlockMs);
  }, [reduceMotion]);

  const runPanelChange = useCallback(
    (apply: () => void, durationMs: number) => {
      freezeReadingMeasures();
      runAnchoredLayoutChange({
        scrollEls: [chatScrollRef.current, boardScrollRef.current],
        durationMs: reduceMotion ? 0 : durationMs,
        reducedMotion: !!reduceMotion,
        apply,
      });
    },
    [freezeReadingMeasures, reduceMotion]
  );

  const toggleChat = useCallback(() => {
    const next = !chatOpen;
    const duration = reduceMotion ? 0 : next ? MULTITASK_PANEL_ENTER_MS : MULTITASK_PANEL_EXIT_MS;

    runPanelChange(() => setChatOpen(next), duration);
  }, [chatOpen, reduceMotion, runPanelChange, setChatOpen]);

  const toggleBoard = useCallback(() => {
    const next = !shellOpen;
    const duration = reduceMotion ? 0 : next ? MULTITASK_PANEL_ENTER_MS : MULTITASK_PANEL_EXIT_MS;

    runPanelChange(() => setShellOpen(next), duration);
  }, [reduceMotion, runPanelChange, setShellOpen, shellOpen]);

  // Focus share shift — pin scroll, freeze measure, then update focus.
  const setFocusAnchored = useCallback(
    (next: MultitaskPanelFocus) => {
      if (next === panelFocus) return;
      runPanelChange(() => setPanelFocus(next), reduceMotion ? 0 : MULTITASK_FOCUS_WIDTH_MS);
    },
    [panelFocus, reduceMotion, runPanelChange]
  );

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const action = multitaskShortcutAction(event);

      if (!action) return;

      event.preventDefault();
      event.stopPropagation();

      if (action === "toggle-chat") toggleChat();
      else toggleBoard();
    };

    window.addEventListener("keydown", onKeyDown, true);

    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled, toggleBoard, toggleChat]);

  useEffect(() => {
    return () => {
      if (measureUnlockTimer.current != null) {
        window.clearTimeout(measureUnlockTimer.current);
      }
    };
  }, []);

  const panelTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: MULTITASK_PANEL_ENTER_MS / 1000,
        ease: MULTITASK_PANEL_EASE,
      };

  const exitTransition = reduceMotion
    ? { duration: 0 }
    : {
        duration: MULTITASK_PANEL_EXIT_MS / 1000,
        ease: MULTITASK_PANEL_EASE,
      };

  const bothOpen = chatOpen && shellOpen;
  // Condensed with chat open: the board becomes the swipe row above CoreInput.
  const swipeRowActive = enabled && condensed && bothOpen;
  const speakPhaseFor = (agentId: string) =>
    resolveSpeakBarPhase({
      agentId,
      liveAgentId: liveSpeakAgentId,
      closingAgentId: closingSpeakAgentId,
      voiceConnecting,
      voiceConnected,
    });
  const targetedAgentId = sendTarget.kind === "subagent" ? sendTarget.agentId : null;
  const swipeRow = swipeRowActive ? (
    <SubagentSwipeRow
      agents={agents}
      collapsible
      speakDisabled={speakDisabled}
      speakPhaseFor={speakPhaseFor}
      targetedAgentId={viewingSubagentId ? null : targetedAgentId}
      onEndSpeak={endSpeak}
      onSpeakTo={(agentId) => void speakTo(agentId)}
      onTarget={(agentId) =>
        setSendTarget(
          targetedAgentId === agentId ? { kind: "orchestrator" } : { kind: "subagent", agentId }
        )
      }
    />
  ) : null;
  const wideGridStyle: CSSProperties = bothOpen
    ? {
        gridTemplateColumns: `minmax(0, ${shares.chat}fr) minmax(0, ${shares.board}fr)`,
        gap: MULTITASK_DESKTOP_GUTTER_PX,
        transition: reduceMotion
          ? undefined
          : `grid-template-columns ${MULTITASK_FOCUS_WIDTH_MS}ms cubic-bezier(${MULTITASK_PANEL_EASE.join(",")})`,
      }
    : {
        gridTemplateColumns: "minmax(0, 1fr)",
        gap: 0,
      };

  /**
   * Chat slot stays at a fixed tree path whether dashboard chrome is on or Ctrl+Q
   * hides the panel — remounting would race blank-chat auto-delete and reset useChat.
   */
  const chatSlot = (
    <div
      ref={chatMeasureRef}
      className={cn(
        "relative min-h-0 h-full [&_[data-arcadia-chat-root]]:h-full",
        !enabled && "w-full"
      )}
      data-multitask-scroll-anchor="orchestrator-thread"
      style={
        enabled && chatMeasurePx != null
          ? { width: chatMeasurePx, maxWidth: "100%", marginInline: "auto" }
          : undefined
      }
    >
      <MultitaskComposerSlotProvider slot={swipeRow}>{children}</MultitaskComposerSlotProvider>
    </div>
  );

  return (
    <div
      className={cn("h-full min-h-0 w-full", enabled && "flex flex-col overflow-x-hidden")}
      data-multitask-enabled={enabled ? "true" : "false"}
      style={
        enabled
          ? ({
              ["--multitask-wide-min" as string]: `${MULTITASK_DASHBOARD_WIDE_MIN_PX}px`,
              ["--multitask-pad-top" as string]: condensed
                ? "4px"
                : `${MULTITASK_DESKTOP_PAD_TOP_PX}px`,
              // Condensed: chat runs edge to edge like plain Arcadia; only the header is inset.
              ["--multitask-pad-x" as string]: condensed
                ? "0px"
                : `${MULTITASK_DESKTOP_PAD_X_PX}px`,
              ["--multitask-pad-bottom" as string]: `${MULTITASK_DESKTOP_PAD_BOTTOM_PX}px`,
              ["--multitask-gutter" as string]: `${MULTITASK_DESKTOP_GUTTER_PX}px`,
              paddingTop: "max(var(--multitask-pad-top), env(safe-area-inset-top, 0px))",
              paddingLeft: "var(--multitask-pad-x)",
              paddingRight: "var(--multitask-pad-x)",
              paddingBottom: condensed ? 0 : "var(--multitask-pad-bottom)",
            } as CSSProperties)
          : undefined
      }
    >
      {enabled ? <MultitaskSidebarGate dashboardOpen /> : null}

      {enabled ? (
        <header
          className={cn(
            "flex shrink-0 justify-between gap-2",
            condensed ? "items-center px-4 pb-1" : "items-start pb-3"
          )}
        >
          <div className="min-w-0 flex-1 pr-2">
            <h1 className="truncate text-sm font-semibold tracking-tight">
              {condensed ? "Multiagent" : "Multitask dashboard"}
            </h1>
            <p className="truncate text-[11px] text-muted-foreground">
              {runningCount} running{!condensed ? " · Ctrl+Q chat · Ctrl+W agents" : ""}
            </p>
            {toggleBlockedReason ? (
              <p className="mt-0.5 text-[11px] text-amber-800 dark:text-amber-200">
                {toggleBlockedReason}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2">
            {condensed ? (
              <div
                aria-label="Multiagent view"
                className="flex rounded-full border border-border/50 bg-background/60 p-0.5"
                role="group"
              >
                <button
                  aria-pressed={chatOpen}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                    chatOpen
                      ? "bg-background-secondary font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                  type="button"
                  onClick={() =>
                    runPanelChange(() => {
                      setChatOpen(true);
                      setShellOpen(true);
                    }, 0)
                  }
                >
                  Chat
                </button>
                <button
                  aria-pressed={!chatOpen}
                  className={cn(
                    "min-h-10 rounded-full px-3 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                    !chatOpen
                      ? "bg-background-secondary font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                  type="button"
                  onClick={() =>
                    runPanelChange(() => {
                      setChatOpen(false);
                      setShellOpen(true);
                    }, 0)
                  }
                >
                  Agents
                </button>
              </div>
            ) : (
              <>
                <button
                  aria-expanded={chatOpen}
                  className={cn(
                    glass({ tone: "brown", opaque: true }),
                    "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1.5 text-xs font-medium"
                  )}
                  title="Toggle orchestrator chat (Ctrl+Q)"
                  type="button"
                  onClick={toggleChat}
                >
                  <MessageSquare aria-hidden className="size-3.5" />
                  {chatOpen ? "Hide chat" : "Show chat"}
                </button>
                <button
                  aria-expanded={shellOpen}
                  className={cn(
                    glass({ tone: "brown", opaque: true }),
                    "inline-flex items-center gap-1.5 rounded-full border border-border/60 px-2.5 py-1.5 text-xs font-medium"
                  )}
                  title="Toggle subagent board (Ctrl+W)"
                  type="button"
                  onClick={toggleBoard}
                >
                  <Layers3 aria-hidden className="size-3.5" />
                  {shellOpen ? "Hide board" : "Show board"}
                </button>
              </>
            )}
            <button
              aria-label="Exit multiagent view"
              className={cn(
                glass({ opaque: true }),
                "inline-flex items-center justify-center gap-1 rounded-full border border-border/60 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                condensed ? "size-11" : "px-2.5 py-1.5"
              )}
              type="button"
              onClick={() => void toggleMultitaskView()}
            >
              <X aria-hidden className="size-3.5" />
              {!condensed ? "Exit" : null}
            </button>
          </div>
        </header>
      ) : null}

      <div
        className={cn(
          enabled
            ? cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden gap-3",
                "lg:grid lg:transition-[grid-template-columns] lg:duration-200"
              )
            : "h-full min-h-0"
        )}
        style={enabled ? wideGridStyle : undefined}
      >
        <section
          aria-hidden={enabled && !chatOpen ? true : undefined}
          aria-label={enabled ? "Confined orchestrator chat" : undefined}
          className={cn(
            enabled
              ? cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden",
                  !condensed &&
                    cn(
                      glass({ tone: "brown", opaque: true }),
                      "rounded-2xl border border-border/40"
                    ),
                  "lg:min-w-0",
                  !chatOpen && "hidden"
                )
              : "h-full min-h-0"
          )}
          onFocusCapture={enabled ? () => setFocusAnchored("orchestrator") : undefined}
          onPointerDownCapture={enabled ? () => setFocusAnchored("orchestrator") : undefined}
        >
          {enabled ? (
            <div
              className={cn(
                "shrink-0 border-b border-border/30 bg-background/95",
                condensed ? "px-4" : "p-3"
              )}
            >
              {viewingSubagentId ? (
                <Link
                  className="text-xs underline underline-offset-4"
                  href={`/sandbox/arcadia/${orchestratorThreadId}`}
                >
                  Back to orchestrator
                </Link>
              ) : (
                <SendTargetPicker
                  agents={agents}
                  compact={condensed}
                  sendTarget={sendTarget}
                  onChange={setSendTarget}
                />
              )}
            </div>
          ) : null}
          {/*
            Reading column measure freezes during width/slide so text does not reflow
            under the eye-line. Extra pane width becomes gutter, not a moving column.
          */}
          <div
            ref={chatScrollRef}
            className={cn(
              enabled
                ? "relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
                : "h-full min-h-0"
            )}
          >
            {chatSlot}
          </div>
        </section>

        {enabled ? (
          <AnimatePresence initial={false} mode="popLayout">
            {shellOpen && !swipeRowActive ? (
              <motion.section
                key="subagent-board"
                animate={{ x: 0, opacity: 1 }}
                aria-label="Subagent board"
                className="min-h-0 flex-1 overflow-hidden lg:min-w-0 lg:h-full"
                exit={{
                  x: reduceMotion ? 0 : "12%",
                  opacity: 0,
                  transition: exitTransition,
                }}
                initial={{ x: reduceMotion ? 0 : "12%", opacity: 0 }}
                transition={panelTransition}
                onFocusCapture={() => setFocusAnchored("subagent")}
                onPointerDownCapture={() => setFocusAnchored("subagent")}
              >
                <div
                  ref={boardScrollRef}
                  className="h-full min-h-0 overflow-y-auto overscroll-contain"
                >
                  <div
                    ref={boardMeasureRef}
                    className="space-y-4 pb-2"
                    data-multitask-scroll-anchor="subagent-board"
                    style={
                      boardMeasurePx != null
                        ? { width: boardMeasurePx, maxWidth: "100%", marginInline: "auto" }
                        : undefined
                    }
                  >
                    {agents.map((agent) => {
                      const speakPhase = resolveSpeakBarPhase({
                        agentId: agent.id,
                        liveAgentId: liveSpeakAgentId,
                        closingAgentId: closingSpeakAgentId,
                        voiceConnecting,
                        voiceConnected,
                      });

                      return (
                        <SubagentCard
                          key={agent.id}
                          agent={agent}
                          localStream={liveSpeakAgentId === agent.id ? localStream : null}
                          remoteStream={liveSpeakAgentId === agent.id ? remoteStream : null}
                          selected={selectedId === agent.id}
                          speakDisabled={speakDisabled && speakPhase === "idle"}
                          speakPhase={speakPhase}
                          startedAt={liveSpeakAgentId === agent.id ? startedAt : null}
                          voicePhase={voicePhase}
                          onEndSpeak={endSpeak}
                          onSelect={() => selectAgent(agent.id)}
                          onSpeakTo={() => void speakTo(agent.id)}
                        />
                      );
                    })}
                    {selected ? (
                      <SubagentDetail
                        agent={selected}
                        localStream={liveSpeakAgentId === selected.id ? localStream : null}
                        remoteStream={liveSpeakAgentId === selected.id ? remoteStream : null}
                        speakDisabled={
                          speakDisabled &&
                          resolveSpeakBarPhase({
                            agentId: selected.id,
                            liveAgentId: liveSpeakAgentId,
                            closingAgentId: closingSpeakAgentId,
                            voiceConnecting,
                            voiceConnected,
                          }) === "idle"
                        }
                        speakPhase={resolveSpeakBarPhase({
                          agentId: selected.id,
                          liveAgentId: liveSpeakAgentId,
                          closingAgentId: closingSpeakAgentId,
                          voiceConnecting,
                          voiceConnected,
                        })}
                        startedAt={liveSpeakAgentId === selected.id ? startedAt : null}
                        voicePhase={voicePhase}
                        onClose={() => selectAgent(null)}
                        onEndSpeak={endSpeak}
                        onSpeakTo={() => void speakTo(selected.id)}
                      />
                    ) : (
                      <p className="px-1 text-xs text-muted-foreground">
                        Tap a subagent to open their thread, or Speak to start a Realtime session.
                      </p>
                    )}
                    <VoiceRosterLegend />
                  </div>
                </div>
              </motion.section>
            ) : null}
          </AnimatePresence>
        ) : null}
      </div>
    </div>
  );
}
