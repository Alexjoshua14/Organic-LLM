"use client";

import type { ContextSwitchboardBlock, ContextSwitchItem } from "@/lib/schemas/gen-ui";

import { useEffect, useMemo, useState } from "react";

import { spacing } from "@/lib/design-tokens/spacing";
import { cn } from "@/lib/utils";

const FOCUS =
  "organic-focus focus-visible:outline-none focus-visible:bg-foreground focus-visible:text-background";

type ContextSwitchboardProps = {
  block: ContextSwitchboardBlock;
  partial?: boolean;
  /**
   * Host reruns the same turn with only the included item ids.
   * Without it the board is preview-only.
   */
  onRerun?: (included: ContextSwitchItem[]) => void | Promise<void>;
};

export function ContextSwitchboard({ block, onRerun }: ContextSwitchboardProps) {
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
  const excludedCount = block.items.length - activeItems.length;

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

  return (
    <section className={cn("w-full rounded-2xl bg-muted/30 p-inset-md", spacing.card.section)}>
      <h3 className="text-sm font-medium text-foreground">{block.title}</h3>
      {block.question ? (
        <p className="text-sm text-muted-foreground">{block.question}</p>
      ) : null}

      <ul className={spacing.card.blockItems} role="list">
        {block.items.map((item) => {
          const on = Boolean(included[item.id]);

          return (
            <li key={item.id}>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => toggle(item.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl p-3 text-left",
                  on ? "bg-muted/40" : "bg-muted/20 opacity-70",
                  FOCUS
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 size-4 shrink-0 rounded border",
                    on ? "border-accent bg-accent" : "border-border/60 bg-transparent"
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-foreground">{item.label}</span>
                  <span className="block font-mono text-xs text-muted-foreground">{item.kind}</span>
                  {item.detail ? (
                    <span className="mt-1 block text-xs text-muted-foreground">{item.detail}</span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div role="status" className="text-sm text-muted-foreground">
        {excludedCount === 0
          ? "All context included."
          : `${excludedCount} ignored for the next run.`}
        {status === "running" ? " Rerunning…" : null}
        {status === "done" ? " Rerun complete." : null}
        {status === "error" ? " Rerun failed." : null}
        {!onRerun ? " Preview only — host must bind rerun." : null}
      </div>

      {onRerun ? (
        <button
          type="button"
          disabled={status === "running" || activeItems.length === 0}
          onClick={() => void rerun()}
          className={cn(
            "min-h-11 rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground",
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
