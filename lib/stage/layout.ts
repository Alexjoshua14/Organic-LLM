import {
  STAGE_AGENT_RECT,
  STAGE_MAX_WIDGETS,
  StageWidgetSchema,
  type StageOperation,
  type StageRect,
  type StageWidget,
} from "./schema";

export class StageLayoutError extends Error {}

function touchesWithGap(a: StageRect, b: StageRect) {
  return a.x < b.x + b.w + 1 && a.x + a.w + 1 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y;
}

export function validateStageLayout(widgets: StageWidget[]) {
  if (widgets.length > STAGE_MAX_WIDGETS) throw new StageLayoutError("Too many widgets");
  const ids = new Set<string>();
  for (const widget of widgets) {
    StageWidgetSchema.parse(widget);
    if (ids.has(widget.id)) throw new StageLayoutError("Duplicate widget ID");
    ids.add(widget.id);
    if (touchesWithGap(widget.rect, STAGE_AGENT_RECT)) {
      throw new StageLayoutError("Widget overlaps the central agent");
    }
  }
  for (let i = 0; i < widgets.length; i++) {
    for (let j = i + 1; j < widgets.length; j++) {
      if (touchesWithGap(widgets[i].rect, widgets[j].rect)) {
        throw new StageLayoutError("Widgets require a one-cell gap");
      }
    }
  }
}

export function applyStageOperations(widgets: StageWidget[], operations: StageOperation[]) {
  const next = [...widgets];
  for (const operation of operations) {
    const index = next.findIndex(
      (widget) => widget.id === (operation.type === "upsert" ? operation.widget.id : operation.id)
    );
    if (operation.type === "remove") {
      if (index < 0) throw new StageLayoutError("Widget does not exist");
      next.splice(index, 1);
    } else if (operation.type === "move") {
      if (index < 0) throw new StageLayoutError("Widget does not exist");
      next[index] = { ...next[index], rect: operation.rect };
    } else if (index >= 0) {
      const old = next[index];
      if (
        old.kind !== operation.widget.kind ||
        (old.kind === "chat" &&
          operation.widget.kind === "chat" &&
          old.threadId !== operation.widget.threadId)
      ) {
        throw new StageLayoutError("Widget identity cannot change");
      }
      next[index] = operation.widget;
    } else {
      // Chat thread IDs are minted server-side by the designer, never accepted from a client mutation.
      if (operation.widget.kind === "chat")
        throw new StageLayoutError("Chat widgets cannot be created here");
      next.push(operation.widget);
    }
  }
  validateStageLayout(next);
  return next;
}

export function findStagePlacement(widgets: StageWidget[], w: number, h: number): StageRect | null {
  for (let y = 0; y <= 32 - h; y++) {
    for (let x = 0; x <= 32 - w; x++) {
      const rect = { x, y, w, h };
      try {
        validateStageLayout([
          ...widgets,
          { id: crypto.randomUUID(), kind: "note", title: "Placement", rect, text: "" },
        ]);
        return rect;
      } catch (error) {
        if (!(error instanceof StageLayoutError)) throw error;
      }
    }
  }
  return null;
}
