"use client";

import type { ProfileMapBlock, ProfileNode } from "@/lib/schemas/gen-ui";

import { useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import {
  PROFILE_MAP_JUMP_SCROLL_MS,
  PROFILE_MAP_PANEL_REDUCED,
  PROFILE_MAP_PANEL_SPRING,
} from "./profile-map-timing";

import { toneClass } from "@/components/chat/gen-ui/measure/tone";
import { deriveDependents } from "@/lib/schemas/gen-ui/profile-map";
import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

type ProfileMapViewProps = {
  block: ProfileMapBlock;
  partial?: boolean;
  /** Host-owned write path — not part of the LLM payload. */
  onEdit?: (node: ProfileNode) => void;
  /** Host owns the confirm step. */
  onDelete?: (node: ProfileNode) => void;
};

/** Surface invert + Lumen wash — no focus rings (docs/design/focus-feedback.md). */
const FILTER_FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

const Orb = ({ cls }: { cls: string }) => (
  <span className={cn("size-3 shrink-0 rounded-full", cls)} aria-hidden />
);

const Pips = ({ n }: { n: number }) => (
  <span className="flex gap-0.5" aria-label={`complexity ${n} of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <span
        key={i}
        className={cn(
          "size-1.5 rounded-full",
          i <= n ? "bg-foreground" : "bg-muted-foreground/30"
        )}
      />
    ))}
  </span>
);

const Chip = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "rounded-full border border-border/50 px-2.5 py-1 text-xs text-muted-foreground",
      "active:bg-muted/50",
      FILTER_FOCUS
    )}
  >
    {label}
  </button>
);

export function ProfileMapView({ block, onEdit, onDelete }: ProfileMapViewProps) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);
  const [kind, setKind] = useState<ProfileNode["kind"] | "all">("all");

  const byId = useMemo(() => new Map(block.nodes.map((n) => [n.id, n])), [block.nodes]);
  const dependents = useMemo(() => deriveDependents(block.nodes), [block.nodes]);
  const kinds = useMemo(() => [...new Set(block.nodes.map((n) => n.kind))], [block.nodes]);

  const jump = (id: string) => {
    setKind("all");
    setOpen(id);
    window.setTimeout(() => {
      document.getElementById(`pm-${id}`)?.scrollIntoView({
        block: "nearest",
        behavior: reduceMotion ? "auto" : "smooth",
      });
    }, PROFILE_MAP_JUMP_SCROLL_MS);
  };

  const chips = (ids: string[]) =>
    ids.length ? (
      ids.map((id) => (
        <Chip key={id} label={byId.get(id)?.title ?? id} onClick={() => jump(id)} />
      ))
    ) : (
      <span className="text-xs text-muted-foreground/60">none</span>
    );

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {(["all", ...kinds] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs",
              kind === k
                ? "bg-accent text-accent-foreground"
                : "bg-muted/60 text-muted-foreground",
              FILTER_FOCUS
            )}
          >
            {k}
          </button>
        ))}
      </div>

      <div className={spacing.card.section}>
        {block.domains.map((domain) => {
          const nodes = block.nodes.filter(
            (n) => n.domain === domain.id && (kind === "all" || n.kind === kind)
          );

          if (!nodes.length) return null;

          return (
            <div key={domain.id}>
              <div className="mb-1.5 flex items-center gap-2">
                <Orb cls={toneClass[domain.tone]} />
                <span className="text-xs uppercase tracking-wide text-muted-foreground">
                  {domain.label}
                </span>
                <span className="font-mono text-xs text-muted-foreground/60">{nodes.length}</span>
              </div>

              <ul className={spacing.card.listItems}>
                {nodes.map((node) => {
                  const isOpen = open === node.id;
                  const feeds = dependents.get(node.id) ?? [];

                  return (
                    <li key={node.id} id={`pm-${node.id}`} className="rounded-xl bg-muted/40">
                      <button
                        type="button"
                        onClick={() => setOpen(isOpen ? null : node.id)}
                        className={cn(
                          "flex w-full items-center gap-3 p-3 text-left",
                          FILTER_FOCUS
                        )}
                        aria-expanded={isOpen}
                      >
                        <Orb cls={toneClass[domain.tone]} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">{node.title}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {node.kind} · {node.status} · needs {node.dependencies.length} · feeds{" "}
                            {feeds.length}
                          </span>
                        </span>
                        <Pips n={node.complexity} />
                      </button>

                      <AnimatePresence initial={false}>
                        {isOpen ? (
                          <motion.div
                            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={reduceMotion ? undefined : { height: 0, opacity: 0 }}
                            transition={
                              reduceMotion
                                ? PROFILE_MAP_PANEL_REDUCED
                                : PROFILE_MAP_PANEL_SPRING
                            }
                            className="overflow-hidden"
                          >
                            <div className={cn("px-3 pb-3", spacing.card.blockItems)}>
                              {node.summary ? (
                                <p className="text-sm text-muted-foreground">{node.summary}</p>
                              ) : null}

                              <div>
                                <p className="mb-1 text-xs uppercase text-muted-foreground/70">
                                  Needs
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                  {chips(node.dependencies)}
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-xs uppercase text-muted-foreground/70">
                                  Feeds
                                </p>
                                <div className="flex flex-wrap gap-1.5">{chips(feeds)}</div>
                              </div>

                              <div>
                                <div className="mb-1 flex justify-between font-mono text-xs text-muted-foreground">
                                  <span>confidence</span>
                                  <span>{Math.round(node.confidence * 100)}%</span>
                                </div>
                                <div className="h-1 rounded-full bg-muted/60">
                                  <div
                                    className="h-full rounded-full bg-accent"
                                    style={{ width: `${node.confidence * 100}%` }}
                                  />
                                </div>
                              </div>

                              {node.evidence.length > 0 ? (
                                <ul className="space-y-1 border-l border-border/50 pl-2">
                                  {node.evidence.map((e, i) => (
                                    <li key={i} className="text-xs text-muted-foreground">
                                      <span className="font-mono text-xs text-muted-foreground/70">
                                        {e.source}
                                      </span>
                                      {e.quote ? <span className="block">{e.quote}</span> : null}
                                    </li>
                                  ))}
                                </ul>
                              ) : null}

                              {onEdit || onDelete ? (
                                <div className="flex gap-2 pt-1">
                                  {onEdit ? (
                                    <button
                                      type="button"
                                      onClick={() => onEdit(node)}
                                      className={cn(
                                        "rounded-lg bg-accent-warm px-3 py-1.5 text-xs font-medium text-accent-foreground",
                                        FILTER_FOCUS
                                      )}
                                    >
                                      Edit
                                    </button>
                                  ) : null}
                                  {onDelete ? (
                                    <button
                                      type="button"
                                      onClick={() => onDelete(node)}
                                      className={cn(
                                        "rounded-lg border border-border/60 px-3 py-1.5 text-xs text-muted-foreground",
                                        FILTER_FOCUS
                                      )}
                                    >
                                      Delete
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
