"use client";

import type { CompositionBlock, CompositionNode } from "@/lib/schemas/gen-ui/composition";

import { useState } from "react";

import { GrowToggle } from "./GrowToggle";
import { MeasureView } from "./measure/MeasureView";
import { PlanStatusMark, PlanStatusWord } from "./plan/plan-status";

import { useIsMobile } from "@/hooks/use-mobile";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

export type CompositionDensity = "full" | "condensed";

/** Only renders validated data. Native disclosures and links are the only interactions. */
export function CompositionView({
  block,
  density,
}: {
  block: CompositionBlock;
  density?: CompositionDensity;
}) {
  const mobile = useIsMobile();
  const condensed = (density ?? (mobile ? "condensed" : "full")) === "condensed";

  return (
    <article
      className={cn(
        "w-full min-w-0 wrap-anywhere text-sm",
        condensed ? spacing.stack.sm : spacing.card.section
      )}
    >
      <h3 className="text-base font-semibold text-foreground">{block.title}</h3>
      {block.nodes.map((node, index) => (
        <NodeView key={index} node={node} condensed={condensed} />
      ))}
    </article>
  );
}

function NodeView({ node, condensed }: { node: CompositionNode; condensed: boolean }) {
  switch (node.kind) {
    case "heading":
      return <h4 className="text-sm font-semibold text-foreground">{node.text}</h4>;
    case "text":
      return <p className="whitespace-pre-line text-sm leading-relaxed">{node.text}</p>;
    case "list": {
      const List = node.ordered ? "ol" : "ul";
      // A status list's marks are its bullets: no number or disc beside them, and the status word
      // only for assistive tech, since the mark's shape already says it. Order stays in the markup.
      const hasStatus = node.items.some((item) => item.status);
      const gap = condensed ? spacing.card.listItems : spacing.card.blockItems;

      if (hasStatus) {
        return (
          <List className={cn("list-none ps-0", gap)}>
            {node.items.map(({ label, status, detail }, index) => (
              <li key={index} className="flex items-start gap-inline-sm">
                <span className="flex h-lh shrink-0 items-center">
                  {status ? <PlanStatusMark status={status} /> : null}
                </span>
                <span className="min-w-0">
                  {status ? <PlanStatusWord hidden status={status} /> : null}
                  <span>{label}</span>
                  {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
                </span>
              </li>
            ))}
          </List>
        );
      }

      return (
        <List className={cn("ps-inset-lg", node.ordered ? "list-decimal" : "list-disc", gap)}>
          {node.items.map(({ label, detail }, index) => (
            <li key={index}>
              {label}
              {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
            </li>
          ))}
        </List>
      );
    }
    case "scale":
      return (
        <MeasureView
          condensed={condensed}
          heading="h4"
          block={{
            ...node,
            type: "measure",
            version: 1,
            size: "md",
            variant: "scale",
            unit: node.unit ?? "",
            rows: node.rows.map((row, index) => ({
              ...row,
              id: String(index),
              tone: row.tone ?? "accent",
            })),
          }}
        />
      );
    case "source":
      return (
        <a
          className="organic-focus inline-flex min-h-11 items-center text-accent underline underline-offset-2"
          href={node.url}
          rel="noopener noreferrer"
          target="_blank"
        >
          {node.label}
        </a>
      );
    case "disclosure":
      return <DisclosureNode node={node} condensed={condensed} />;
  }
}

/**
 * A disclosure node reads as part of the composition, not a detached block: its label is a
 * section heading and its content follows directly. Condensed starts it closed and grows it in
 * place with the shared text toggle (no disclosure triangle or chevron).
 */
function DisclosureNode({
  node,
  condensed,
}: {
  node: Extract<CompositionNode, { kind: "disclosure" }>;
  condensed: boolean;
}) {
  const [open, setOpen] = useState(!condensed);
  // Models often write the label as an action ("Show activity"). The toggle uses it as is; the
  // full view's heading drops the verb so it names the section ("Activity").
  const isAction = /^show\b/i.test(node.label);
  const heading = isAction ? capitalize(node.label.replace(/^show\s+/i, "")) : node.label;
  const toggleLabel = isAction ? node.label : `Show ${lowerFirst(node.label)}`;

  const content = open ? (
    <div className={spacing.card.blockItems}>
      {node.children.map((child, index) => (
        <NodeView key={index} node={child} condensed={condensed} />
      ))}
    </div>
  ) : null;

  // Condensed: the toggle alone names the section, so there is no heading to repeat it.
  if (condensed) {
    return (
      <section aria-label={heading}>
        {content}
        <GrowToggle expanded={open} label={toggleLabel} onToggle={() => setOpen((v) => !v)} />
      </section>
    );
  }

  return (
    <section className={spacing.card.labelStack}>
      <h4 className="text-xs font-medium text-muted-foreground">{heading}</h4>
      {content}
    </section>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Lower-cases the first letter only, so acronyms and names inside a label keep their case. */
function lowerFirst(text: string) {
  return text.charAt(0).toLowerCase() + text.slice(1);
}
