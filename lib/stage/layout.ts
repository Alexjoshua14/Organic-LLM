import {
  STAGE_AGENT_RECT,
  STAGE_SUBAGENT_RECT,
  stageSubagentActive,
  type StageState,
  STAGE_MAX_WIDGETS,
  StageWidgetSchema,
  type StageOperation,
  type StageRect,
  type StageWidget,
} from "./schema";

export class StageLayoutError extends Error {}

export function touchesWithGap(a: StageRect, b: StageRect) {
  return a.x < b.x + b.w + 1 && a.x + a.w + 1 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y;
}

export function validateStageLayout(widgets: StageWidget[], reserved: StageRect[] = []) {
  if (widgets.length > STAGE_MAX_WIDGETS) throw new StageLayoutError("Too many widgets");
  const ids = new Set<string>();

  for (const widget of widgets) {
    StageWidgetSchema.parse(widget);
    if (ids.has(widget.id)) throw new StageLayoutError("Duplicate widget ID");
    ids.add(widget.id);
    if (reserved.some((rect) => touchesWithGap(widget.rect, rect)))
      throw new StageLayoutError("Widget overlaps active subagents");
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

export function applyStageOperations(
  widgets: StageWidget[],
  operations: StageOperation[],
  reserved: StageRect[] = []
) {
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
  validateStageLayout(next, reserved);

  return next;
}

export function findStagePlacement(
  widgets: StageWidget[],
  w: number,
  h: number,
  reserved: StageRect[] = []
): StageRect | null {
  for (let y = 0; y <= 32 - h; y++) {
    for (let x = 0; x <= 32 - w; x++) {
      const rect = { x, y, w, h };

      try {
        validateStageLayout(
          [
            ...widgets,
            { id: crypto.randomUUID(), kind: "note", title: "Placement", rect, text: "" },
          ],
          reserved
        );

        return rect;
      } catch (error) {
        if (!(error instanceof StageLayoutError)) throw error;
      }
    }
  }

  return null;
}

export function stageReservedRects(state: StageState): StageRect[] {
  return state.subagents?.some(stageSubagentActive) ? [STAGE_SUBAGENT_RECT] : [];
}

/** Move only pieces that occupy the temporary child branch. Fail atomically if it cannot fit. */
export function reserveStageSubagentSpace(widgets: StageWidget[]): StageWidget[] {
  const next = [...widgets];

  for (const [index, widget] of next.entries()) {
    if (!touchesWithGap(widget.rect, STAGE_SUBAGENT_RECT)) continue;
    const rect = findStagePlacement(
      next.filter((_, i) => i !== index),
      widget.rect.w,
      widget.rect.h,
      [STAGE_SUBAGENT_RECT]
    );

    if (!rect) throw new StageLayoutError("Make room below Organic before starting subagents");
    next[index] = { ...widget, rect };
  }
  validateStageLayout(next, [STAGE_SUBAGENT_RECT]);

  return next;
}
