import type { StageWorkerPiece } from "./worker-output";

import { findStagePlacement, stageReservedRects } from "./layout";
import { STAGE_MAX_WIDGETS, type StageState, type StageWidget } from "./schema";

export function stageDiagramSources(text: string): string[] {
  return [...text.matchAll(/```mermaid[^\n]*\n([\s\S]*?)```/gi)]
    .map((match) => match[1].trim())
    .filter((code) => code.length > 0 && code.length <= 8000)
    .slice(0, 2);
}

/** A response caption carries prose; generated artifacts get owned, validated canvas cells. */
export function placeStageArtifacts(
  state: StageState,
  text: string,
  author: string,
  sourceId?: string
): StageState {
  const widgets = [...state.widgets];

  for (const code of stageDiagramSources(text)) {
    if (widgets.some((widget) => widget.kind === "mermaid" && widget.code === code)) continue;
    if (widgets.length >= STAGE_MAX_WIDGETS) break;
    const rect = findStagePlacement(widgets, 10, 12, stageReservedRects(state));

    if (!rect) break;
    widgets.push({
      id: crypto.randomUUID(),
      kind: "mermaid",
      title: `${author} diagram`.slice(0, 100),
      code,
      rect,
      ...(sourceId ? { source: { id: sourceId, name: author } } : {}),
    });
  }

  return widgets.length === state.widgets.length ? state : { ...state, widgets };
}

/** A specialist publishes content, not a second miniature transcript. Geometry is server-owned. */
export function placeStageWorkerPieces(
  state: StageState,
  pieces: StageWorkerPiece[],
  source: { id: string; name: string },
  fallbackText = ""
): StageState {
  let next = placeStageArtifacts(state, fallbackText, source.name, source.id);
  const work = pieces.length
    ? pieces
    : fallbackText.length > 240 && !stageDiagramSources(fallbackText).length
      ? [
          {
            kind: "note" as const,
            title: source.name,
            text: fallbackText.slice(0, 4000),
            code: null,
            ingredients: null,
            steps: null,
          },
        ]
      : [];

  for (const piece of work) {
    if (next.widgets.length >= STAGE_MAX_WIDGETS) break;
    if (next.widgets.some((w) => w.source?.id === source.id && w.title === piece.title)) continue;
    const rect =
      findStagePlacement(
        next.widgets,
        11,
        piece.kind === "recipe" ? 16 : 12,
        stageReservedRects(next)
      ) ??
      findStagePlacement(next.widgets, 7, 6, stageReservedRects(next)) ??
      findStagePlacement(next.widgets, 1, 1, stageReservedRects(next));

    if (!rect) continue;
    const base = { id: crypto.randomUUID(), title: piece.title, rect, source };
    let widget: StageWidget;

    if (piece.kind === "mermaid" && piece.code)
      widget = { ...base, kind: "mermaid", code: piece.code };
    else if (piece.kind === "recipe" && piece.ingredients?.length && piece.steps?.length)
      widget = {
        ...base,
        kind: "recipe",
        recipe: {
          type: "recipe-card",
          version: 1,
          title: piece.title,
          ingredients: piece.ingredients.map((name) => ({ name })),
          steps: piece.steps,
        },
      };
    else if (piece.kind === "note" && piece.text?.trim())
      widget = { ...base, kind: "note", text: piece.text };
    else continue;
    next = { ...next, widgets: [...next.widgets, widget] };
  }

  return next;
}

export function stageCaptionText(text: string, diagramAvailable = false): string {
  return text
    .replace(
      /```mermaid[^\n]*\n[\s\S]*?(?:```|$)/gi,
      diagramAvailable
        ? "\n\nDiagram on the stage.\n\n"
        : "\n\nDiagram source is available in Conversation; make room on the stage to place it.\n\n"
    )
    .trim();
}
