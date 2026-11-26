"use client";

import type { ProfileMapBlock as ProfileMapBlockData, ProfileNode } from "@/lib/schemas/gen-ui";

import { useState } from "react";

import { ProfileMapView } from "../profile-map/ProfileMapView";
import { toneClass, toneFill } from "../measure/tone";

import {
  GraphCounts,
  GraphSurface,
  MINI_GRAPH_VIEW,
  MiniGraph,
  degreeOf,
  plural,
  type MiniGraphEdge,
  type MiniGraphHalo,
  type MiniGraphNode,
} from "./condensed-graph";

import { cn } from "@/lib/utils";

type ProfileMapProps = {
  block: ProfileMapBlockData;
  partial?: boolean;
  /** Domain constellations thumbnail for small previews. Full mode is unchanged. */
  condensed?: boolean;
  onEdit?: (node: ProfileNode) => void;
  onDelete?: (node: ProfileNode) => void;
};

export function ProfileMap({
  block,
  partial,
  condensed = false,
  onEdit,
  onDelete,
}: ProfileMapProps) {
  if (condensed) return <ProfileMapCondensed block={block} />;

  return <ProfileMapView block={block} partial={partial} onEdit={onEdit} onDelete={onDelete} />;
}

/** Visible domain chips in condensed mode; the rest collapse into "+N". */
const CONDENSED_DOMAIN_CHIPS = 4;
/** Most connected nodes that get a ring and a name. */
const CONDENSED_HUBS = 3;
/** Node chips offered for a focused domain before the rest become "+N". */
const CONDENSED_PICKS = 6;
/** Opacity factor for nodes outside the focused domain or the selected node's neighbourhood. */
const DIMMED = 0.2;

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

function chipClass(pressed: boolean) {
  return cn(
    "flex max-w-full min-w-0 items-center gap-inline-xs rounded-full border px-inset-sm py-0.5 text-2xs",
    pressed
      ? "border-accent bg-accent/30 text-foreground"
      : "border-border/60 bg-muted/50 text-muted-foreground",
    FOCUS
  );
}
/** Paused or idea nodes read as dimmer stars in their constellation. */
const STATUS_OPACITY: Record<ProfileNode["status"], number> = {
  active: 1,
  done: 0.7,
  paused: 0.45,
  idea: 0.45,
};

function ProfileMapCondensed({ block }: { block: ProfileMapBlockData }) {
  const [domainId, setDomainId] = useState<string | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const { width: W, height: H, pad } = MINI_GRAPH_VIEW;
  const ids = block.nodes.map((n) => n.id);
  const dependencyEdges = block.nodes.flatMap((n) =>
    n.dependencies.map((d) => ({ from: n.id, to: d }))
  );
  const degree = degreeOf(ids, dependencyEdges);
  const byDegree = (a: ProfileNode, b: ProfileNode) =>
    (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0);

  const domains = block.domains
    .map((domain) => ({
      domain,
      nodes: block.nodes.filter((n) => n.domain === domain.id).sort(byDegree),
    }))
    .filter((d) => d.nodes.length > 0);

  const hubs = [...block.nodes].sort(byDegree).slice(0, CONDENSED_HUBS);
  const hubIds = new Set(hubs.map((n) => n.id));

  // Focus: a domain brightens its constellation; a node lights its dependency lines.
  const focusedDomain = domains.find((d) => d.domain.id === domainId) ?? null;
  const selected = block.nodes.find((n) => n.id === nodeId) ?? null;
  const neighbours = new Set(
    selected
      ? dependencyEdges
          .filter((e) => e.from === selected.id || e.to === selected.id)
          .flatMap((e) => [e.from, e.to])
      : []
  );
  const lit = (node: ProfileNode) =>
    selected
      ? neighbours.has(node.id) || node.id === selected.id
      : !focusedDomain || node.domain === focusedDomain.domain.id;
  const pickable = focusedDomain ? focusedDomain.nodes : hubs;
  const pickShown = pickable.slice(0, CONDENSED_PICKS);
  const titleOf = (id: string) => block.nodes.find((n) => n.id === id)?.title ?? id;

  // One constellation per domain, side by side. Inside each, a sunflower spiral puts the most
  // connected node at the centre and spreads the rest evenly to the cluster's edge.
  const cell = (W - 2 * pad) / Math.max(1, domains.length);
  const nodes: MiniGraphNode[] = [];
  const halos: MiniGraphHalo[] = [];

  domains.forEach(({ domain, nodes: members }, di) => {
    const cx = pad + cell * (di + 0.5);
    const cy = H / 2;
    const ax = Math.max(cell / 2 - 4, 2);
    const ay = H / 2 - pad;
    const n = members.length;
    const step = Math.min(ax, ay) / Math.sqrt(Math.max(1, n));
    const fill = toneFill[domain.tone];

    if (!focusedDomain || focusedDomain.domain.id === domain.id) {
      halos.push({ cx, cy, rx: ax + 2, ry: ay + 2, fill });
    }

    members.forEach((node, i) => {
      const rho = n === 1 ? 0 : Math.sqrt(i / (n - 1));
      const theta = i * 2.39996;

      nodes.push({
        id: node.id,
        x: cx + rho * Math.cos(theta) * ax,
        y: cy + rho * Math.sin(theta) * ay,
        r: Math.min(1.2 + node.complexity * 0.6, Math.max(1.2, step * 0.45)),
        fill,
        fillOpacity: STATUS_OPACITY[node.status] * (lit(node) ? 1 : DIMMED),
        ring: selected ? node.id === selected.id : hubIds.has(node.id),
      });
    });
  });

  const edges: MiniGraphEdge[] = dependencyEdges.map((e) => {
    const touches = selected !== null && (e.from === selected.id || e.to === selected.id);

    return {
      ...e,
      width: touches ? 1 : 0.5,
      opacity: touches ? 0.9 : selected ? 0.12 : 0.3,
      emphasis: touches,
    };
  });

  const chips = domains.slice(0, CONDENSED_DOMAIN_CHIPS);
  const hidden = domains.length - chips.length;

  const label = [
    `Profile map: ${plural(block.nodes.length, "node")} across ${plural(domains.length, "domain")}, ${plural(dependencyEdges.length, "dependency", "dependencies")}.`,
    domains.map(({ domain, nodes: m }) => `${domain.label} ${m.length}`).join(", ") + ".",
    hubs.length ? `Most connected: ${hubs.map((n) => n.title).join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section className="mx-auto w-full max-w-sm space-y-stack-sm">
      <div className="flex items-baseline justify-between gap-inline-sm">
        <h3 className="min-w-0 text-sm font-medium wrap-anywhere text-foreground">{block.title}</h3>
        <GraphCounts>
          {plural(block.nodes.length, "node")} · {plural(domains.length, "domain")}
        </GraphCounts>
      </div>

      <GraphSurface>
        <MiniGraph label={label} nodes={nodes} edges={edges} halos={halos} />
      </GraphSurface>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul aria-label="Domains" className="flex flex-wrap items-center gap-inline-xs" role="list">
        {chips.map(({ domain, nodes: members }) => {
          const pressed = domainId === domain.id;

          return (
            <li key={domain.id} className="min-w-0 max-w-full">
              <button
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                  setDomainId(pressed ? null : domain.id);
                  setNodeId(null);
                }}
                className={chipClass(pressed)}
              >
                <span
                  className={cn("size-2 shrink-0 rounded-full", toneClass[domain.tone])}
                  aria-hidden
                />
                <span className="truncate uppercase tracking-wide">{domain.label}</span>
                <span className="font-mono opacity-70">{members.length}</span>
              </button>
            </li>
          );
        })}
        {hidden > 0 ? (
          <li className="font-mono text-2xs text-muted-foreground/70">+{hidden}</li>
        ) : null}
      </ul>

      {pickShown.length ? (
        <div className="space-y-stack-xs">
          <p className="text-2xs text-muted-foreground">
            {focusedDomain ? focusedDomain.domain.label : "Most connected"}
          </p>
          {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
          <ul
            aria-label={
              focusedDomain ? `${focusedDomain.domain.label} nodes` : "Most connected nodes"
            }
            className="flex flex-wrap items-center gap-inline-xs"
            role="list"
          >
            {pickShown.map((node) => {
              const pressed = nodeId === node.id;

              return (
                <li key={node.id} className="min-w-0 max-w-full">
                  <button
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => setNodeId(pressed ? null : node.id)}
                    className={chipClass(pressed)}
                  >
                    <span className="truncate">{node.title}</span>
                  </button>
                </li>
              );
            })}
            {pickable.length > pickShown.length ? (
              <li className="font-mono text-2xs text-muted-foreground/70">
                +{pickable.length - pickShown.length}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {selected ? (
        <div
          aria-live="polite"
          className="space-y-stack-xs rounded-xl bg-muted/40 p-inset-sm text-xs"
        >
          <p className="flex min-w-0 items-baseline justify-between gap-inline-sm">
            <span className="min-w-0 font-medium wrap-anywhere text-foreground">
              {selected.title}
            </span>
            <span className="shrink-0 font-mono text-2xs text-muted-foreground">
              {selected.status} · {selected.kind} · {selected.complexity}/5
            </span>
          </p>
          {selected.summary ? (
            <p className="line-clamp-2 text-muted-foreground">{selected.summary}</p>
          ) : null}
          {selected.dependencies.length ? (
            <p className="truncate text-2xs text-muted-foreground">
              Needs {selected.dependencies.map(titleOf).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
