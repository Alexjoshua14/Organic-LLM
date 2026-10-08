"use client";

import type { ArcadiaMultitaskSpeakBinding } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type {
  ArcadiaMultitaskLayoutMode,
  ArcadiaMultitaskSendTarget,
} from "@/lib/arcadia/multitask/layout-mode";
import type { MultitaskInboundDispatch } from "@/lib/schemas/thought-routing";
import type { WorkerAwarenessEvent } from "@/lib/schemas/subagent-runtime";
import type { UIMessage } from "ai";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { SPEAK_BAR_HANDOFF_CLOSING_MS } from "./subagent-speak-bar-timing";

import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { getSettings } from "@/lib/user-settings";
import { useBackgroundProbe } from "@/hooks/use-background-probe";
import {
  diffBoardForSpeak,
  mergeSubagentBoard,
  SUBAGENT_BOARD_POLL_ACTIVE_MS,
  SUBAGENT_BOARD_POLL_IDLE_MS,
  type SubagentBoardPayload,
} from "@/lib/arcadia/multitask/board-sync";
import { createDemoSubagents, DEMO_PROGRESS_SCRIPT } from "@/lib/arcadia/multitask/demo-roster";
import {
  applyAssignedGoalsToRoster,
  applyWorkerAwarenessToSubagent,
} from "@/lib/arcadia/multitask/apply-awareness";
import { subagentToSpeakSeed } from "@/lib/arcadia/multitask/format-seed";
import {
  canToggleArcadiaMultitaskView,
  DEFAULT_MULTITASK_SEND_TARGET,
  MULTITASK_VIEW_POLL_MS,
  resolveArcadiaMultitaskLayoutMode,
} from "@/lib/arcadia/multitask/layout-mode";
import { planSpeakHandoff, resolveLiveSpeakAgentId } from "@/lib/arcadia/multitask/speak-session";
import {
  MULTITASK_VIEW_BROADCAST_CHANNEL,
  multitaskViewStorageKey,
  parseMultitaskViewStored,
  readMultitaskViewLocal,
  writeMultitaskViewLocal,
  type MultitaskViewSyncPayload,
} from "@/lib/arcadia/multitask/view-sync";

const TICK_MS = 9_000;

type HeartbeatNoticeListener = (message: UIMessage) => void;

type ArcadiaMultitaskValue = {
  /** Thread on screen — the orchestrator's or one subagent's. */
  threadId: string;
  /** Orchestrator that owns the board; equals `threadId` unless a subagent thread is open. */
  orchestratorThreadId: string;
  /** Set when the open thread is a subagent's own thread. */
  viewingSubagentId: string | null;
  agents: ArcadiaSubagent[];
  selectedId: string | null;
  selected: ArcadiaSubagent | null;
  speakBinding: ArcadiaMultitaskSpeakBinding | null;
  /** Previous live agent during a brief handoff exit animation. */
  closingSpeakAgentId: string | null;
  /** Agent id owning connecting/live Speak (at most one). */
  liveSpeakAgentId: string | null;
  /** Orchestrator chat panel (Ctrl+Q). */
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  /** Subagent board / thread panel (Ctrl+W). */
  shellOpen: boolean;
  setShellOpen: (open: boolean) => void;
  selectAgent: (id: string | null) => void;
  speakTo: (agentId: string) => Promise<void>;
  endSpeak: () => void;
  tickDemo: () => void;
  /** Apply live worker awareness from the chat stream onto roster cards. */
  applyAwarenessEvent: (event: WorkerAwarenessEvent) => void;
  /** Adopt assigned goals from orchestrator dispatch onto matching roster slots. */
  applyInboundDispatch: (dispatch: MultitaskInboundDispatch) => void;
  /** Re-read subagent threads now (after a send, or a heartbeat). */
  refreshBoard: () => void;
  /** Jev heartbeat system messages posted into the orchestrator's thread. */
  subscribeHeartbeatNotices: (listener: HeartbeatNoticeListener) => () => void;
  layoutMode: ArcadiaMultitaskLayoutMode;
  multitaskViewEnabled: boolean;
  /** Attempt to flip the per-thread multitask view. No-op / false when streaming. */
  toggleMultitaskView: () => Promise<boolean>;
  toggleBlockedReason: string | null;
  sendTarget: ArcadiaMultitaskSendTarget;
  setSendTarget: (next: ArcadiaMultitaskSendTarget) => void;
};

const ArcadiaMultitaskContext = createContext<ArcadiaMultitaskValue | null>(null);

function nextMilestoneId(): string {
  return `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

type ProviderProps = {
  threadId: string;
  /** Parent orchestrator when `threadId` is a subagent thread. */
  orchestratorThreadId?: string;
  /** Roster slot of the subagent whose thread is open, if any. */
  viewingSubagentId?: string | null;
  /** Server-hydrated flag when available; default off. */
  initialMultitaskView?: boolean;
  children: ReactNode;
};

/**
 * Owns the sandbox multitask roster, per-thread view toggle, and Speak bridges.
 */
export function ArcadiaMultitaskProvider({
  threadId,
  orchestratorThreadId: orchestratorThreadIdProp,
  viewingSubagentId = null,
  initialMultitaskView = false,
  children,
}: ProviderProps) {
  // The board, view flag, and heartbeat all belong to the orchestrator, so a subagent thread
  // shows its siblings and keeps the dashboard the user had open.
  const orchestratorThreadId = orchestratorThreadIdProp ?? threadId;
  const voice = useVoiceSessionOptional();
  const [agents, setAgents] = useState<ArcadiaSubagent[]>(() => createDemoSubagents());
  const [selectedId, setSelectedId] = useState<string | null>(viewingSubagentId);
  const heartbeatListenersRef = useRef(new Set<HeartbeatNoticeListener>());
  const boardRefreshRef = useRef<() => void>(() => undefined);
  const [chatOpen, setChatOpen] = useState(true);
  const [shellOpen, setShellOpen] = useState(true);
  const [speakBinding, setSpeakBinding] = useState<ArcadiaMultitaskSpeakBinding | null>(null);
  const [closingSpeakAgentId, setClosingSpeakAgentId] = useState<string | null>(null);
  const [sendTarget, setSendTarget] = useState<ArcadiaMultitaskSendTarget>(
    DEFAULT_MULTITASK_SEND_TARGET
  );
  const closingTimerRef = useRef<number | null>(null);
  const speakInFlightRef = useRef(false);
  const [multitaskViewEnabled, setMultitaskViewEnabled] = useState(() => {
    if (typeof window === "undefined") return initialMultitaskView;

    try {
      const raw = window.localStorage.getItem(multitaskViewStorageKey(orchestratorThreadId));

      if (raw != null) return readMultitaskViewLocal(orchestratorThreadId);
    } catch {
      /* ignore */
    }

    return initialMultitaskView;
  });
  const [toggleBlockedReason, setToggleBlockedReason] = useState<string | null>(null);
  const scriptIndexRef = useRef<Record<string, number>>({});
  const speakBindingRef = useRef(speakBinding);
  const agentsRef = useRef(agents);
  const enabledRef = useRef(multitaskViewEnabled);

  speakBindingRef.current = speakBinding;
  agentsRef.current = agents;
  enabledRef.current = multitaskViewEnabled;

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? null,
    [agents, selectedId]
  );

  const layoutMode = useMemo(
    () => resolveArcadiaMultitaskLayoutMode(multitaskViewEnabled),
    [multitaskViewEnabled]
  );

  const applyEnabled = useCallback((enabled: boolean) => {
    enabledRef.current = enabled;
    setMultitaskViewEnabled(enabled);
  }, []);

  // Same-browser tabs: storage + BroadcastChannel.
  useEffect(() => {
    const onStorage = (ev: StorageEvent) => {
      if (ev.key !== multitaskViewStorageKey(orchestratorThreadId) || ev.newValue == null) return;
      const parsed = parseMultitaskViewStored(ev.newValue);

      if (parsed && parsed.threadId === orchestratorThreadId) {
        applyEnabled(parsed.enabled);
      }
    };

    window.addEventListener("storage", onStorage);

    let channel: BroadcastChannel | null = null;

    try {
      channel = new BroadcastChannel(MULTITASK_VIEW_BROADCAST_CHANNEL);
      channel.onmessage = (ev: MessageEvent<MultitaskViewSyncPayload>) => {
        const data = ev.data;

        if (data?.threadId === orchestratorThreadId && typeof data.enabled === "boolean") {
          applyEnabled(data.enabled);
        }
      };
    } catch {
      channel = null;
    }

    return () => {
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, [orchestratorThreadId, applyEnabled]);

  // Cross-device / hydrate: short poll while this thread page is open.
  useEffect(() => {
    let cancelled = false;

    const pull = async () => {
      try {
        const res = await fetch(`/api/chat/${orchestratorThreadId}/arcadia/multitask-view`, {
          credentials: "include",
        });

        if (!res.ok || cancelled) return;

        const data = (await res.json()) as { enabled?: boolean };

        if (typeof data.enabled === "boolean" && data.enabled !== enabledRef.current) {
          writeMultitaskViewLocal(orchestratorThreadId, data.enabled);
          applyEnabled(data.enabled);
        }
      } catch {
        /* offline — keep local */
      }
    };

    void pull();
    const id = window.setInterval(() => void pull(), MULTITASK_VIEW_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [orchestratorThreadId, applyEnabled]);

  const liveSpeakAgentId = useMemo(
    () => resolveLiveSpeakAgentId({ speakBindingAgentId: speakBinding?.agentId }),
    [speakBinding?.agentId]
  );

  // Multitask owns the in-card glass bar — hide the global host drawer while a session is live.
  useEffect(() => {
    if (!voice) return;

    const suppress = multitaskViewEnabled && liveSpeakAgentId !== null;

    voice.setSuppressHostBar(suppress);

    return () => voice.setSuppressHostBar(false);
  }, [voice, multitaskViewEnabled, liveSpeakAgentId]);

  useEffect(() => {
    if (!voice) return;
    if (speakInFlightRef.current) return;
    if (!voice.connected && !voice.connecting) {
      setSpeakBinding(null);
    }
  }, [voice, voice?.connected, voice?.connecting]);

  useEffect(() => {
    return () => {
      if (closingTimerRef.current != null) {
        window.clearTimeout(closingTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (sendTarget.kind !== "subagent") return;
    if (!agents.some((a) => a.id === sendTarget.agentId)) {
      setSendTarget(DEFAULT_MULTITASK_SEND_TARGET);
    }
  }, [agents, sendTarget]);

  const pushSpeakUpdate = useCallback(
    async (agent: ArcadiaSubagent, update: { progress: string; milestone?: string }) => {
      const binding = speakBindingRef.current;

      if (!voice?.connected || !binding || binding.agentId !== agent.id) return;

      if (update.milestone) {
        await voice.sendSubagentMilestone({
          agentId: agent.id,
          role: agent.role,
          name: agent.name,
          milestone: update.milestone,
          progress: update.progress,
        });
      } else {
        await voice.sendSubagentProgress({
          agentId: agent.id,
          role: agent.role,
          name: agent.name,
          progress: update.progress,
        });
      }
    },
    [voice]
  );

  const tickDemo = useCallback(() => {
    setAgents((prev) => {
      return prev.map((agent) => {
        const script = DEMO_PROGRESS_SCRIPT[agent.id];

        if (!script?.length) return agent;

        const idx = scriptIndexRef.current[agent.id] ?? 0;

        if (idx >= script.length) return agent;

        const step = script[idx]!;

        scriptIndexRef.current[agent.id] = idx + 1;

        const milestones = step.milestone
          ? [...agent.milestones, { id: nextMilestoneId(), label: step.milestone, at: Date.now() }]
          : agent.milestones;

        const updated: ArcadiaSubagent = {
          ...agent,
          progress: step.progress,
          progressPct: step.progressPct,
          status: step.status ?? agent.status,
          milestones,
        };

        void pushSpeakUpdate(updated, {
          progress: step.progress,
          milestone: step.milestone,
        });

        return updated;
      });
    });
  }, [pushSpeakUpdate]);

  const applyAwarenessEvent = useCallback(
    (event: WorkerAwarenessEvent) => {
      setAgents((prev) => {
        const next = prev.map((agent) => applyWorkerAwarenessToSubagent(agent, event));
        const updated = next.find((a) => a.id === event.agentId);

        if (updated) {
          if (event.kind === "milestone") {
            void pushSpeakUpdate(updated, {
              progress: updated.progress,
              milestone: event.milestone.label,
            });
          } else if (event.kind === "progress" || event.kind === "completion") {
            void pushSpeakUpdate(updated, { progress: updated.progress });
          } else if (event.kind === "failure") {
            void pushSpeakUpdate(updated, { progress: event.error });
          }
        }

        return next;
      });
    },
    [pushSpeakUpdate]
  );

  const applyInboundDispatch = useCallback((dispatch: MultitaskInboundDispatch) => {
    const goals = dispatch.assignedGoals ?? [];
    if (goals.length === 0) return;
    setAgents((prev) => applyAssignedGoalsToRoster(prev, goals));
    // Goal rows are written before the orchestrator streams, so the board can pick them up now.
    boardRefreshRef.current();
  }, []);

  // Subagents run after the orchestrator's stream closes; their state reaches the board here.
  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const schedule = () => {
      if (cancelled) return;
      if (timer != null) window.clearTimeout(timer);
      const running = agentsRef.current.some((a) => a.status === "working");

      timer = window.setTimeout(
        () => void pull(),
        running ? SUBAGENT_BOARD_POLL_ACTIVE_MS : SUBAGENT_BOARD_POLL_IDLE_MS
      );
    };

    const pull = async () => {
      if (document.visibilityState !== "visible") {
        schedule();

        return;
      }

      try {
        const res = await fetch(`/api/chat/${orchestratorThreadId}/arcadia/subagents`, {
          credentials: "include",
          cache: "no-store",
        });

        if (res.ok && !cancelled) {
          const payload = (await res.json()) as SubagentBoardPayload;
          const prev = agentsRef.current;
          const next = mergeSubagentBoard(prev, payload.subagents ?? []);

          agentsRef.current = next;
          setAgents(next);

          for (const update of diffBoardForSpeak(prev, next)) {
            const agent = next.find((a) => a.id === update.agentId);

            if (agent) {
              void pushSpeakUpdate(agent, { progress: update.progress, milestone: update.milestone });
            }
          }
        }
      } catch {
        /* offline — keep the last board */
      }

      schedule();
    };

    boardRefreshRef.current = () => void pull();
    void pull();

    return () => {
      cancelled = true;
      if (timer != null) window.clearTimeout(timer);
      boardRefreshRef.current = () => undefined;
    };
  }, [orchestratorThreadId, pushSpeakUpdate]);

  const refreshBoard = useCallback(() => boardRefreshRef.current(), []);

  const subscribeHeartbeatNotices = useCallback((listener: HeartbeatNoticeListener) => {
    const listeners = heartbeatListenersRef.current;

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  const hasSubagentThreads = agents.some((a) => Boolean(a.threadId));

  // Jev heartbeat on the user's Background activity cadence while this thread family is in view.
  useBackgroundProbe({
    key: `subagent-heartbeat:${orchestratorThreadId}`,
    enabled: hasSubagentThreads,
    probe: async () => {
      const res = await fetch(`/api/chat/${orchestratorThreadId}/arcadia/heartbeat`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { zeroDataRetention: getSettings().zeroDataRetention, memory: true } }),
      });

      if (!res.ok) return;

      const outcome = (await res.json()) as { status: string; message?: UIMessage };

      if (outcome.status === "notable" && outcome.message) {
        for (const listener of heartbeatListenersRef.current) listener(outcome.message);
        boardRefreshRef.current();
      }
    },
  });

  useEffect(() => {
    if (!multitaskViewEnabled) return;
    // Demo script emptied — live runs feed cards via applyAwarenessEvent.
    if (Object.keys(DEMO_PROGRESS_SCRIPT).length === 0) return;

    const id = window.setInterval(() => tickDemo(), TICK_MS);

    return () => window.clearInterval(id);
  }, [multitaskViewEnabled, tickDemo]);

  const selectAgent = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) {
      setSendTarget({ kind: "subagent", agentId: id });
    }
  }, []);

  const endSpeak = useCallback(() => {
    void voice?.disconnect();
    setSpeakBinding(null);
  }, [voice]);

  const speakTo = useCallback(
    async (agentId: string) => {
      const agent = agentsRef.current.find((a) => a.id === agentId);

      if (!agent || !voice) return;

      const handoff = planSpeakHandoff({
        liveAgentId: resolveLiveSpeakAgentId({
          speakBindingAgentId: speakBindingRef.current?.agentId,
        }),
        nextAgentId: agentId,
      });

      if (handoff.outgoingAgentId) {
        if (closingTimerRef.current != null) {
          window.clearTimeout(closingTimerRef.current);
        }
        setClosingSpeakAgentId(handoff.outgoingAgentId);
        closingTimerRef.current = window.setTimeout(() => {
          setClosingSpeakAgentId(null);
          closingTimerRef.current = null;
        }, SPEAK_BAR_HANDOFF_CLOSING_MS);
      }

      setSelectedId(agentId);
      setSendTarget({ kind: "subagent", agentId });
      setShellOpen(true);
      // Bind before connect so the glass bar morphs idle → connecting on this card.
      setSpeakBinding({ agentId: agent.id, sessionStartedAt: Date.now() });
      speakInFlightRef.current = true;

      try {
        const seed = subagentToSpeakSeed(agent);

        await voice.speakToSubagent(seed);
      } finally {
        speakInFlightRef.current = false;
        if (!voice.connected && !voice.connecting) {
          setSpeakBinding(null);
        }
      }
    },
    [voice]
  );

  const toggleMultitaskView = useCallback(async (): Promise<boolean> => {
    setToggleBlockedReason(null);

    let activeStreamId: string | null = null;

    try {
      const res = await fetch(`/api/chat/${orchestratorThreadId}/arcadia/multitask-view`, {
        credentials: "include",
      });

      if (res.ok) {
        const data = (await res.json()) as { activeStreamId?: string | null };

        activeStreamId = data.activeStreamId ?? null;
      }
    } catch {
      /* fall through — PATCH will re-check */
    }

    if (!canToggleArcadiaMultitaskView({ activeStreamId })) {
      setToggleBlockedReason("Wait until this thread finishes streaming.");

      return false;
    }

    const next = !enabledRef.current;

    // Same-browser first.
    writeMultitaskViewLocal(orchestratorThreadId, next);
    applyEnabled(next);

    try {
      const res = await fetch(`/api/chat/${orchestratorThreadId}/arcadia/multitask-view`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });

      if (res.status === 409) {
        // Stream started under us — revert local.
        writeMultitaskViewLocal(orchestratorThreadId, !next);
        applyEnabled(!next);
        setToggleBlockedReason("Wait until this thread finishes streaming.");

        return false;
      }

      if (!res.ok) {
        // Keep local optimistic value; poll may reconcile.
        return true;
      }
    } catch {
      return true;
    }

    return true;
  }, [orchestratorThreadId, applyEnabled]);

  const value = useMemo<ArcadiaMultitaskValue>(
    () => ({
      threadId,
      orchestratorThreadId,
      viewingSubagentId,
      agents,
      selectedId,
      selected,
      speakBinding,
      closingSpeakAgentId,
      liveSpeakAgentId,
      chatOpen,
      setChatOpen,
      shellOpen,
      setShellOpen,
      selectAgent,
      speakTo,
      endSpeak,
      tickDemo,
      applyAwarenessEvent,
      applyInboundDispatch,
      refreshBoard,
      subscribeHeartbeatNotices,
      layoutMode,
      multitaskViewEnabled,
      toggleMultitaskView,
      toggleBlockedReason,
      sendTarget,
      setSendTarget,
    }),
    [
      threadId,
      orchestratorThreadId,
      viewingSubagentId,
      agents,
      selectedId,
      selected,
      speakBinding,
      closingSpeakAgentId,
      liveSpeakAgentId,
      chatOpen,
      shellOpen,
      selectAgent,
      speakTo,
      endSpeak,
      tickDemo,
      applyAwarenessEvent,
      applyInboundDispatch,
      refreshBoard,
      subscribeHeartbeatNotices,
      layoutMode,
      multitaskViewEnabled,
      toggleMultitaskView,
      toggleBlockedReason,
      sendTarget,
    ]
  );

  return (
    <ArcadiaMultitaskContext.Provider value={value}>{children}</ArcadiaMultitaskContext.Provider>
  );
}

export function useArcadiaMultitask(): ArcadiaMultitaskValue {
  const ctx = useContext(ArcadiaMultitaskContext);

  if (!ctx) {
    throw new Error("useArcadiaMultitask must be used within ArcadiaMultitaskProvider");
  }

  return ctx;
}

export function useArcadiaMultitaskOptional(): ArcadiaMultitaskValue | null {
  return useContext(ArcadiaMultitaskContext);
}
