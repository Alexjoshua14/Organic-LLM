import {
  STAGE_AGENT_RECT,
  STAGE_CHILD_RECTS,
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

export type StageAgentReservation = {
  id: string;
  name: string;
  kind: "parent" | "designer" | "subagent";
  rect: StageRect;
  slot?: number;
};

export function stageAgentReservations(state: StageState): StageAgentReservation[] {
  const reservations: StageAgentReservation[] = [
    { id: "organic", name: "Organic", kind: "parent", rect: STAGE_AGENT_RECT },
  ];
  const used = new Set<number>();
  const add = (id: string, name: string, kind: "designer" | "subagent", preferred?: number) => {
    const slot =
      preferred !== undefined && !used.has(preferred)
        ? preferred
        : [0, 1].find((candidate) => !used.has(candidate));

    if (slot === undefined) return;
    used.add(slot);
    reservations.push({ id, name, kind, slot, rect: STAGE_CHILD_RECTS[slot] });
  };

  if (state.design && state.design.status !== "failed" && state.design.phase !== "queued")
    add(state.design.id, "Designer", "designer", state.design.slot);
  for (const agent of state.subagents ?? [])
    if (agent.status === "working" || agent.status === "canceling")
      add(agent.id, agent.name, "subagent", agent.slot);

  return reservations;
}

export function availableStageChildSlot(state: StageState, excludingId?: string): number | null {
  const used = new Set(
    stageAgentReservations(state)
      .filter((entry) => entry.kind !== "parent" && entry.id !== excludingId)
      .map((entry) => entry.slot)
  );

  return [0, 1].find((slot) => !used.has(slot)) ?? null;
}

export function stageReservedRects(state: StageState): StageRect[] {
  return stageAgentReservations(state)
    .filter((entry) => entry.kind !== "parent")
    .map((entry) => entry.rect);
}

/** Keep valid pieces fixed; relocate conflicts atomically, never discard their content. */
export function repairStageLayout(state: StageState): StageState {
  const reserved = stageReservedRects(state);
  const placed: StageWidget[] = [];
  const conflicts: StageWidget[] = [];

  for (const widget of state.widgets) {
    try {
      validateStageLayout([...placed, widget], reserved);
      placed.push(widget);
    } catch (error) {
      if (!(error instanceof StageLayoutError)) throw error;
      conflicts.push(widget);
    }
  }
  if (!conflicts.length) return state;
  for (const widget of conflicts) {
    const rect = findStagePlacement(placed, widget.rect.w, widget.rect.h, reserved);

    if (!rect)
      throw new StageLayoutError("No free cells for this layout. Remove or resize a piece first");
    placed.push({ ...widget, rect });
  }

  return {
    ...state,
    widgets: state.widgets.map((widget) => placed.find((item) => item.id === widget.id)!),
  };
}
