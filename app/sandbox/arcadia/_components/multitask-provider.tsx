"use client";

import type { ArcadiaMultitaskSpeakBinding } from "@/lib/arcadia/multitask/types";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";
import type {
  ArcadiaMultitaskLayoutMode,
  ArcadiaMultitaskSendTarget,
} from "@/lib/arcadia/multitask/layout-mode";

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

import { useVoiceSessionOptional } from "@/components/voice/voice-session-provider";
import { createDemoSubagents, DEMO_PROGRESS_SCRIPT } from "@/lib/arcadia/multitask/demo-roster";
import { subagentToSpeakSeed } from "@/lib/arcadia/multitask/format-seed";
import {
  DEFAULT_MULTITASK_SEND_TARGET,
  resolveArcadiaMultitaskLayoutMode,
} from "@/lib/arcadia/multitask/layout-mode";

const TICK_MS = 9_000;

type ArcadiaMultitaskValue = {
  agents: ArcadiaSubagent[];
  selectedId: string | null;
  selected: ArcadiaSubagent | null;
  speakBinding: ArcadiaMultitaskSpeakBinding | null;
  shellOpen: boolean;
  setShellOpen: (open: boolean) => void;
  selectAgent: (id: string | null) => void;
  speakTo: (agentId: string) => Promise<void>;
  /** Advance demo scripts once (also runs on an interval while the shell is open). */
  tickDemo: () => void;
  layoutMode: ArcadiaMultitaskLayoutMode;
  sendTarget: ArcadiaMultitaskSendTarget;
  setSendTarget: (next: ArcadiaMultitaskSendTarget) => void;
};

const ArcadiaMultitaskContext = createContext<ArcadiaMultitaskValue | null>(null);

function nextMilestoneId(): string {
  return `ms-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Owns the sandbox multitask roster and bridges progress/milestones into Speak.
 *
 * Data source is the demo roster — not a production swarm. When the user Speak-tos an
 * agent, later ticks for that agent push silent progress or spoken milestones into the
 * open Realtime session.
 */
export function ArcadiaMultitaskProvider({ children }: { children: ReactNode }) {
  const voice = useVoiceSessionOptional();
  const [agents, setAgents] = useState<ArcadiaSubagent[]>(() => createDemoSubagents());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shellOpen, setShellOpen] = useState(true);
  const [speakBinding, setSpeakBinding] = useState<ArcadiaMultitaskSpeakBinding | null>(null);
  const [sendTarget, setSendTarget] = useState<ArcadiaMultitaskSendTarget>(
    DEFAULT_MULTITASK_SEND_TARGET
  );
  const scriptIndexRef = useRef<Record<string, number>>({});
  const speakBindingRef = useRef(speakBinding);
  const agentsRef = useRef(agents);

  speakBindingRef.current = speakBinding;
  agentsRef.current = agents;

  const selected = useMemo(
    () => agents.find((a) => a.id === selectedId) ?? null,
    [agents, selectedId]
  );

  const layoutMode = useMemo(() => resolveArcadiaMultitaskLayoutMode(agents), [agents]);

  // Clear binding when the global Speak session drops.
  useEffect(() => {
    if (!voice?.connected) {
      setSpeakBinding(null);
    }
  }, [voice?.connected]);

  // Drop a stale subagent send target if that agent leaves the roster.
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
      const next = prev.map((agent) => {
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

      return next;
    });
  }, [pushSpeakUpdate]);

  useEffect(() => {
    if (!shellOpen && layoutMode === "overlay") return;

    const id = window.setInterval(() => {
      tickDemo();
    }, TICK_MS);

    return () => window.clearInterval(id);
  }, [shellOpen, layoutMode, tickDemo]);

  const selectAgent = useCallback((id: string | null) => {
    setSelectedId(id);
    if (id) {
      setSendTarget({ kind: "subagent", agentId: id });
    }
  }, []);

  const speakTo = useCallback(
    async (agentId: string) => {
      const agent = agentsRef.current.find((a) => a.id === agentId);

      if (!agent || !voice) return;

      setSelectedId(agentId);
      setSendTarget({ kind: "subagent", agentId });
      setShellOpen(true);

      const seed = subagentToSpeakSeed(agent);

      await voice.speakToSubagent(seed);
      setSpeakBinding({ agentId: agent.id, sessionStartedAt: Date.now() });
    },
    [voice]
  );

  const value = useMemo<ArcadiaMultitaskValue>(
    () => ({
      agents,
      selectedId,
      selected,
      speakBinding,
      shellOpen,
      setShellOpen,
      selectAgent,
      speakTo,
      tickDemo,
      layoutMode,
      sendTarget,
      setSendTarget,
    }),
    [
      agents,
      selectedId,
      selected,
      speakBinding,
      shellOpen,
      selectAgent,
      speakTo,
      tickDemo,
      layoutMode,
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

/** Safe outside the provider (e.g. shared Chat). */
export function useArcadiaMultitaskOptional(): ArcadiaMultitaskValue | null {
  return useContext(ArcadiaMultitaskContext);
}
