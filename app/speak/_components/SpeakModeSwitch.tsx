"use client";

import { AudioLines, BookOpenText } from "lucide-react";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

export type SpeakMode = "live" | "read";

const MODES: Array<{ id: SpeakMode; label: string; Icon: typeof AudioLines }> = [
  { id: "live", label: "Live", Icon: AudioLines },
  { id: "read", label: "Read aloud", Icon: BookOpenText },
];

/** Live call vs. read-aloud. The same control, in the same place, in both modes. */
export function SpeakModeSwitch({
  mode,
  onChange,
}: {
  mode: SpeakMode;
  onChange: (next: SpeakMode) => void;
}) {
  return (
    <div
      aria-label="Speak mode"
      className={cn(glass({ border: "all" }), "flex h-11 items-center rounded-full p-1")}
      role="group"
    >
      {MODES.map(({ id, label, Icon }) => {
        const active = id === mode;

        return (
          <button
            key={id}
            aria-pressed={active}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-full px-inset-md text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-foreground/[0.1] font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            type="button"
            onClick={() => {
              if (!active) onChange(id);
            }}
          >
            <Icon aria-hidden className="size-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
