"use client";

import type { ArcadiaMultitaskSendTarget } from "@/lib/arcadia/multitask/layout-mode";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import {
  SEND_TARGET_ENTER_MS,
  SEND_TARGET_EXIT_MS,
  SEND_TARGET_EASE,
} from "./send-target-picker-motion";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type SendTargetPickerProps = {
  agents: ArcadiaSubagent[];
  sendTarget: ArcadiaMultitaskSendTarget;
  onChange: (next: ArcadiaMultitaskSendTarget) => void;
  className?: string;
};

/** Stable roster slots fan out from the same left edge, regardless of the current target. */
export function SendTargetPicker({
  agents,
  sendTarget,
  onChange,
  className,
}: SendTargetPickerProps) {
  const [expanded, setExpanded] = useState(false);
  const [offsets, setOffsets] = useState<Record<string, number>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>());
  const rowId = useId();
  const reduceMotion = useReducedMotion();
  const targets = useMemo(
    () => [
      { id: "orchestrator", name: "Orchestrator", target: { kind: "orchestrator" } as const },
      ...agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        target: { kind: "subagent", agentId: agent.id } as const,
      })),
    ],
    [agents]
  );
  const activeId = sendTarget.kind === "orchestrator" ? "orchestrator" : sendTarget.agentId;

  useLayoutEffect(() => {
    const measure = () => {
      const next = Object.fromEntries(
        targets.map(({ id }) => [id, buttonRefs.current.get(id)?.offsetLeft ?? 0])
      );

      setOffsets((previous) =>
        targets.every(({ id }) => previous[id] === next[id]) ? previous : next
      );
    };

    measure();

    const observer = new ResizeObserver(measure);

    for (const button of buttonRefs.current.values()) observer.observe(button);

    return () => observer.disconnect();
  }, [targets]);

  useLayoutEffect(() => {
    if (!expanded && rootRef.current) rootRef.current.scrollLeft = 0;
  }, [expanded]);

  useEffect(() => {
    if (!expanded) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };

    document.addEventListener("pointerdown", onPointerDown);

    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [expanded]);

  return (
    <div
      ref={rootRef}
      aria-label="Message recipient"
      className={cn(
        "min-w-0 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        expanded ? "overflow-x-auto" : "overflow-x-hidden",
        className
      )}
      role="group"
    >
      <div className="relative flex w-max items-center gap-2" id={rowId}>
        {targets.map(({ id, name, target }) => {
          const active = activeId === id;
          const visible = expanded || active;

          return (
            <motion.button
              key={id}
              ref={(node) => {
                if (node) buttonRefs.current.set(id, node);
                else buttonRefs.current.delete(id);
              }}
              animate={{ x: expanded ? 0 : -(offsets[id] ?? 0), opacity: visible ? 1 : 0 }}
              aria-controls={active ? rowId : undefined}
              aria-expanded={active ? expanded : undefined}
              aria-hidden={!visible}
              aria-pressed={active}
              className={cn(
                glass({ tone: active ? "brown" : "default" }),
                "inline-flex min-h-10 shrink-0 cursor-pointer items-center whitespace-nowrap rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                active ? "z-10 border-amber-800/35 text-foreground" : "text-muted-foreground",
                expanded &&
                  (active
                    ? "hover:border-amber-800/50 hover:bg-background-secondary/45 dark:hover:border-amber-200/25"
                    : "hover:border-border hover:bg-background/45 hover:text-foreground"),
                !visible && "pointer-events-none"
              )}
              initial={false}
              tabIndex={visible ? 0 : -1}
              transition={{
                duration: reduceMotion
                  ? 0
                  : (expanded ? SEND_TARGET_ENTER_MS : SEND_TARGET_EXIT_MS) / 1000,
                ease: SEND_TARGET_EASE,
              }}
              type="button"
              onKeyDown={(event) => {
                if (event.key !== "Escape" || !expanded) return;

                event.preventDefault();
                event.stopPropagation();
                setExpanded(false);
                buttonRefs.current.get(activeId)?.focus();
              }}
              onClick={() => {
                if (active) setExpanded((previous) => !previous);
                else {
                  onChange(target);
                  setExpanded(false);
                }
              }}
            >
              {name}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
