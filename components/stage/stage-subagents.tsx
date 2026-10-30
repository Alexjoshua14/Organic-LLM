"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { Square } from "lucide-react";

import { STAGE_AGENT_GLASS } from "./stage-agent";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { stageAgentReservations } from "@/lib/stage/layout";
import {
  STAGE_CHILD_RECTS,
  emptyStageState,
  type StageState,
  type StageSubagent,
  type StageRect,
} from "@/lib/stage/schema";
import { stageCellStyle } from "@/lib/stage/frame";

// Functional presence stays brief; exit settles and clears faster than entry.
const CHILD_ENTER_SECONDS = 0.22;
const CHILD_EXIT_SECONDS = 0.14;

type Cancel = (id: string) => Promise<void>;

function Child({
  agent,
  slot,
  onCancel,
  onSelect,
  rect,
}: {
  agent: StageSubagent;
  slot: number;
  onCancel: Cancel;
  onSelect?: (id: string) => void;
  rect: StageRect;
}) {
  const present = useIsPresent();
  const reducedMotion = useReducedMotion();
  const status = !present
    ? "Settled"
    : agent.status === "canceling"
      ? "Stopping…"
      : agent.status === "queued"
        ? "Starting…"
        : "Working";

  return (
    <motion.div
      role="group"
      aria-label={`${agent.name}: ${status}`}
      className="stage-subagent"
      data-agent-slot={slot}
      data-agent-id={agent.id}
      style={stageCellStyle(rect)}
      initial={reducedMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reducedMotion ? 0 : 3,
        transition: { duration: reducedMotion ? 0 : CHILD_EXIT_SECONDS },
      }}
      transition={{ duration: reducedMotion ? 0 : CHILD_ENTER_SECONDS, ease: "easeOut" }}
    >
      <button
        className="stage-subagent-identity"
        type="button"
        title={agent.goal}
        aria-label={`View ${agent.name}’s work`}
        onClick={() => onSelect?.(agent.id)}
      >
        <OrganicActivityMark
          className="stage-subagent-mark"
          glassByState={STAGE_AGENT_GLASS}
          seed={agent.id}
          state={!present ? "complete" : agent.status === "working" ? "working" : "waiting"}
        />
        <span className="stage-subagent-name">{agent.name}</span>
      </button>
      <span className="stage-subagent-status" role="status">
        {status}
      </span>
      <button
        aria-label={`Stop ${agent.name}`}
        className="stage-icon-button stage-subagent-stop"
        disabled={!present || agent.status === "canceling"}
        title="Stop this specialist"
        type="button"
        onClick={() => void onCancel(agent.id)}
      >
        <Square aria-hidden size={11} />
      </button>
    </motion.div>
  );
}

export function StageSubagents({
  agents,
  design,
  onCancel,
  onSelect,
  rects = STAGE_CHILD_RECTS,
}: {
  agents: StageSubagent[];
  design?: StageState["design"];
  onCancel: Cancel;
  onSelect?: (id: string) => void;
  rects?: readonly StageRect[];
}) {
  const reservations = stageAgentReservations({
    ...emptyStageState(),
    subagents: agents,
    design: design ?? null,
  }).filter((entry) => entry.kind !== "parent");
  const active = reservations.map((entry) => ({
    slot: entry.slot!,
    agent:
      entry.kind === "designer"
        ? {
            id: entry.id,
            name: "Designer",
            goal: design!.brief,
            status: design!.status === "canceling" ? ("canceling" as const) : ("working" as const),
            startedAt: design!.startedAt,
            result: null,
            memory: false,
            webSearch: false,
          }
        : agents.find((agent) => agent.id === entry.id)!,
  }));
  const [settling, setSettling] = useState(active.length > 0);

  useEffect(() => {
    if (active.length) setSettling(true);
  }, [active.length]);
  if (!active.length && !settling) return null;

  return (
    <div
      aria-label="Organic’s active specialists"
      className="stage-subagent-tree"
      data-active={active.length > 0 || settling}
      data-children={active.length}
    >
      {[0, 1].map((slot) => (
        <AnimatePresence
          key={slot}
          mode="wait"
          onExitComplete={() => {
            if (!active.length) setSettling(false);
          }}
        >
          {active
            .filter((entry) => entry.slot === slot)
            .map(({ agent }) => (
              <Child
                key={agent.id}
                agent={agent}
                slot={slot}
                rect={rects[slot]}
                onCancel={onCancel}
                onSelect={onSelect}
              />
            ))}
        </AnimatePresence>
      ))}
    </div>
  );
}
