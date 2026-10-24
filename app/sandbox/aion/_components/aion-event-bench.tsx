"use client";

import { useState } from "react";

import { useAionPresence } from "./aion-presence-provider";

import { glass } from "@/components/design-system/primitives";
import { cn } from "@/lib/utils";

/**
 * Sandbox event bench: fires the presence event kinds the plan lists so coalescing,
 * micro-turns, and the HUD can be exercised without wiring production gen-UI yet.
 */
export function AionEventBench({ className }: { className?: string }) {
  const { emit } = useAionPresence();
  const [selectValue, setSelectValue] = useState("option-a");
  const [bursting, setBursting] = useState(false);

  const fireBurst = () => {
    setBursting(true);
    for (let i = 0; i < 20; i += 1) {
      window.setTimeout(() => {
        emit({
          kind: "button",
          surface: "event-bench",
          label: "Burst click",
          payload: { index: i },
        });
        if (i === 19) setBursting(false);
      }, i * 40);
    }
  };

  return (
    <div
      className={cn(
        glass({ opaque: true }),
        "rounded-xl border border-border/60 p-3 text-sm",
        className
      )}
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Event bench
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs hover:bg-background-secondary"
          type="button"
          onClick={() =>
            emit({
              kind: "ui.action",
              surface: "event-bench",
              label: "opened sample card",
              payload: { cardId: "sample-1" },
            })
          }
        >
          Card action
        </button>
        <button
          className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs hover:bg-background-secondary"
          type="button"
          onClick={() =>
            emit({
              kind: "button",
              surface: "event-bench",
              label: "pressed Save",
            })
          }
        >
          Button
        </button>
        <label className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs">
          Select
          <select
            className="bg-transparent"
            value={selectValue}
            onChange={(e) => {
              const value = e.target.value;

              setSelectValue(value);
              emit({
                kind: "ui.select",
                surface: "event-bench",
                label: `selected ${value}`,
                payload: { value },
              });
            }}
          >
            <option value="option-a">A</option>
            <option value="option-b">B</option>
            <option value="option-c">C</option>
          </select>
        </label>
        <button
          className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs hover:bg-background-secondary"
          type="button"
          onClick={() =>
            emit({
              kind: "system",
              surface: "event-bench",
              label: "timer tick",
              payload: { at: Date.now() },
            })
          }
        >
          Timer / system
        </button>
        <button
          className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs hover:bg-background-secondary"
          type="button"
          onClick={() =>
            emit({
              kind: "system",
              surface: "event-bench",
              label: "hover card",
            })
          }
        >
          Hover (ledger only)
        </button>
        <button
          className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs hover:bg-background-secondary"
          type="button"
          onClick={() =>
            emit({
              kind: "callback",
              surface: "event-bench",
              label: "async callback resolved",
              payload: { ok: true },
            })
          }
        >
          Callback
        </button>
        <button
          className="rounded-md border border-border bg-background/80 px-2.5 py-1 text-xs hover:bg-background-secondary"
          disabled={bursting}
          type="button"
          onClick={fireBurst}
        >
          {bursting ? "Bursting…" : "Burst 20 clicks"}
        </button>
        <button
          className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-xs hover:bg-primary/20"
          type="button"
          onClick={() =>
            emit({
              kind: "message",
              surface: "event-bench",
              label: "What are you noticing right now?",
            })
          }
        >
          Ask Aion (full)
        </button>
      </div>
    </div>
  );
}
