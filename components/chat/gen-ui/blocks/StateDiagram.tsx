"use client";

import type { StateDiagramBlock } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type StateDiagramProps = {
  block: StateDiagramBlock;
  partial?: boolean;
  /** Host: jump or filter when a state label is tapped. */
  onSelectState?: (stateId: string) => void;
};

export function StateDiagram({ block, onSelectState }: StateDiagramProps) {
  const [active, setActive] = useState<string | null>(block.states[0]?.id ?? null);
  const byId = useMemo(() => new Map(block.states.map((s) => [s.id, s])), [block.states]);

  const related = useMemo(() => {
    if (!active) return block.transitions;

    return block.transitions.filter((t) => t.from === active || t.to === active);
  }, [active, block.transitions]);

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul className={spacing.card.blockItems} role="list">
        {block.states.map((state) => {
          const selected = active === state.id;
          const outbound = block.transitions.filter((t) => t.from === state.id);

          return (
            <li key={state.id} className="flex items-start gap-inline-md">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setActive(state.id);
                  onSelectState?.(state.id);
                }}
                className={cn(
                  "mt-0.5 size-8 shrink-0 rounded-full border",
                  selected
                    ? "border-accent bg-accent/30"
                    : "border-border/60 bg-muted/50",
                  FOCUS
                )}
                aria-label={state.label}
              />
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setActive(state.id);
                    onSelectState?.(state.id);
                  }}
                  className={cn(
                    "text-left text-sm font-medium text-foreground underline-offset-2 hover:underline",
                    FOCUS
                  )}
                >
                  {state.label}
                </button>
                {outbound.length > 0 ? (
                  <ul className="mt-stack-xs space-y-0.5">
                    {outbound.map((t, i) => (
                      <li key={`${t.from}-${t.to}-${i}`} className="text-xs text-muted-foreground">
                        <span aria-hidden>→ </span>
                        <button
                          type="button"
                          className={cn("underline-offset-2 hover:underline", FOCUS)}
                          onClick={() => {
                            setActive(t.to);
                            onSelectState?.(t.to);
                          }}
                        >
                          {byId.get(t.to)?.label ?? t.to}
                        </button>
                        {t.label ? <span className="text-muted-foreground/80"> · {t.label}</span> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {active && related.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {related.length} transition{related.length === 1 ? "" : "s"} touch{" "}
          {byId.get(active)?.label ?? active}.
        </p>
      ) : null}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
