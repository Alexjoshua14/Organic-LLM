"use client";

import type { HypGraphBlock } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";

import { toneClass, toneFill } from "../measure/tone";
import {
  GraphCounts,
  GraphSurface,
  MiniGraph,
  degreeOf,
  layeredLayout,
  plural,
  type MiniGraphEdge,
  type MiniGraphNode,
} from "./condensed-graph";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type HypGraphProps = {
  block: HypGraphBlock;
  partial?: boolean;
  /** Compact node-link thumbnail for small previews; same tones, edges and selection. */
  condensed?: boolean;
  onSelectNode?: (nodeId: string) => void;
};

/** Visible node chips in condensed mode; the rest collapse into "+N". */
const CONDENSED_CHIPS = 4;

export function HypGraph({ block, onSelectNode, condensed = false }: HypGraphProps) {
  const [active, setActive] = useState<string | null>(block.nodes[0]?.id ?? null);
  const byId = useMemo(() => new Map(block.nodes.map((n) => [n.id, n])), [block.nodes]);

  const related = useMemo(() => {
    if (!active) return block.edges;

    return block.edges.filter((e) => e.from === active || e.to === active);
  }, [active, block.edges]);

  if (condensed) {
    return (
      <HypGraphCondensed
        block={block}
        active={active}
        onSelect={(id) => {
          setActive(id);
          onSelectNode?.(id);
        }}
      />
    );
  }

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
                  "flex w-full items-start gap-inline-md rounded-xl p-inset-md text-left",
                  selected ? "bg-muted/50" : "bg-muted/20",
                  FOCUS
                )}
              >
                <span
                  className={cn("mt-stack-xs size-2.5 shrink-0 rounded-full", toneClass[node.tone])}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{node.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {node.id}
                    {outbound > 0 ? ` · ${outbound} out` : ""}
                  </span>
                  {node.detail ? (
                    <span className="mt-stack-xs block text-xs text-muted-foreground">{node.detail}</span>
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
                  className="rounded-xl bg-muted/30 px-inset-md py-inset-sm text-sm text-foreground"
                >
                  <span className="font-medium">{from}</span>
                  <span className="text-muted-foreground"> → </span>
                  <span className="font-medium">{to}</span>
                  <span className="font-mono text-xs text-muted-foreground">{weight}</span>
                  {edge.label ? (
                    <span className="mt-stack-xs block text-xs text-muted-foreground">{edge.label}</span>
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

/** Edge weight → stroke: heavier and more opaque when confident; dashed when unrated. */
function edgeStroke(weight: number | undefined) {
  if (weight === undefined) return { width: 1, opacity: 0.6, dashed: true };

  return { width: 0.75 + weight * 1.75, opacity: 0.35 + weight * 0.55, dashed: false };
}

function LegendStroke({ weight }: { weight?: number }) {
  const { width, opacity, dashed } = edgeStroke(weight);

  return (
    <svg aria-hidden viewBox="0 0 16 4" className="h-1 w-4 shrink-0">
      <line
        x1="1"
        y1="2"
        x2="15"
        y2="2"
        stroke="var(--color-muted-foreground)"
        strokeWidth={width}
        strokeOpacity={opacity}
        strokeDasharray={dashed ? "3 2" : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

function HypGraphCondensed({
  block,
  active,
  onSelect,
}: {
  block: HypGraphBlock;
  active: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const ids = block.nodes.map((n) => n.id);
  const { positions, order, r } = layeredLayout(ids, block.edges);
  const degree = degreeOf(ids, block.edges);
  const byId = new Map(block.nodes.map((n) => [n.id, n]));
  const name = (id: string) => byId.get(id)?.label ?? id;

  const nodes: MiniGraphNode[] = block.nodes.map((n) => {
    const p = positions.get(n.id)!;

    return {
      id: n.id,
      x: p.x,
      y: p.y,
      // Busier nodes read slightly larger, capped so neighbours never touch.
      r: r * (1 + Math.min(degree.get(n.id) ?? 0, 3) * 0.1),
      fill: toneFill[n.tone],
      ring: n.id === active,
    };
  });

  const edges: MiniGraphEdge[] = block.edges.map((e) => ({
    from: e.from,
    to: e.to,
    ...edgeStroke(e.weight),
    emphasis: active !== null && (e.from === active || e.to === active),
    arrow: true,
  }));

  const ranked = [...order].sort((a, b) => (degree.get(b) ?? 0) - (degree.get(a) ?? 0));
  const shown = new Set(ranked.slice(0, CONDENSED_CHIPS));
  const chips = order.filter((id) => shown.has(id));
  const hidden = ids.length - chips.length;
  const unrated = block.edges.some((e) => e.weight === undefined);

  const label = [
    `Hypothesis graph: ${plural(block.nodes.length, "node")}, ${plural(block.edges.length, "link")}.`,
    ...block.edges
      .slice(0, 12)
      .map(
        (e) =>
          `${name(e.from)} to ${name(e.to)}${e.weight !== undefined ? `, ${Math.round(e.weight * 100)}%` : ""}.`
      ),
    block.edges.length > 12 ? `${block.edges.length - 12} more links.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="mx-auto w-full max-w-sm space-y-stack-sm">
      <div className="flex items-baseline justify-between gap-inline-sm">
        <h3 className="min-w-0 text-sm font-medium wrap-anywhere text-foreground">{block.title}</h3>
        <GraphCounts>
          {plural(block.nodes.length, "node")} · {plural(block.edges.length, "link")}
        </GraphCounts>
      </div>

      <GraphSurface>
        <MiniGraph label={label} nodes={nodes} edges={edges} />
      </GraphSurface>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul className="flex flex-wrap items-center gap-inline-xs" role="list">
        {chips.map((id) => {
          const node = byId.get(id)!;
          const selected = active === id;

          return (
            <li key={id} className="min-w-0 max-w-full">
              <button
                type="button"
                aria-pressed={selected}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex max-w-full items-center gap-inline-xs rounded-full px-inset-sm py-0.5 text-2xs",
                  selected ? "bg-muted/50 text-foreground" : "bg-muted/20 text-muted-foreground",
                  FOCUS
                )}
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full", toneClass[node.tone])}
                  aria-hidden
                />
                <span className="truncate">{node.label}</span>
              </button>
            </li>
          );
        })}
        {hidden > 0 ? (
          <li className="font-mono text-2xs text-muted-foreground/70">+{hidden}</li>
        ) : null}
      </ul>

      {block.edges.length > 0 ? (
        <p className="flex flex-wrap items-center gap-inline-sm text-2xs text-muted-foreground">
          <span className="inline-flex items-center gap-inline-xs">
            <LegendStroke weight={1} /> strong
          </span>
          <span className="inline-flex items-center gap-inline-xs">
            <LegendStroke weight={0.2} /> weak
          </span>
          {unrated ? (
            <span className="inline-flex items-center gap-inline-xs">
              <LegendStroke /> unrated
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}
