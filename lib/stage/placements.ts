import type { StageRect, StageWidget } from "./schema";
import type { StageView } from "./view-schema";

export const STAGE_OVERVIEW: StageView = { kind: "overview", id: null };

export function stageViewWidgets(widgets: StageWidget[], view: StageView): StageWidget[] {
  return view.kind === "organic"
    ? []
    : view.kind === "author"
      ? widgets.filter((widget) => widget.source?.id === view.id)
      : view.kind === "piece"
        ? widgets.filter((widget) => widget.id === view.id)
        : widgets;
}

/** Resolve a saved placement, never fit or rearrange at render time. */
export function stageWidgetRect(widget: StageWidget, view: StageView): StageRect {
  if (view.kind === "author" && widget.source?.id === view.id)
    return widget.layouts?.author ?? widget.rect;
  if (view.kind === "piece" && widget.id === view.id) return widget.layouts?.piece ?? widget.rect;

  return widget.rect;
}

export function placeStageWidget(
  widget: StageWidget,
  view: StageView,
  rect: StageRect
): StageWidget {
  if (view.kind === "author" && widget.source?.id === view.id)
    return { ...widget, layouts: { ...widget.layouts, author: rect } };
  if (view.kind === "piece" && widget.id === view.id)
    return { ...widget, layouts: { ...widget.layouts, piece: rect } };
  if (view.kind !== "overview") throw new Error("This piece does not belong to the selected view");

  return { ...widget, rect };
}
