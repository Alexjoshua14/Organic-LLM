"use client";

import type { PromptFieldBlock, PromptSuggestion } from "@/lib/schemas/gen-ui";

import { useEffect, useState } from "react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type PromptFieldProps = {
  block: PromptFieldBlock;
  partial?: boolean;
  /** Host receives the draft when the user taps Use. */
  onUse?: (text: string) => void;
};

function suggestionKey(s: PromptSuggestion): string {
  return `${s.label}:${s.insertionText}`;
}

/** True when this suggestion's text is already present as its own paragraph (or the whole draft). */
export function promptSuggestionApplied(value: string, insertionText: string): boolean {
  const needle = insertionText.trim();

  if (!needle) return false;

  return value
    .split(/\n\n+/)
    .map((part) => part.trim())
    .includes(needle);
}

/**
 * Toggle a suggestion into the draft as its own paragraph. Second click removes that paragraph
 * instead of stacking another copy.
 */
export function togglePromptSuggestion(value: string, insertionText: string): string {
  const needle = insertionText.trim();

  if (!needle) return value;

  const parts = value
    .split(/\n\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.includes(needle)) {
    return parts.filter((part) => part !== needle).join("\n\n");
  }

  return parts.length === 0 ? needle : `${parts.join("\n\n")}\n\n${needle}`;
}

export function PromptField({ block, onUse }: PromptFieldProps) {
  const [value, setValue] = useState(block.default);

  useEffect(() => {
    setValue(block.default);
  }, [block.default]);

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={block.placeholder ?? "Write a prompt…"}
        rows={6}
        className={cn(
          "w-full min-h-32 resize-y rounded-xl border border-border/50 bg-background/40 p-inset-md",
          "text-sm text-foreground placeholder:text-muted-foreground/60",
          FOCUS
        )}
      />

      {block.suggestions.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Suggestions">
          {block.suggestions.map((s) => {
            const on = promptSuggestionApplied(value, s.insertionText);

            return (
              <button
                key={suggestionKey(s)}
                type="button"
                aria-pressed={on}
                onClick={() => setValue((prev) => togglePromptSuggestion(prev, s.insertionText))}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  on
                    ? "border-accent bg-accent/15 text-foreground"
                    : "border-border/50 text-muted-foreground hover:bg-muted/50",
                  FOCUS
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      ) : null}

      {onUse ? (
        <button
          type="button"
          disabled={!value.trim()}
          onClick={() => onUse(value)}
          className={cn(
            "min-h-11 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground",
            "disabled:opacity-40",
            FOCUS
          )}
        >
          Use prompt
        </button>
      ) : null}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
