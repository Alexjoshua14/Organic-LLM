import type { DesignPlan } from "./agent";
import type { StageRect, StageState, StageWidget } from "./schema";

import {
  findStagePlacement,
  initializeStageViewLayouts,
  repairStageLayout,
  stageReservedRects,
  StageLayoutError,
  validateStageLayout,
} from "./layout";
import { STAGE_OVERVIEW, placeStageWidget, stageViewWidgets, stageWidgetRect } from "./placements";
import type { StageView } from "./view-schema";

type Upsert = Extract<DesignPlan["operations"][number], { operation: "upsert" }>;

function dimensions(kind: StageWidget["kind"]) {
  return kind === "chat"
    ? ([11, 16] as const)
    : kind === "recipe"
      ? ([11, 16] as const)
      : kind === "mermaid"
        ? ([11, 16] as const)
        : ([11, 12] as const);
}

function proposedWidget(
  item: Upsert,
  rect: StageRect,
  threadId?: string,
  widgetId = crypto.randomUUID()
): StageWidget {
  const base = { id: widgetId, title: item.title, rect };

  switch (item.kind) {
    case "note":
      if (item.text === null) throw new StageLayoutError("Note content is required");

      return { ...base, kind: "note", text: item.text };
    case "mermaid":
      if (!item.code) throw new StageLayoutError("Diagram source is required");

      return { ...base, kind: "mermaid", code: item.code };
    case "recipe":
      if (!item.ingredients?.length || !item.steps?.length)
        throw new StageLayoutError("Recipe ingredients and steps are required");

      return {
        ...base,
        kind: "recipe",
        recipe: {
          type: "recipe-card",
          version: 1,
          title: item.title,
          ingredients: item.ingredients.map((name) => ({ name })),
          steps: item.steps,
        },
      };
    case "chat":
      if (!threadId) throw new StageLayoutError("Chat thread is required");

      return { ...base, kind: "chat", threadId };
  }
}

function unchangedTarget(current: StageWidget[], base: StageState, id: string) {
  const original = base.widgets.find((widget) => widget.id === id);
  const index = current.findIndex((widget) => widget.id === id);

  if (!original || index < 0)
    throw new StageLayoutError("A design target no longer exists. Retry the design.");
  if (JSON.stringify(original) !== JSON.stringify(current[index])) {
    throw new StageLayoutError("A design target changed. Retry the design.");
  }

  return { original, index };
}

export function mergeStageDesignPlan(
  current: StageState,
  base: StageState,
  plan: DesignPlan,
  chatIds: Map<number, string>,
  widgetIds: Map<number, string> = new Map()
) {
  const widgets = [...current.widgets];

  for (const [index, operation] of plan.operations.entries()) {
    if (operation.operation === "remove") {
      const target = unchangedTarget(widgets, base, operation.targetId);

      widgets.splice(target.index, 1);
      continue;
    }
    const view: StageView = operation.view ?? base.presentation?.view ?? STAGE_OVERVIEW;
    if (operation.operation === "move") {
      const target = unchangedTarget(widgets, base, operation.targetId);
      const targetView =
        operation.view ??
        (stageViewWidgets([target.original], view).length ? view : STAGE_OVERVIEW);

      widgets[target.index] = placeStageWidget(target.original, targetView, operation.rect);
      continue;
    }
    if (operation.targetId) {
      const target = unchangedTarget(widgets, base, operation.targetId);

      if (target.original.kind !== operation.kind)
        throw new StageLayoutError("Widget kind cannot change");
      const targetView =
        operation.view ??
        (stageViewWidgets([target.original], view).length ? view : STAGE_OVERVIEW);
      const rect = operation.rect ?? stageWidgetRect(target.original, targetView);
      const placed = placeStageWidget(target.original, targetView, rect);

      if (operation.kind === "chat") {
        // Its thread is server-owned and stays attached to the stable widget ID.
        widgets[target.index] = { ...placed, title: operation.title };
      } else {
        widgets[target.index] = {
          ...proposedWidget(operation, placed.rect),
          id: target.original.id,
          ...(placed.layouts ? { layouts: placed.layouts } : {}),
          ...(target.original.source ? { source: target.original.source } : {}),
        };
      }
      continue;
    }
    const [w, h] = dimensions(operation.kind);
    const rect = operation.rect ?? findStagePlacement(widgets, w, h, stageReservedRects(current));

    if (!rect) throw new StageLayoutError("No free space for the requested widget");
    widgets.push(proposedWidget(operation, rect, chatIds.get(index), widgetIds.get(index)));
  }
  try {
    validateStageLayout(widgets, stageReservedRects(current));

    return initializeStageViewLayouts(widgets, stageReservedRects(current));
  } catch (error) {
    if (!(error instanceof StageLayoutError)) throw error;
    // Keep unchanged pieces anchored; repair only proposed conflicts first.
    const unchanged = widgets.filter((widget) => current.widgets.includes(widget));
    const changed = widgets.filter((widget) => !current.widgets.includes(widget));
    const repaired = repairStageLayout({ ...current, widgets: [...unchanged, ...changed] });

    return widgets.map((widget) => repaired.widgets.find((piece) => piece.id === widget.id)!);
  }
}
