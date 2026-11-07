"use client";

import type { AnswerCardBlock } from "@/lib/schemas/gen-ui";

import { GenUIMarkdown } from "@/components/chat/gen-ui/GenUIMarkdown";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type AnswerCardProps = {
  block: AnswerCardBlock;
  partial?: boolean;
};

/**
 * Reads like the chat reply around it: one body size and colour, a heading, a lead paragraph,
 * a plain bullet list, and headed sections that are always visible. No tinted boxes, eyebrow
 * labels, or accordions: structure comes from type weight and spacing, as in markdown.
 * Confidence, sources, and caveats are plain muted text after the answer.
 */
export function AnswerCard({ block, partial }: AnswerCardProps) {
  const footer = block.footer;
  const sources = footer?.sources ?? [];

  return (
    <div
      className={cn(
        "text-base leading-snug text-foreground sm:leading-normal",
        spacing.card.section
      )}
    >
      {typeof block.title === "string" && block.title ? (
        <h3 className="text-lg font-semibold leading-snug">
          <GenUIMarkdown inline>{block.title}</GenUIMarkdown>
        </h3>
      ) : null}

      {partial && !block.tldr ? (
        <div className="h-5 w-4/5 animate-pulse rounded bg-muted/40" />
      ) : (
        <p className="font-medium">
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
        <div className="space-y-2">
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

      {footer ? (
        <footer className={cn("text-sm text-muted-foreground", spacing.card.labelStack)}>
          <p>
            {footer.confidence ? (
              <span className="capitalize">{footer.confidence} confidence</span>
            ) : null}
            {footer.confidence && sources.length > 0 ? " · " : null}
            {sources.length > 0 ? "Sources: " : null}
            {sources.map((src, i) => (
              <span key={i}>
                {i > 0 ? ", " : null}
                {src.url ? (
                  <a
                    href={src.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent underline-offset-2 hover:underline"
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
