"use client";

import type { AnswerCardBlock } from "@/lib/schemas/gen-ui";

import { cn } from "@/lib/utils";

/**
 * Confidence is a quiet meta-signal: a small dot + label in the footer.
 * It deliberately does NOT colour the answer surface — the summary always
 * carries the brand accent so the takeaway, not the metadata, leads the eye.
 */
const CONFIDENCE_DOT: Record<NonNullable<AnswerCardBlock["footer"]>["confidence"], string> = {
  high: "bg-accent",
  medium: "bg-amber-500",
  low: "bg-rose-500",
};

const VISIBLE_KEY_POINTS = 5;

type AnswerCardProps = {
  block: AnswerCardBlock;
  partial?: boolean;
};

function KeyPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="relative pl-5 leading-relaxed">
      <span className="absolute left-1 top-[0.6em] size-1.5 -translate-y-1/2 rounded-full bg-accent/60" />
      {children}
    </li>
  );
}

export function AnswerCard({ block, partial }: AnswerCardProps) {
  const confidence = block.footer?.confidence;

  const visible = block.keyPoints.slice(0, VISIBLE_KEY_POINTS);
  const overflow = block.keyPoints.slice(VISIBLE_KEY_POINTS);

  return (
    <div className="space-y-4">
      {/* Hero summary — the answer leads, in the brand accent, at a readable size. */}
      {partial && !block.tldr ? (
        <div className="h-16 rounded-xl bg-muted/40 animate-pulse" />
      ) : (
        <div className="relative rounded-xl border border-accent/15 bg-accent/[0.05] py-3 pl-5 pr-4">
          <span className="absolute inset-y-3 left-0 w-[3px] rounded-full bg-accent/70" />
          <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-accent/90">
            Summary
          </span>
          <p className="mt-1 text-[0.9375rem] leading-relaxed text-foreground">{block.tldr}</p>
        </div>
      )}

      {block.keyPoints.length > 0 ? (
        <div>
          <p className="mb-2 text-2xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Key points
          </p>
          <ul className="space-y-2 text-sm text-foreground/90">
            {visible.map((p, i) => (
              <KeyPoint key={i}>{p}</KeyPoint>
            ))}
          </ul>
          {overflow.length > 0 ? (
            <details className="group mt-2.5 text-sm">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-accent">
                Show {overflow.length} more
                <span className="transition-transform group-open:rotate-90">›</span>
              </summary>
              <ul className="mt-2 space-y-2 text-foreground/90">
                {overflow.map((p, i) => (
                  <KeyPoint key={i}>{p}</KeyPoint>
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
          className="group rounded-xl border border-border/40 bg-background-tertiary/20 px-3.5 py-2.5"
          open={section.defaultOpen}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium text-foreground">
            {section.heading}
            <span className="text-muted-foreground transition-transform group-open:rotate-90">
              ›
            </span>
          </summary>
          <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {section.body}
          </p>
        </details>
      ))}

      {block.footer ? (
        <footer className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/30 pt-3">
          {confidence ? (
            <span className="inline-flex items-center gap-1.5 text-2xs font-medium capitalize text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", CONFIDENCE_DOT[confidence])} />
              {confidence} confidence
            </span>
          ) : null}
          {block.footer.sources?.length ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {block.footer.sources.map((src, i) =>
                src.url ? (
                  <a
                    key={i}
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-border/50 px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
                  >
                    {src.label}
                  </a>
                ) : (
                  <span
                    key={i}
                    className="rounded-full border border-border/50 px-2 py-0.5 text-2xs text-muted-foreground"
                  >
                    {src.label}
                  </span>
                )
              )}
            </div>
          ) : null}
          {block.footer.caveats?.map((c, i) => (
            <p key={i} className="w-full text-xs italic leading-relaxed text-muted-foreground">
              {c}
            </p>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
