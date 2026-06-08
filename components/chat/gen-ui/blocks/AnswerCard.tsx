"use client";

import type { AnswerCardBlock } from "@/lib/schemas/gen-ui";
import { cn } from "@/lib/utils";

const CONFIDENCE_CALLOUT: Record<
  NonNullable<AnswerCardBlock["footer"]>["confidence"] | "default",
  string
> = {
  high: "border-emerald-500/30 bg-emerald-500/10",
  medium: "border-amber-500/30 bg-amber-500/10",
  low: "border-red-500/30 bg-red-500/10",
  default: "border-border/50 bg-background-tertiary/30",
};

const CONFIDENCE_PILL: Record<NonNullable<AnswerCardBlock["footer"]>["confidence"], string> = {
  high: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  low: "bg-red-500/15 text-red-700 dark:text-red-300",
};

const VISIBLE_KEY_POINTS = 5;

type AnswerCardProps = {
  block: AnswerCardBlock;
  partial?: boolean;
};

export function AnswerCard({ block, partial }: AnswerCardProps) {
  const confidence = block.footer?.confidence;
  const calloutClass = CONFIDENCE_CALLOUT[confidence ?? "default"] ?? CONFIDENCE_CALLOUT.default;

  const visible = block.keyPoints.slice(0, VISIBLE_KEY_POINTS);
  const overflow = block.keyPoints.slice(VISIBLE_KEY_POINTS);

  return (
    <div className="space-y-3">
      {partial && !block.tldr ? (
        <div className="h-14 rounded-lg bg-muted/40 animate-pulse" />
      ) : (
        <div className={cn("rounded-lg border px-3 py-2.5 text-sm", calloutClass)}>
          <span className="font-medium text-foreground/80">TL;DR</span>
          <p className="mt-1 text-foreground leading-snug">{block.tldr}</p>
        </div>
      )}

      {block.keyPoints.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            Key points
          </p>
          <ul className="space-y-1 text-sm text-foreground list-disc pl-4">
            {visible.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
          {overflow.length > 0 ? (
            <details className="mt-2 text-sm">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Show more ({overflow.length})
              </summary>
              <ul className="mt-1 space-y-1 list-disc pl-4 text-foreground">
                {overflow.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : partial ? (
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-muted/40 animate-pulse" />
          <div className="h-3 w-4/5 rounded bg-muted/40 animate-pulse" />
        </div>
      ) : null}

      {block.sections?.map((section, i) => (
        <details
          key={i}
          className="rounded-lg border border-border/40 bg-background-tertiary/20 px-3 py-2"
          open={section.defaultOpen}
        >
          <summary className="cursor-pointer font-medium text-sm text-foreground">
            {section.heading}
          </summary>
          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">{section.body}</p>
        </details>
      ))}

      {block.footer ? (
        <footer className="flex flex-wrap items-center gap-2 pt-1 border-t border-border/30">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium capitalize",
              CONFIDENCE_PILL[block.footer.confidence]
            )}
          >
            {block.footer.confidence} confidence
          </span>
          {block.footer.sources?.map((src, i) =>
            src.url ? (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-border/50 bg-background-tertiary/40 px-2 py-0.5 text-[11px] text-foreground hover:bg-background-tertiary/70"
              >
                {src.label}
              </a>
            ) : (
              <span
                key={i}
                className="rounded-full border border-border/50 bg-background-tertiary/40 px-2 py-0.5 text-[11px] text-muted-foreground"
              >
                {src.label}
              </span>
            )
          )}
          {block.footer.caveats?.map((c, i) => (
            <p key={i} className="w-full text-xs text-muted-foreground italic">
              {c}
            </p>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
