"use client";

import type { RemyMode } from "@/lib/prep";

import clsx from "clsx";

const MODE_OPTIONS: { id: RemyMode; label: string }[] = [
  { id: "week", label: "Week" },
  { id: "library", label: "Library" },
  { id: "shopping", label: "Shopping" },
];

type RemyModeSwitcherProps = {
  value: RemyMode;
  onChange: (mode: RemyMode) => void;
  className?: string;
};

export function RemyModeSwitcher({ value, onChange, className }: RemyModeSwitcherProps) {
  return (
    <div
      aria-label="Remy view"
      className={clsx(
        "inline-flex select-none rounded-lg border border-border/60 bg-muted/30 p-0.5",
        className
      )}
      role="group"
    >
      {MODE_OPTIONS.map(({ id, label }) => {
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
