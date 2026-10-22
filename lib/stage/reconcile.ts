import type { DesignPlan } from "./agent";
import { findStagePlacement, StageLayoutError, validateStageLayout } from "./layout";
import type { StageRect, StageState, StageWidget } from "./schema";

type Upsert = Extract<DesignPlan["operations"][number], { operation: "upsert" }>;

function dimensions(kind: StageWidget["kind"]) {
  return kind === "chat" ? [9, 10] as const : kind === "recipe" ? [9, 9] as const : kind === "mermaid" ? [10, 8] as const : [7, 6] as const;
}

function proposedWidget(item: Upsert, rect: StageRect, threadId?: string, widgetId = crypto.randomUUID()): StageWidget {
  const base = { id: widgetId, title: item.title, rect };
  switch (item.kind) {
    case "note":
      if (item.text === null) throw new StageLayoutError("Note content is required");
      return { ...base, kind: "note", text: item.text };
    case "mermaid":
      if (!item.code) throw new StageLayoutError("Diagram source is required");
      return { ...base, kind: "mermaid", code: item.code };
    case "recipe":
      if (!item.ingredients?.length || !item.steps?.length) throw new StageLayoutError("Recipe ingredients and steps are required");
      return { ...base, kind: "recipe", recipe: {
        type: "recipe-card", version: 1, title: item.title,
        ingredients: item.ingredients.map((name) => ({ name })), steps: item.steps,
      } };
    case "chat":
      if (!threadId) throw new StageLayoutError("Chat thread is required");
      return { ...base, kind: "chat", threadId };
  }
}

function unchangedTarget(current: StageWidget[], base: StageState, id: string) {
  const original = base.widgets.find((widget) => widget.id === id);
  const index = current.findIndex((widget) => widget.id === id);
  if (!original || index < 0) throw new StageLayoutError("A design target no longer exists. Retry the design.");
  if (JSON.stringify(original) !== JSON.stringify(current[index])) {
    throw new StageLayoutError("A design target changed. Retry the design.");
  }
  return { original, index };
}

export function mergeStageDesignPlan(current: StageState, base: StageState, plan: DesignPlan, chatIds: Map<number, string>, widgetIds: Map<number, string> = new Map()) {
  const widgets = [...current.widgets];
  for (const [index, operation] of plan.operations.entries()) {
    if (operation.operation === "remove") {
      const target = unchangedTarget(widgets, base, operation.targetId);
      widgets.splice(target.index, 1);
      continue;
    }
    if (operation.operation === "move") {
      const target = unchangedTarget(widgets, base, operation.targetId);
      widgets[target.index] = { ...target.original, rect: operation.rect };
      continue;
    }
    if (operation.targetId) {
      const target = unchangedTarget(widgets, base, operation.targetId);
      if (target.original.kind !== operation.kind) throw new StageLayoutError("Widget kind cannot change");
      const rect = operation.rect ?? target.original.rect;
      if (operation.kind === "chat") {
        // Its thread is server-owned and stays attached to the stable widget ID.
        widgets[target.index] = { ...target.original, title: operation.title, rect };
      } else {
        widgets[target.index] = { ...proposedWidget(operation, rect), id: target.original.id };
      }
      continue;
    }
    const [w, h] = dimensions(operation.kind);
    const rect = operation.rect ?? findStagePlacement(widgets, w, h);
    if (!rect) throw new StageLayoutError("No free space for the requested widget");
    widgets.push(proposedWidget(operation, rect, chatIds.get(index), widgetIds.get(index)));
  }
  validateStageLayout(widgets);
  return widgets;
}
