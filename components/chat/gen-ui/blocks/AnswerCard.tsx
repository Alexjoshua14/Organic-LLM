"use client";

import type { AnswerCardBlock } from "@/lib/schemas/gen-ui";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type AnswerCardProps = {
  block: AnswerCardBlock;
  partial?: boolean;
  condensed?: boolean;
};

type Confidence = NonNullable<AnswerCardBlock["footer"]>["confidence"];

const CONFIDENCE_LEVEL: Record<Confidence, number> = { low: 1, medium: 2, high: 3 };
/** Key points shown as pills before the rest fold behind a disclosure. */
const CONDENSED_POINTS = 3;

/** Three-step meter; the word beside it carries the meaning, the bars make it glanceable. */
function ConfidenceMeter({ confidence }: { confidence: Confidence }) {
  const level = CONFIDENCE_LEVEL[confidence];

  return (
    <span className="inline-flex items-center gap-inline-xs">
      <span aria-hidden className="inline-flex items-center gap-0.5">
        {[1, 2, 3].map((step) => (
          <span
            key={step}
            className={cn(
              "h-1.5 w-3 rounded-full",
              step <= level ? "bg-foreground/70" : "bg-muted-foreground/25"
            )}
          />
        ))}
      </span>
      <span className="capitalize">{confidence} confidence</span>
    </span>
  );
}

function KeyPointPills({ points, start }: { points: readonly string[]; start: number }) {
  return (
    <ol className="flex flex-wrap gap-inline-xs" aria-label="Key points" start={start + 1}>
      {points.map((point, i) => (
        <li
          key={i}
          className="inline-flex max-w-full items-start gap-inline-xs rounded-lg bg-muted/40 py-0.5 pl-0.5 pr-inset-sm text-xs leading-snug"
        >
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded-full bg-background text-2xs font-medium tabular-nums text-muted-foreground"
          >
            {start + i + 1}
          </span>
          <span className="min-w-0 line-clamp-2">
            <GenUIMarkdown inline>{point}</GenUIMarkdown>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Condensed: the TL;DR leads, key points become numbered pills, confidence a small meter. */
function AnswerCardCondensed({ block, partial }: Omit<AnswerCardProps, "condensed">) {
  const footer = block.footer;
  const sources = footer?.sources ?? [];
  const caveats = footer?.caveats ?? [];
  const visible = block.keyPoints.slice(0, CONDENSED_POINTS);
  const rest = block.keyPoints.slice(CONDENSED_POINTS);
  const footerSummary = [
    sources.length ? `${sources.length} ${sources.length === 1 ? "source" : "sources"}` : null,
    caveats.length ? `${caveats.length} ${caveats.length === 1 ? "caveat" : "caveats"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={cn("text-sm leading-snug text-foreground break-words", spacing.card.blockItems)}>
      <div className={spacing.card.labelStack}>
        {typeof block.title === "string" && block.title ? (
          <h3 className="text-xs font-semibold text-muted-foreground">
            <GenUIMarkdown inline>{block.title}</GenUIMarkdown>
          </h3>
        ) : null}
        {partial && !block.tldr ? (
          <div className="h-5 w-4/5 animate-pulse rounded bg-muted/40" />
        ) : (
          <p className="text-pretty text-base font-medium leading-snug">
            <GenUIMarkdown inline>{block.tldr}</GenUIMarkdown>
          </p>
        )}
      </div>

      {visible.length ? <KeyPointPills points={visible} start={0} /> : null}
      {rest.length ? (
        <details>
          <summary className="organic-focus w-fit cursor-pointer text-xs font-medium text-muted-foreground">
            +{rest.length} more key {rest.length === 1 ? "point" : "points"}
          </summary>
          <div className="mt-stack-xs">
            <KeyPointPills points={rest} start={CONDENSED_POINTS} />
          </div>
        </details>
      ) : null}

      {footer ? (
        <div className="flex flex-wrap items-center gap-x-inline-md gap-y-stack-xs text-xs text-muted-foreground">
          <ConfidenceMeter confidence={footer.confidence} />
          {footerSummary ? (
            <details className="min-w-0">
              <summary className="organic-focus cursor-pointer">{footerSummary}</summary>
              <div className={cn("mt-stack-xs", spacing.card.listItems)}>
                {sources.length ? (
                  <ul className="flex flex-wrap gap-x-inline-sm gap-y-stack-xs" aria-label="Sources">
                    {sources.map((src, i) => (
                      <li key={i}>
                        {src.url ? (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="organic-focus text-accent underline underline-offset-2"
                          >
                            {src.label}
                          </a>
                        ) : (
                          src.label
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {caveats.map((c, i) => (
                  <p key={i}>
                    <GenUIMarkdown inline>{c}</GenUIMarkdown>
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reads like the chat reply around it: one body size and colour, a heading, a lead paragraph,
 * a plain bullet list, and headed sections that are always visible. No tinted boxes, eyebrow
 * labels, or accordions: structure comes from type weight and spacing, as in markdown.
 * Sources and caveats are small muted text after the answer. Confidence is only stated when it
 * is medium or low: "high confidence" tells the reader nothing the answer doesn't.
 */
export function AnswerCard({ block, partial, condensed = false }: AnswerCardProps) {
  if (condensed) return <AnswerCardCondensed block={block} partial={partial} />;

  const footer = block.footer;
  const sources = footer?.sources ?? [];
  const confidence = footer && footer.confidence !== "high" ? footer.confidence : null;
  const hasFooter = Boolean(confidence || sources.length || footer?.caveats?.length);

  return (
    <div
      className={cn(
        "text-base leading-snug text-foreground break-words sm:leading-normal",
        spacing.card.section
      )}
    >
      {typeof block.title === "string" && block.title ? (
        <h3 className="text-balance text-lg font-semibold leading-snug">
          <GenUIMarkdown inline>{block.title}</GenUIMarkdown>
        </h3>
      ) : null}

      {partial && !block.tldr ? (
        <div className="h-5 w-4/5 animate-pulse rounded bg-muted/40" />
      ) : (
        <p className="text-pretty font-medium">
          <GenUIMarkdown inline>{block.tldr}</GenUIMarkdown>
        </p>
      )}

      {block.keyPoints.length > 0 ? (
        // All points show: the schema caps them at 7, so the list never needs collapsing.
        <ul
          className={cn("list-disc pl-5 marker:text-muted-foreground/60", spacing.card.listItems)}
        >
          {block.keyPoints.map((p, i) => (
            <li key={i} className="pl-0.5">
              <GenUIMarkdown inline>{p}</GenUIMarkdown>
            </li>
          ))}
        </ul>
      ) : partial ? (
        <div className="space-y-stack-sm">
          <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-muted/40" />
        </div>
      ) : null}

      {block.sections?.map((section, i) => (
        <section key={i} className={spacing.card.labelStack}>
          {typeof section.heading === "string" && section.heading ? (
            <h4 className="font-semibold">
              <GenUIMarkdown inline>{section.heading}</GenUIMarkdown>
            </h4>
          ) : null}
          <GenUIMarkdown>{section.body}</GenUIMarkdown>
        </section>
      ))}

      {footer && hasFooter ? (
        <footer className={cn("text-xs text-muted-foreground", spacing.card.labelStack)}>
          <p>
            {confidence ? <span className="capitalize">{confidence} confidence</span> : null}
            {confidence && sources.length > 0 ? " · " : null}
            {sources.length > 0 ? "Sources: " : null}
            {sources.map((src, i) => (
              <span key={i}>
                {i > 0 ? ", " : null}
                {src.url ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline max-sm:underline max-sm:decoration-accent/40 pointer-coarse:inline-block pointer-coarse:py-1.5"
                  >
                    {src.label}
                  </a>
                ) : (
                  src.label
                )}
              </span>
            ))}
          </p>
          {footer.caveats?.map((c, i) => (
            <p key={i}>
              <GenUIMarkdown inline>{c}</GenUIMarkdown>
            </p>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
