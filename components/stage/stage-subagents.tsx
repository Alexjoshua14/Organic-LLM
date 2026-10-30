"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { Square } from "lucide-react";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { stageAgentReservations } from "@/lib/stage/layout";
import {
  STAGE_SUBAGENT_RECT,
  STAGE_CHILD_RECTS,
  emptyStageState,
  type StageState,
  type StageSubagent,
} from "@/lib/stage/schema";

// Functional presence stays brief; exit settles and clears faster than entry.
const CHILD_ENTER_SECONDS = 0.22;
const CHILD_EXIT_SECONDS = 0.14;

type Cancel = (id: string) => Promise<void>;

function Child({
  agent,
  slot,
  onCancel,
}: {
  agent: StageSubagent;
  slot: number;
  onCancel: Cancel;
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
      style={{
        gridColumn: `${STAGE_CHILD_RECTS[slot].x - STAGE_SUBAGENT_RECT.x + 1} / span ${STAGE_CHILD_RECTS[slot].w}`,
        gridRow: "1 / span 8",
      }}
      initial={reducedMotion ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        y: reducedMotion ? 0 : 3,
        transition: { duration: reducedMotion ? 0 : CHILD_EXIT_SECONDS },
      }}
      transition={{ duration: reducedMotion ? 0 : CHILD_ENTER_SECONDS, ease: "easeOut" }}
    >
      <OrganicActivityMark
        seed={agent.id}
        size="sm"
        state={!present ? "complete" : agent.status === "working" ? "working" : "waiting"}
      />
      <div className="stage-subagent-copy">
        <span>{agent.name}</span>
        <span role="status">{status}</span>
        <p title={agent.goal}>{agent.goal}</p>
      </div>
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
}: {
  agents: StageSubagent[];
  design?: StageState["design"];
  onCancel: Cancel;
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
      style={{
        gridColumn: `${STAGE_SUBAGENT_RECT.x + 1} / span ${STAGE_SUBAGENT_RECT.w}`,
        gridRow: `${STAGE_SUBAGENT_RECT.y + 1} / span ${STAGE_SUBAGENT_RECT.h}`,
      }}
      data-active={active.length > 0 || settling}
      data-children={active.length}
    >
      <AnimatePresence
        onExitComplete={() => {
          if (!active.length) setSettling(false);
        }}
      >
        {active.map(({ agent, slot }) => (
          <Child key={agent.id} agent={agent} slot={slot} onCancel={onCancel} />
        ))}
      </AnimatePresence>
    </div>
  );
}
