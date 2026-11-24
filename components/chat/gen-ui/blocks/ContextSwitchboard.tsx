"use client";

import type {
  ContextSwitchboardBlock,
  ContextSwitchItem,
  ContextSwitchKind,
} from "@/lib/schemas/gen-ui";

import { useEffect, useMemo, useState } from "react";
import { Brain, CircleHelp, FileText, Lightbulb } from "lucide-react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

const KIND_META: Record<
  ContextSwitchKind,
  { label: string; Icon: typeof Brain; swatch: string; rail: string; chip: string }
> = {
  memory: {
    label: "Memory",
    Icon: Brain,
    swatch: "bg-accent text-accent-foreground",
    rail: "bg-accent",
    chip: "bg-accent/15 text-foreground",
  },
  file: {
    label: "File",
    Icon: FileText,
    swatch: "bg-accent-warm text-accent-foreground",
    rail: "bg-accent-warm",
    chip: "bg-accent-warm/15 text-foreground",
  },
  assumption: {
    label: "Assumption",
    Icon: Lightbulb,
    swatch: "bg-muted-foreground/70 text-background",
    rail: "bg-muted-foreground/70",
    chip: "bg-muted-foreground/15 text-foreground",
  },
  other: {
    label: "Other",
    Icon: CircleHelp,
    swatch: "bg-muted-foreground/40 text-foreground",
    rail: "bg-muted-foreground/40",
    chip: "bg-muted/60 text-muted-foreground",
  },
};

type ContextSwitchboardProps = {
  block: ContextSwitchboardBlock;
  partial?: boolean;
  /**
   * Host reruns the same turn with only the included item ids.
   * Without it the board is preview-only.
   */
  onRerun?: (included: ContextSwitchItem[]) => void | Promise<void>;
  /** Compact visual summary: inclusion meter plus a grid of toggle chips. Toggling still works. */
  condensed?: boolean;
};

export function ContextSwitchboard({ block, onRerun, condensed = false }: ContextSwitchboardProps) {
  const [included, setIncluded] = useState(() =>
    Object.fromEntries(block.items.map((i) => [i.id, i.included]))
  );
  const [status, setStatus] = useState<"ready" | "running" | "done" | "error">("ready");

  useEffect(() => {
    setIncluded(Object.fromEntries(block.items.map((i) => [i.id, i.included])));
    setStatus("ready");
  }, [block.items]);

  const activeItems = useMemo(
    () => block.items.filter((i) => included[i.id]),
    [block.items, included]
  );
  const includedCount = activeItems.length;
  const total = block.items.length;
  const excludedCount = total - includedCount;

  const kindTally = useMemo(() => {
    const counts: Partial<Record<ContextSwitchKind, { on: number; total: number }>> = {};

    for (const item of block.items) {
      const slot = counts[item.kind] ?? { on: 0, total: 0 };

      slot.total += 1;
      if (included[item.id]) slot.on += 1;
      counts[item.kind] = slot;
    }

    return (Object.keys(KIND_META) as ContextSwitchKind[])
      .map((kind) => ({ kind, ...(counts[kind] ?? { on: 0, total: 0 }) }))
      .filter((row) => row.total > 0);
  }, [block.items, included]);

  const toggle = (id: string) => {
    setIncluded((prev) => ({ ...prev, [id]: !prev[id] }));
    setStatus("ready");
  };

  const rerun = async () => {
    if (!onRerun || status === "running") return;
    setStatus("running");
    try {
      await onRerun(activeItems);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  };

  /** Segmented inclusion rail, one segment per item, kind-colored when on. Shared by both sizes. */
  const inclusionRail = (
    <div
      className="flex h-1.5 overflow-hidden rounded-full bg-muted/60"
      role="presentation"
      aria-hidden
    >
      {block.items.map((item) => {
        const on = Boolean(included[item.id]);
        const meta = KIND_META[item.kind];

        return (
          <span
            key={item.id}
            title={`${item.label} · ${on ? "included" : "ignored"}`}
            className={cn(
              "min-w-0 flex-1 first:rounded-l-full last:rounded-r-full",
              on ? meta.rail : "bg-transparent"
            )}
          />
        );
      })}
    </div>
  );

  if (condensed) {
    return (
      <section className="w-full space-y-stack-sm rounded-2xl bg-muted/30 p-inset-sm">
        <div className="flex items-center justify-between gap-inline-sm">
          <h3 className="min-w-0 truncate text-sm font-medium text-foreground">{block.title}</h3>
          <p
            className="shrink-0 rounded-lg bg-muted/50 px-inset-sm py-0.5 font-mono text-xs tabular-nums text-foreground"
            aria-label={`${includedCount} of ${total} included`}
          >
            {includedCount}
            <span className="text-muted-foreground">/{total} on</span>
          </p>
        </div>

        {inclusionRail}

        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
        <ul className="grid grid-cols-2 gap-inline-xs" role="list" aria-label="Context sources">
          {block.items.map((item) => {
            const on = Boolean(included[item.id]);
            const meta = KIND_META[item.kind];
            const { Icon } = meta;

            return (
              <li key={item.id} className="min-w-0">
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${item.label} (${meta.label})`}
                  title={item.detail ?? item.label}
                  onClick={() => toggle(item.id)}
                  className={cn(
                    "flex w-full min-w-0 items-center gap-inline-xs rounded-lg px-inset-sm py-1.5 text-left motion-safe:transition-colors",
                    on ? meta.chip : "bg-muted/15 text-muted-foreground opacity-55",
                    FOCUS
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-md",
                      on ? meta.swatch : "bg-muted/50 text-muted-foreground"
                    )}
                  >
                    <Icon className="size-3" />
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate text-xs", !on && "line-through")}>
                    {item.label}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      on ? "bg-accent" : "bg-muted-foreground/25"
                    )}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {onRerun ? (
          <div className="flex items-center justify-between gap-inline-sm">
            <span role="status" className="text-2xs text-muted-foreground">
              {status === "running" ? "Rerunning…" : null}
              {status === "done" ? "Rerun complete." : null}
              {status === "error" ? <span className="text-destructive">Rerun failed.</span> : null}
              {status === "ready" ? `${excludedCount} off` : null}
            </span>
            <button
              type="button"
              disabled={status === "running" || includedCount === 0}
              onClick={() => void rerun()}
              className={cn(
                "rounded-lg bg-accent px-inset-sm py-1.5 text-xs font-medium text-accent-foreground",
                "disabled:opacity-40",
                FOCUS
              )}
            >
              Rerun
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <header className="space-y-stack-sm">
        <div className="flex items-start justify-between gap-inline-md">
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
            {block.question ? (
              <p className="text-xs leading-relaxed text-muted-foreground">{block.question}</p>
            ) : null}
          </div>
          <div
            className="shrink-0 rounded-lg bg-muted/50 px-2.5 py-1.5 text-right"
            aria-label={`${includedCount} of ${total} included`}
          >
            <p className="font-mono text-sm tabular-nums text-foreground">
              {includedCount}
              <span className="text-muted-foreground">/{total}</span>
            </p>
            <p className="text-2xs uppercase tracking-wide text-muted-foreground">on</p>
          </div>
        </div>

        {/* Inclusion rail — one segment per item, kind-colored when on. */}
        {inclusionRail}

        {kindTally.length > 1 ? (
          <ul className="flex flex-wrap gap-1.5" aria-label="By kind">
            {kindTally.map(({ kind, on, total: kindTotal }) => {
              const meta = KIND_META[kind];
              const { Icon } = meta;

              return (
                <li
                  key={kind}
                  className={cn(
                    "inline-flex items-center gap-inline-xs rounded-full px-inset-sm py-0.5 text-2xs",
                    meta.chip
                  )}
                >
                  <Icon aria-hidden className="size-3" />
                  <span>
                    {meta.label} {on}/{kindTotal}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </header>

      {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- explicit role keeps list semantics in Safari/VoiceOver under list-style reset */}
      <ul className={spacing.card.blockItems} role="list">
        {block.items.map((item) => {
          const on = Boolean(included[item.id]);
          const meta = KIND_META[item.kind];
          const { Icon } = meta;

          return (
            <li key={item.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-center gap-inline-md rounded-xl px-inset-md py-2.5 text-left transition-colors",
                  on ? "bg-muted/45" : "bg-muted/15 opacity-55",
                  FOCUS
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    on ? meta.swatch : "bg-muted/50 text-muted-foreground"
                  )}
                  aria-hidden
                >
                  <Icon className="size-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-inline-sm">
                    <span className="truncate text-sm text-foreground">{item.label}</span>
                    <span className="shrink-0 text-2xs uppercase tracking-wide text-muted-foreground">
                      {meta.label}
                    </span>
                  </span>
                  {item.detail ? (
                    <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground">
                      {item.detail}
                    </span>
                  ) : null}
                </span>

                <span
                  className={cn(
                    "relative h-5 w-9 shrink-0 rounded-full transition-colors",
                    on ? "bg-accent" : "bg-muted-foreground/25"
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full bg-background shadow-sm transition-transform",
                      on ? "left-4" : "left-0.5"
                    )}
                  />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div
        role="status"
        className="flex flex-wrap items-center gap-x-inline-sm gap-y-stack-xs text-xs text-muted-foreground"
      >
        <span>
          {excludedCount === 0
            ? "All context on for the next run."
            : `${excludedCount} off — ignored next run.`}
        </span>
        {status === "running" ? <span>Rerunning…</span> : null}
        {status === "done" ? <span>Rerun complete.</span> : null}
        {status === "error" ? <span className="text-destructive">Rerun failed.</span> : null}
        {!onRerun ? <span>Preview only.</span> : null}
      </div>

      {onRerun ? (
        <button
          type="button"
          disabled={status === "running" || includedCount === 0}
          onClick={() => void rerun()}
          className={cn(
            "min-h-11 rounded-lg bg-accent px-inset-md text-sm font-medium text-accent-foreground",
            "disabled:opacity-40",
            FOCUS
          )}
        >
          Rerun with selection
        </button>
      ) : null}

      {block.footnote ? <p className="text-xs text-muted-foreground">{block.footnote}</p> : null}
    </section>
  );
}
