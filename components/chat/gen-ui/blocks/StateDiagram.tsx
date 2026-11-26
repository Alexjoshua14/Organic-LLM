"use client";

import type { StateDiagramBlock } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";

import {
  GraphCounts,
  GraphSurface,
  MiniGraph,
  layeredLayout,
  plural,
  type MiniGraphEdge,
  type MiniGraphNode,
} from "./condensed-graph";

import { spacing } from "@/lib/design-tokens/spacing";
import { GEN_UI_FOCUS as FOCUS } from "@/components/chat/gen-ui/interaction";
import { cn } from "@/lib/utils";

type StateDiagramProps = {
  block: StateDiagramBlock;
  partial?: boolean;
  /** Host: jump or filter when a state label is tapped. */
  onSelectState?: (stateId: string) => void;
  /** Compact flow thumbnail for small previews; same states, arrows and selection. */
  condensed?: boolean;
};

/** Visible state chips in condensed mode; the rest collapse into "+N". */
const CONDENSED_CHIPS = 5;

export function StateDiagram({ block, onSelectState, condensed = false }: StateDiagramProps) {
  const [active, setActive] = useState<string | null>(block.states[0]?.id ?? null);
  const byId = useMemo(() => new Map(block.states.map((s) => [s.id, s])), [block.states]);

  const related = useMemo(() => {
    if (!active) return block.transitions;

    return block.transitions.filter((t) => t.from === active || t.to === active);
  }, [active, block.transitions]);

  const select = (id: string) => {
    setActive(id);
    onSelectState?.(id);
  };

  if (condensed) {
    return <StateDiagramCondensed block={block} active={active} onSelect={select} />;
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      {}
      {/* One tappable row per state; transitions touching the selected state light up in accent,
          including the ones arriving from other rows. */}
      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul className="space-y-stack-xs" role="list">
        {block.states.map((state) => {
          const selected = active === state.id;
          const outbound = block.transitions.filter((t) => t.from === state.id);

          return (
            <li
              key={state.id}
              className={cn("rounded-xl", selected ? "bg-accent/15" : "bg-muted/30")}
            >
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => select(state.id)}
                className={cn(
                  "block w-full rounded-xl px-inset-sm py-stack-sm text-left text-sm font-medium",
                  selected ? "text-foreground" : "text-foreground/85",
                  FOCUS
                )}
              >
                {state.label}
              </button>
              {outbound.length > 0 ? (
                <ul className="space-y-stack-xs px-inset-sm pb-stack-sm">
                  {outbound.map((t, i) => {
                    const lit = related.includes(t);

                    return (
                      <li
                        key={`${t.from}-${t.to}-${i}`}
                        className="flex min-w-0 items-baseline justify-between gap-inline-md text-xs"
                      >
                        <button
                          type="button"
                          onClick={() => select(t.to)}
                          className={cn(
                            "flex min-w-0 items-baseline gap-inline-xs text-left underline-offset-2 hover:underline",
                            lit ? "text-foreground" : "text-muted-foreground",
                            FOCUS
                          )}
                        >
                          <span aria-hidden className={lit ? "text-accent" : undefined}>
                            →
                          </span>
                          <span className="sr-only">Goes to </span>
                          <span className="truncate">{byId.get(t.to)?.label ?? t.to}</span>
                        </button>
                        {t.label ? (
                          <span className="shrink-0 text-2xs text-muted-foreground/80">
                            {t.label}
                          </span>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}

function StateDiagramCondensed({
  block,
  active,
  onSelect,
}: {
  block: StateDiagramBlock;
  active: string | null;
  onSelect: (stateId: string) => void;
}) {
  const ids = block.states.map((s) => s.id);
  const initial = ids[0];
  // Flow reads left to right from the initial state; back edges and self-loops arc.
  const { positions, order, r } = layeredLayout(ids, block.transitions, {
    root: initial,
    chainWhenNoEdges: true,
  });
  const byId = new Map(block.states.map((s) => [s.id, s]));
  const name = (id: string) => byId.get(id)?.label ?? id;

  // Same encoding as the full block's state circles: accent wash + accent ring when selected,
  // a quiet outlined circle otherwise (stroke a step stronger so it holds on the muted surface).
  const nodes: MiniGraphNode[] = block.states.map((s) => {
    const p = positions.get(s.id)!;
    const selected = s.id === active;

    return {
      id: s.id,
      x: p.x,
      y: p.y,
      r,
      fill: selected ? "var(--color-accent)" : "var(--color-background)",
      fillOpacity: selected ? 0.3 : 1,
      stroke: selected ? "var(--color-accent)" : "var(--color-muted-foreground)",
    };
  });

  const edges: MiniGraphEdge[] = block.transitions.map((t) => ({
    from: t.from,
    to: t.to,
    emphasis: active !== null && (t.from === active || t.to === active),
    arrow: true,
  }));

  const chips = order.slice(0, CONDENSED_CHIPS);
  const hidden = order.length - chips.length;

  const label = [
    `State diagram: ${plural(block.states.length, "state")}, ${plural(block.transitions.length, "transition")}.`,
    initial ? `Starts at ${name(initial)}.` : "",
    ...block.transitions
      .slice(0, 12)
      .map((t) => `${name(t.from)} to ${name(t.to)}${t.label ? `, ${t.label}` : ""}.`),
    block.transitions.length > 12 ? `${block.transitions.length - 12} more transitions.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="mx-auto w-full max-w-sm space-y-stack-sm">
      <div className="flex items-baseline justify-between gap-inline-sm">
        <h3 className="min-w-0 text-sm font-medium wrap-anywhere text-foreground">{block.title}</h3>
        <GraphCounts>
          {plural(block.states.length, "state")} · {plural(block.transitions.length, "transition")}
        </GraphCounts>
      </div>

      <GraphSurface>
        <MiniGraph label={label} nodes={nodes} edges={edges} entry={initial} />
      </GraphSurface>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ol className="flex flex-wrap items-center gap-inline-xs" role="list">
        {chips.map((id) => {
          const selected = active === id;

          return (
            <li key={id} className="min-w-0 max-w-full">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex max-w-full items-center gap-inline-xs rounded-full border px-inset-sm py-0.5 text-2xs",
                  selected
                    ? "border-accent bg-accent/30 text-foreground"
                    : "border-border/60 bg-muted/50 text-muted-foreground",
                  FOCUS
                )}
              >
                {id === initial ? (
                  <>
                    <span className="size-1.5 shrink-0 rounded-full bg-foreground" aria-hidden />
                    <span className="sr-only">Initial state: </span>
                  </>
                ) : null}
                <span className="truncate">{name(id)}</span>
              </button>
            </li>
          );
        })}
        {hidden > 0 ? (
          <li className="font-mono text-2xs text-muted-foreground/70">+{hidden}</li>
        ) : null}
      </ol>
    </section>
  );
}
