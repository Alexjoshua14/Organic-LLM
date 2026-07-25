"use client";

import { glass } from "@/components/design-system/primitives";
import type { SpeakModalities } from "@/lib/schemas/speak-modalities";
import { cn } from "@/lib/utils";

const TOGGLES: Array<{ key: keyof SpeakModalities; label: string; hint: string }> = [
  { key: "text", label: "Text", hint: "Captions & transcript" },
  { key: "genUi", label: "GenUI", hint: "Structured cards" },
  { key: "web", label: "Web", hint: "Page preview" },
];

export function SpeakModalityToggles({
  value,
  onChange,
  disabled,
}: {
  value: SpeakModalities;
  onChange: (next: SpeakModalities) => void;
  disabled?: boolean;
}) {
  return (
    <div className={cn(glass({ border: "all" }), "flex flex-wrap items-center gap-1 rounded-2xl p-1")}>
      <span className="px-2 text-[10px] uppercase tracking-wide text-muted-foreground">
        Voice
      </span>
      {TOGGLES.map((t) => {
        const on = value[t.key];

        return (
          <button
            key={t.key}
            aria-pressed={on}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs transition-colors",
              on
                ? "bg-white/15 text-foreground"
                : "text-muted-foreground hover:text-foreground",
              disabled && "opacity-60"
            )}
            disabled={disabled}
            title={disabled ? "End session to change modalities" : t.hint}
            type="button"
            onClick={() => onChange({ ...value, [t.key]: !on })}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
