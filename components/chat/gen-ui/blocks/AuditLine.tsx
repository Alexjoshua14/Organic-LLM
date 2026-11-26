"use client";

import type { AuditLineBlock, AuditLineEvent } from "@/lib/schemas/gen-ui";

import { useState } from "react";

import { GrowToggle } from "@/components/chat/gen-ui/GrowToggle";
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
  const [showEarlier, setShowEarlier] = useState(false);

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

        {/* Earlier events extend the same rail upward, in place: one continuous timeline. */}
        {earlier.length > 0 ? (
          <GrowToggle
            expanded={showEarlier}
            label={`Show ${earlier.length} earlier`}
            onToggle={() => setShowEarlier((v) => !v)}
          />
        ) : null}

        <CondensedRail
          events={showEarlier ? block.events : latest}
          dotFor={dotFor}
          startIndex={showEarlier ? 0 : splitAt}
        />
      </section>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      {/* A rail joins the events; space inside an event (stack-xs) is smaller than between
          events (stack-md, as padding so the rail runs through the gap). */}
      <ol>
        {block.events.map((event, index) => {
          const last = index === block.events.length - 1;

          return (
            <li
              key={`${event.time}-${event.action}-${index}`}
              className={cn("flex items-stretch gap-inline-md", !last && "pb-stack-md")}
            >
              <span aria-hidden className="flex w-2 shrink-0 flex-col items-center">
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    last ? "bg-accent" : "bg-muted-foreground/50"
                  )}
                />
                {!last ? <span className="mt-stack-xs w-px flex-1 bg-border/60" /> : null}
              </span>
              <div className={cn("min-w-0 flex-1", spacing.card.labelStack)}>
                <p className="flex min-w-0 items-baseline gap-inline-sm">
                  <span className="min-w-0 truncate text-sm font-medium text-foreground">
                    {event.actor}
                  </span>
                  <span className="shrink-0 rounded-md bg-muted/60 px-inset-sm font-mono text-2xs text-muted-foreground">
                    {event.action}
                  </span>
                  <time className="ml-auto shrink-0 font-mono text-2xs tabular-nums text-muted-foreground/70">
                    {event.time}
                  </time>
                </p>
                <p className="text-sm text-muted-foreground">{event.summary}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
