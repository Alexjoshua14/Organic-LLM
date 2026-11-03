"use client";

import type { CSSProperties } from "react";
import type { ArcadiaSubagent } from "@/lib/arcadia/multitask/types";

import { useRef } from "react";

import styles from "./state-selector.module.css";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

const STATES = [
  { value: "idle", label: "Idle" },
  { value: "working", label: "Working" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
] as const;

/** Sliding glass selection from Stratum's code-dive review form. */
export function StateSelector({
  value,
  onChange,
}: {
  value: ArcadiaSubagent["status"];
  onChange: (value: ArcadiaSubagent["status"]) => void;
}) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const selected = STATES.findIndex((state) => state.value === value);
  const move = (index: number) => {
    const next = (index + STATES.length) % STATES.length;

    onChange(STATES[next].value);
    buttons.current[next]?.focus();
  };

  return (
    <div
      aria-label="State"
      className={styles.selector}
      role="radiogroup"
      style={{ "--count": STATES.length, "--index": selected } as CSSProperties}
    >
      <span aria-hidden className={cn(glass({ chip: true }), styles.glass)} />
      {STATES.map((state, index) => (
        <button
          key={state.value}
          ref={(node) => {
            buttons.current[index] = node;
          }}
          aria-checked={index === selected}
          className={styles.option}
          role="radio"
          tabIndex={index === selected ? 0 : -1}
          type="button"
          onClick={() => onChange(state.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              move(index + 1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              move(index - 1);
            } else if (event.key === "Home" || event.key === "End") {
              event.preventDefault();
              move(event.key === "Home" ? 0 : STATES.length - 1);
            }
          }}
        >
          {state.label}
        </button>
      ))}
    </div>
  );
}
