"use client";

import type { StageOperation, StageRect, StageWidget } from "@/lib/stage/schema";

import { useState, type FormEvent } from "react";
import { X } from "lucide-react";

export function StageInspector({
  widget,
  saving,
  onChange,
  onClose,
}: {
  widget: StageWidget;
  saving: boolean;
  onChange: (operations: StageOperation[]) => Promise<boolean>;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<StageRect>(widget.rect);
  const [title, setTitle] = useState(widget.title);
  const [content, setContent] = useState(
    widget.kind === "note" ? widget.text : widget.kind === "mermaid" ? widget.code : ""
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    const updated: StageWidget =
      widget.kind === "note"
        ? { ...widget, title, rect, text: content }
        : widget.kind === "mermaid"
          ? { ...widget, title, rect, code: content }
          : { ...widget, title, rect };

    if (await onChange([{ type: "upsert", widget: updated }])) onClose();
  }

  return (
    <aside
      aria-label={`Arrange ${widget.title}`}
      className="stage-panel stage-inspector"
      role="dialog"
    >
      <header className="stage-panel-header">
        <h2>Give it space</h2>
        <button
          aria-label="Close arrangement"
          className="stage-icon-button"
          type="button"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>
      <form onSubmit={submit}>
        <label className="stage-field">
          Title
          <input
            maxLength={100}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="stage-rect-fields">
          {(
            [
              ["x", "Column"],
              ["y", "Row"],
              ["w", "Width"],
              ["h", "Height"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="stage-field">
              {label}
              <input
                max={32}
                min={1}
                required
                type="number"
                value={rect[key] + (key === "x" || key === "y" ? 1 : 0)}
                onChange={(e) =>
                  setRect((r) => ({
                    ...r,
                    [key]: Number(e.target.value) - (key === "x" || key === "y" ? 1 : 0),
                  }))
                }
              />
            </label>
          ))}
        </div>
        {(widget.kind === "note" || widget.kind === "mermaid") && (
          <label className="stage-field">
            {widget.kind === "note" ? "Note" : "Mermaid source"}
            <textarea
              maxLength={widget.kind === "note" ? 4000 : 8000}
              rows={5}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </label>
        )}
        <p className="stage-muted">Leave a cell between pieces. Organic keeps the center.</p>
        <div className="stage-panel-actions">
          <button
            className="stage-text-button"
            disabled={saving}
            type="button"
            onClick={async () => {
              if (await onChange([{ type: "remove", id: widget.id }])) onClose();
            }}
          >
            Remove piece
          </button>
          <button className="stage-solid-button" disabled={saving} type="submit">
            {saving ? "Saving…" : "Place it"}
          </button>
        </div>
      </form>
    </aside>
  );
}
