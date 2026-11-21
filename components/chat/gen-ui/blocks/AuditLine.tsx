"use client";

import type { AuditLineBlock } from "@/lib/schemas/gen-ui";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type AuditLineProps = {
  block: AuditLineBlock;
  partial?: boolean;
};

export function AuditLine({ block }: AuditLineProps) {
  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      <ol className={spacing.card.blockItems}>
        {block.events.map((event, index) => (
          <li key={`${event.time}-${event.action}-${index}`} className="flex items-start gap-3">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-mono text-xs text-muted-foreground">{event.time}</p>
              <p className="text-sm text-foreground">
                <span className="font-medium">{event.actor}</span>
                <span className="text-muted-foreground"> · </span>
                <span className="font-mono text-xs">{event.action}</span>
              </p>
              <p className="text-sm text-muted-foreground">{event.summary}</p>
            </div>
          </li>
        ))}
      </ol>

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
