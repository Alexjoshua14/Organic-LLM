"use client";

import type { ErgonView } from "@/lib/ergon/types";

import clsx from "clsx";

const VIEW_OPTIONS: { id: ErgonView; label: string }[] = [
  { id: "plan", label: "Plan" },
  { id: "list", label: "List" },
  { id: "done", label: "Done" },
];

type ErgonViewSwitcherProps = {
  value: ErgonView;
  onChange: (view: ErgonView) => void;
  className?: string;
};

export function ErgonViewSwitcher({ value, onChange, className }: ErgonViewSwitcherProps) {
  return (
    <div
      aria-label="Ergon view"
      className={clsx(
        "inline-flex rounded-lg border border-border/60 bg-muted/30 p-0.5",
        className
      )}
      role="group"
    >
      {VIEW_OPTIONS.map(({ id, label }) => {
        const selected = value === id;

        return (
          <button
            key={id}
            aria-pressed={selected}
            className={clsx(
              "min-w-0 flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors sm:flex-none sm:px-3 sm:text-sm",
              "hover:bg-muted/60 hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              selected && "bg-background text-foreground shadow-sm"
            )}
            type="button"
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
