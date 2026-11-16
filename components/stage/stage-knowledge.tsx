"use client";

import type { StageOperation, StageWidget } from "@/lib/stage/schema";

import { useState } from "react";
import { Check, X } from "lucide-react";

type Collection = Extract<StageWidget, { kind: "collection" }>;
type Recall = Extract<StageWidget, { kind: "recall" }>;

const DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function shortDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : DATE.format(date);
}

/** A living list: the agent files into it; the user checks off or lets go of items in place. */
export function StageCollection({
  widget,
  onChange,
}: {
  widget: Collection;
  onChange?: (operations: StageOperation[]) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  async function save(items: Collection["items"]) {
    if (!onChange || busy) return;
    setBusy(true);
    try {
      await onChange([{ type: "upsert", widget: { ...widget, items } }]);
    } finally {
      setBusy(false);
    }
  }

  if (!widget.items.length) return <p className="stage-muted">Nothing filed here yet.</p>;

  return (
    <ul className="stage-collection" aria-busy={busy}>
      {widget.items.map((item) => (
        <li key={item.id} className="stage-collection-item" data-done={item.done ?? false}>
          <button
            aria-label={item.done ? `Reopen “${item.text}”` : `Mark “${item.text}” done`}
            aria-pressed={item.done ?? false}
            className="stage-collection-check"
            disabled={!onChange || busy}
            type="button"
            onClick={() =>
              save(
                widget.items.map((entry) =>
                  entry.id === item.id ? { ...entry, done: !entry.done } : entry
                )
              )
            }
          >
            {item.done && <Check size={12} />}
          </button>
          <span className="stage-collection-text">{item.text}</span>
          <button
            aria-label={`Let go of “${item.text}”`}
            className="stage-icon-button stage-collection-remove"
            disabled={!onChange || busy}
            title="Let go"
            type="button"
            onClick={() => save(widget.items.filter((entry) => entry.id !== item.id))}
          >
            <X size={12} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/** What long-term memory surfaced for the latest relevant thought. Refreshed in place. */
export function StageRecall({ widget }: { widget: Recall }) {
  return (
    <div className="stage-recall">
      <p className="stage-recall-query">
        <span className="stage-muted">Recalling</span> {widget.query}
      </p>
      {widget.items.length ? (
        <ul className="stage-recall-list">
          {widget.items.map((item, index) => (
            <li key={`${index}:${item.text.slice(0, 24)}`}>
              <span>{item.text}</span>
              {shortDate(item.at) && <time dateTime={item.at!}>{shortDate(item.at)}</time>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="stage-muted">Nothing earlier matched this yet.</p>
      )}
    </div>
  );
}
