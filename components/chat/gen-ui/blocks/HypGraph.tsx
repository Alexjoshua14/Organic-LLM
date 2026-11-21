"use client";

import type { HypGraphBlock } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";

import { toneClass } from "../measure/tone";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type HypGraphProps = {
  block: HypGraphBlock;
  partial?: boolean;
  onSelectNode?: (nodeId: string) => void;
};

export function HypGraph({ block, onSelectNode }: HypGraphProps) {
  const [active, setActive] = useState<string | null>(block.nodes[0]?.id ?? null);
  const byId = useMemo(() => new Map(block.nodes.map((n) => [n.id, n])), [block.nodes]);

  const related = useMemo(() => {
    if (!active) return block.edges;

    return block.edges.filter((e) => e.from === active || e.to === active);
  }, [active, block.edges]);

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul className={spacing.card.blockItems} role="list">
        {block.nodes.map((node) => {
          const selected = active === node.id;
          const outbound = block.edges.filter((e) => e.from === node.id).length;

          return (
            <li key={node.id}>
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setActive(node.id);
                  onSelectNode?.(node.id);
                }}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl p-3 text-left",
                  selected ? "bg-muted/50" : "bg-muted/20",
                  FOCUS
                )}
              >
                <span
                  className={cn("mt-1 size-2.5 shrink-0 rounded-full", toneClass[node.tone])}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{node.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {node.id}
                    {outbound > 0 ? ` · ${outbound} out` : ""}
                  </span>
                  {node.detail ? (
                    <span className="mt-1 block text-xs text-muted-foreground">{node.detail}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className={spacing.card.blockItems}>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {active ? `Edges for ${byId.get(active)?.label ?? active}` : "Edges"}
        </p>
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
        <ul className={spacing.card.blockItems} role="list">
          {related.length === 0 ? (
            <li className="text-sm text-muted-foreground">No edges from this node.</li>
          ) : (
            related.map((edge, i) => {
              const from = byId.get(edge.from)?.label ?? edge.from;
              const to = byId.get(edge.to)?.label ?? edge.to;
              const weight =
                edge.weight !== undefined ? ` · ${Math.round(edge.weight * 100)}%` : "";

              return (
                <li
                  key={`${edge.from}-${edge.to}-${i}`}
                  className="rounded-xl bg-muted/30 px-3 py-2 text-sm text-foreground"
                >
                  <span className="font-medium">{from}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-medium">{to}</span>
                  <span className="font-mono text-xs text-muted-foreground">{weight}</span>
                  {edge.label ? (
                    <span className="mt-1 block text-xs text-muted-foreground">{edge.label}</span>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>
      </div>

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
