"use client";

import type { StageOperation, StageRect, StageWidget, StageState } from "@/lib/stage/schema";

import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";

import { stageReservedRects, validateStageLayout } from "@/lib/stage/layout";

const PLACEMENT_PREVIEW_MS = 150;

export function StageInspector({
  widget,
  saving,
  onChange,
  onClose,
  state,
  onPreview,
}: {
  widget: StageWidget;
  saving: boolean;
  onChange: (operations: StageOperation[]) => Promise<boolean>;
  onClose: () => void;
  state: StageState;
  onPreview: (rect: StageRect | null) => void;
}) {
  const [rect, setRect] = useState<StageRect>(widget.rect);
  const [title, setTitle] = useState(widget.title);
  const [placementError, setPlacementError] = useState<string | null>(null);
  const [content, setContent] = useState(
    widget.kind === "note" ? widget.text : widget.kind === "mermaid" ? widget.code : ""
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        validateStageLayout(
          state.widgets.map((w) => (w.id === widget.id ? { ...w, rect } : w)),
          stageReservedRects(state)
        );
        setPlacementError(null);
        onPreview(rect);
      } catch {
        setPlacementError(
          "This placement needs free cells and a one-cell gap. The last valid preview is still shown."
        );
      }
    }, PLACEMENT_PREVIEW_MS);

    return () => clearTimeout(timer);
  }, [rect, state, widget.id, onPreview]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      validateStageLayout(
        state.widgets.map((w) => (w.id === widget.id ? { ...w, rect } : w)),
        stageReservedRects(state)
      );
    } catch {
      setPlacementError("This placement needs free cells and a one-cell gap.");

      return;
    }
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
        <p className="stage-muted stage-placement-status" role="status">
          {placementError ??
            "Previewing placement. Place it to save; close to keep the saved position."}
        </p>
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
