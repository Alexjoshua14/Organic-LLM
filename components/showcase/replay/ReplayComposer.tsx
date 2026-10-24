"use client";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

type ReplayComposerProps = {
  text: string;
  className?: string;
  /** Show blinking caret while typing. */
  showCaret?: boolean;
};

/**
 * Glass lookalike composer for showcase replays.
 * Intentionally not CoreInput — that component reads/writes user preferences.
 */
export function ReplayComposer({ text, className, showCaret = true }: ReplayComposerProps) {
  const typing = showCaret && text.length > 0;

  return (
    <div
      aria-hidden
      className={cn(
        "rounded-2xl border border-border/60 px-3 py-2.5 shadow-sm",
        glass({ border: "none", opaque: true }),
        className
      )}
    >
      <p className="min-h-[1.25rem] text-sm leading-relaxed text-foreground/90">
        {text.length > 0 ? (
          text
        ) : (
          <span className="text-muted-foreground/55">What do you want to explore?</span>
        )}
        {typing ? (
          <span
            aria-hidden
            className="ml-px inline-block w-px animate-pulse bg-foreground/70 align-[-0.1em]"
            style={{ height: "1em" }}
          />
        ) : null}
      </p>
      <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/40 pt-2">
        <span className="rounded-full border border-border/50 bg-background-tertiary/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Arcadia · Ergon
        </span>
        <span className="text-[10px] text-muted-foreground/60">Scripted replay</span>
      </div>
    </div>
  );
}
