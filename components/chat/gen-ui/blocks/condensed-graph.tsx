"use client";

import type { ReactNode } from "react";

import { useId } from "react";

/**
 * Thumbnail node-link drawing shared by the condensed graph blocks (hyp-graph, state-diagram,
 * profile-map). Geometry is in SVG viewBox units, so the drawing scales with its container;
 * colors are theme CSS variables. Labels stay in HTML next to the drawing: SVG text would
 * shrink with the viewBox and become unreadable at phone width.
 *
 * Layout is deterministic (index based, no randomness) so server and client render the same.
 */

export const MINI_GRAPH_VIEW = { width: 300, height: 112, pad: 12 } as const;

export type MiniGraphNode = {
  id: string;
  x: number;
  y: number;
  r: number;
  fill: string;
  fillOpacity?: number;
  stroke?: string;
  /** Outer ring marks the selected or most connected nodes. */
  ring?: boolean;
};

export type MiniGraphEdge = {
  from: string;
  to: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
  /** Accent stroke for edges touching the active node. */
  emphasis?: boolean;
  arrow?: boolean;
};

export type MiniGraphHalo = { cx: number; cy: number; rx: number; ry: number; fill: string };

type Point = { x: number; y: number };

type LayeredOptions = {
  /** Seeds the first layer (e.g. a state machine's initial state). */
  root?: string;
  /** With no edges, lay nodes out as a left-to-right chain instead of one column. */
  chainWhenNoEdges?: boolean;
};

/**
 * Left-to-right layers by shortest distance from the roots (nodes with no inbound edge, or
 * `root`). Edges that point back to an earlier or equal layer are drawn as arcs by `MiniGraph`.
 */
export function layeredLayout(
  ids: readonly string[],
  edges: readonly { from: string; to: string }[],
  { root, chainWhenNoEdges = false }: LayeredOptions = {}
): { positions: Map<string, Point>; order: string[]; r: number } {
  const { width: W, height: H, pad } = MINI_GRAPH_VIEW;
  const layer = new Map<string, number>();

  if (edges.length === 0 && chainWhenNoEdges) {
    ids.forEach((id, i) => layer.set(id, i));
  } else {
    const out = new Map<string, string[]>(ids.map((id) => [id, []]));
    const inbound = new Set<string>();

    for (const e of edges) {
      if (e.from === e.to) continue;
      out.get(e.from)?.push(e.to);
      inbound.add(e.to);
    }

    const seeds = [...(root ? [root] : []), ...ids.filter((id) => !inbound.has(id)), ...ids];

    for (const seed of seeds) {
      if (layer.has(seed) || !out.has(seed)) continue;
      layer.set(seed, 0);
      const queue = [seed];

      while (queue.length) {
        const id = queue.shift()!;
        const depth = layer.get(id)!;

        for (const next of out.get(id) ?? []) {
          if (layer.has(next)) continue;
          layer.set(next, depth + 1);
          queue.push(next);
        }
      }
    }
  }

  const columns: string[][] = [];

  for (const id of ids) {
    const l = layer.get(id) ?? 0;

    (columns[l] ??= []).push(id);
  }

  const filled = columns.filter((c) => c && c.length);
  const maxRows = Math.max(1, ...filled.map((c) => c.length));
  const colGap = (W - 2 * pad) / Math.max(1, filled.length);
  const rowGap = (H - 2 * pad) / maxRows;
  const positions = new Map<string, Point>();

  filled.forEach((column, c) => {
    column.forEach((id, i) => {
      positions.set(id, {
        x: pad + colGap * (c + 0.5),
        y: pad + ((H - 2 * pad) * (i + 0.5)) / column.length,
      });
    });
  });

  return {
    positions,
    order: filled.flat(),
    r: Math.min(7, Math.max(2.5, Math.min(colGap, rowGap) / 4)),
  };
}

/** Undirected degree, used to pick which nodes get a ring and a visible label. */
export function degreeOf(ids: readonly string[], edges: readonly { from: string; to: string }[]) {
  const degree = new Map<string, number>(ids.map((id) => [id, 0]));

  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    if (e.to !== e.from) degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }

  return degree;
}

function edgePath(a: MiniGraphNode, b: MiniGraphNode, tipGap: number): string {
  if (a.id === b.id) {
    const { x, y, r } = a;

    return `M ${x - r * 0.6} ${y - r * 0.8} C ${x - r * 2.2} ${y - r * 3.6}, ${x + r * 2.2} ${y - r * 3.6}, ${x + r * 0.6} ${y - r * 0.8}`;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;

  if (dx > 0.5) {
    const ux = dx / len;
    const uy = dy / len;

    return `M ${a.x + ux * a.r} ${a.y + uy * a.r} L ${b.x - ux * (b.r + tipGap)} ${b.y - uy * (b.r + tipGap)}`;
  }

  // Back or same-column edge: bow it so it never overlaps the forward chain.
  const bow = Math.max(len * 0.35, a.r * 3);
  const cx = (a.x + b.x) / 2 + (-dy / len) * bow;
  const cy = (a.y + b.y) / 2 + (dx / len) * bow;
  const toward = (p: MiniGraphNode, d: number) => {
    const l = Math.hypot(cx - p.x, cy - p.y) || 1;

    return { x: p.x + ((cx - p.x) / l) * d, y: p.y + ((cy - p.y) / l) * d };
  };
  const start = toward(a, a.r);
  const end = toward(b, b.r + tipGap);

  return `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`;
}

export function MiniGraph({
  label,
  nodes,
  edges,
  halos = [],
  entry,
}: {
  /** Text alternative for the whole drawing (it is a single `role="img"`). */
  label: string;
  nodes: readonly MiniGraphNode[];
  edges: readonly MiniGraphEdge[];
  halos?: readonly MiniGraphHalo[];
  /** Node id that receives an initial-state pseudo marker (filled dot + arrow). */
  entry?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const mutedTip = `mg-${uid}-m`;
  const accentTip = `mg-${uid}-a`;
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const entryNode = entry ? byId.get(entry) : undefined;
  const { width: W, height: H } = MINI_GRAPH_VIEW;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="block h-28 w-full"
    >
      <defs>
        {[
          [mutedTip, "var(--color-muted-foreground)"],
          [accentTip, "var(--color-accent)"],
        ].map(([id, fill]) => (
          <marker
            key={id}
            id={id}
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="5"
            markerHeight="5"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" fill={fill} />
          </marker>
        ))}
      </defs>

      {halos.map((h, i) => (
        <ellipse key={i} cx={h.cx} cy={h.cy} rx={h.rx} ry={h.ry} fill={h.fill} fillOpacity={0.08} />
      ))}

      <g fill="none" strokeLinecap="round">
        {edges.map((e, i) => {
          const a = byId.get(e.from);
          const b = byId.get(e.to);

          if (!a || !b) return null;

          return (
            <path
              key={`${e.from}-${e.to}-${i}`}
              d={edgePath(a, b, e.arrow ? 1.5 : 0)}
              stroke={e.emphasis ? "var(--color-accent)" : "var(--color-muted-foreground)"}
              strokeWidth={e.width ?? 1}
              strokeOpacity={e.opacity ?? 0.6}
              strokeDasharray={e.dashed ? "3 2" : undefined}
              markerEnd={e.arrow ? `url(#${e.emphasis ? accentTip : mutedTip})` : undefined}
            />
          );
        })}
      </g>

      {entryNode ? (
        <g>
          <circle
            cx={Math.max(2, entryNode.x - entryNode.r - 8)}
            cy={entryNode.y}
            r={2}
            fill="var(--color-foreground)"
          />
          <path
            d={`M ${Math.max(2, entryNode.x - entryNode.r - 8) + 2} ${entryNode.y} L ${entryNode.x - entryNode.r - 1.5} ${entryNode.y}`}
            stroke="var(--color-foreground)"
            strokeWidth={1}
            markerEnd={`url(#${mutedTip})`}
          />
        </g>
      ) : null}

      <g>
        {nodes.map((n) => (
          <g key={n.id}>
            {n.ring ? (
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r + 2.5}
                fill="none"
                stroke="var(--color-foreground)"
                strokeOpacity={0.5}
                strokeWidth={0.75}
              />
            ) : null}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill={n.fill}
              fillOpacity={n.fillOpacity ?? 1}
              stroke={n.stroke}
              strokeWidth={n.stroke ? 1 : undefined}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}

/** Count badge for the condensed header row ("12 nodes · 4 domains"). */
export function GraphCounts({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 font-mono text-xs text-muted-foreground/70 tabular-nums">
      {children}
    </span>
  );
}

/** Surface the drawing sits on — the same muted row chrome the full blocks use. */
export function GraphSurface({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-muted/40 p-inset-sm">{children}</div>;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
