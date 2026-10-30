"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "framer-motion";
import { Square } from "lucide-react";

import { OrganicActivityMark } from "@/components/agents/organic-activity-mark";
import { stageSubagentActive, type StageSubagent } from "@/lib/stage/schema";

// Functional presence stays brief; exit settles and clears faster than entry.
const CHILD_ENTER_SECONDS = 0.22;
const CHILD_EXIT_SECONDS = 0.14;

type Cancel = (id: string) => Promise<void>;

function Child({ agent, onCancel }: { agent: StageSubagent; onCancel: Cancel }) {
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
  onCancel,
}: {
  agents: StageSubagent[];
  onCancel: Cancel;
}) {
  const active = agents.filter(stageSubagentActive);
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
      <AnimatePresence
        onExitComplete={() => {
          if (!active.length) setSettling(false);
        }}
      >
        {active.map((agent) => (
          <Child key={agent.id} agent={agent} onCancel={onCancel} />
        ))}
      </AnimatePresence>
    </div>
  );
}
