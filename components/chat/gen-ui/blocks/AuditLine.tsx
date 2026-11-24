"use client";

import type { AuditLineBlock, AuditLineEvent } from "@/lib/schemas/gen-ui";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type AuditLineProps = {
  block: AuditLineBlock;
  partial?: boolean;
  /** Compact visual summary: a slim timeline rail with the latest events and "+N earlier". */
  condensed?: boolean;
};

/** How many of the latest events the condensed rail shows before folding the rest. */
const CONDENSED_VISIBLE_EVENTS = 3;

/** Actor dot colors, assigned in order of first appearance so each actor keeps one hue. */
const ACTOR_DOTS = [
  "bg-accent",
  "bg-accent-warm",
  "bg-muted-foreground/70",
  "bg-muted-foreground/40",
] as const;

function actorDotFor(events: readonly AuditLineEvent[]) {
  const order = new Map<string, number>();

  for (const event of events) {
    if (!order.has(event.actor)) order.set(event.actor, order.size);
  }

  return (actor: string) => ACTOR_DOTS[(order.get(actor) ?? 0) % ACTOR_DOTS.length];
}

function CondensedRail({
  events,
  dotFor,
  startIndex,
}: {
  events: readonly AuditLineEvent[];
  dotFor: (actor: string) => string;
  startIndex: number;
}) {
  return (
    <ol className="relative space-y-stack-xs border-l border-border/60 pl-inset-sm">
      {events.map((event, i) => (
        <li
          key={`${event.time}-${event.action}-${startIndex + i}`}
          className="relative flex min-w-0 items-start gap-inline-xs"
        >
          {/* The dot sits on the rail; the half-size offset centers it on the border line. */}
          <span
            aria-hidden
            className={cn(
              "absolute top-1.5 -left-inset-sm size-2 -translate-x-1/2 rounded-full ring-2 ring-background",
              dotFor(event.actor)
            )}
          />
          <span className="shrink-0 rounded-full bg-muted/60 px-inset-sm py-0.5 font-mono text-2xs tabular-nums text-muted-foreground">
            {event.time}
          </span>
          <span className="min-w-0 flex-1" title={event.summary}>
            <span className="block truncate text-xs text-foreground">
              <span className="font-medium">{event.actor}</span>
              <span className="text-muted-foreground"> · </span>
              <span className="font-mono">{event.action}</span>
            </span>
            <span className="block truncate text-2xs text-muted-foreground">{event.summary}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

export function AuditLine({ block, condensed = false }: AuditLineProps) {
  if (condensed) {
    const dotFor = actorDotFor(block.events);
    const splitAt = Math.max(0, block.events.length - CONDENSED_VISIBLE_EVENTS);
    const earlier = block.events.slice(0, splitAt);
    const latest = block.events.slice(splitAt);

    return (
      <section className="w-full space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
        <div className="flex items-center justify-between gap-inline-sm">
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{block.title}</h3>
          <span
            className="shrink-0 rounded-full bg-accent/15 px-inset-sm py-0.5 font-mono text-2xs tabular-nums text-foreground"
            aria-label={`${block.events.length} events`}
          >
            {block.events.length}
          </span>
        </div>

        {earlier.length > 0 ? (
          <details>
            <summary className="organic-focus cursor-pointer text-2xs font-medium text-muted-foreground">
              +{earlier.length} earlier
            </summary>
            <div className="mt-stack-xs">
              <CondensedRail events={earlier} dotFor={dotFor} startIndex={0} />
            </div>
          </details>
        ) : null}

        <CondensedRail events={latest} dotFor={dotFor} startIndex={splitAt} />
      </section>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      <ol className={spacing.card.blockItems}>
        {block.events.map((event, index) => (
          <li key={`${event.time}-${event.action}-${index}`} className="flex items-start gap-inline-md">
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
