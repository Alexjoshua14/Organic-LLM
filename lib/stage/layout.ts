import {
  STAGE_AGENT_RECT,
  STAGE_CHILD_RECTS,
  STAGE_HEADER_RECT,
  STAGE_RESPONSE_RECT,
  STAGE_COMPOSER_RECT,
  STAGE_CONTENT_RECT,
  type StageState,
  STAGE_MAX_WIDGETS,
  StageWidgetSchema,
  type StageOperation,
  type StageRect,
  type StageWidget,
} from "./schema";
import { STAGE_OVERVIEW, placeStageWidget, stageViewWidgets, stageWidgetRect } from "./placements";
import type { StageView } from "./view-schema";

export class StageLayoutError extends Error {}

export const stageChromeReservations = [
  STAGE_HEADER_RECT,
  STAGE_RESPONSE_RECT,
  STAGE_COMPOSER_RECT,
];

export function touchesWithGap(a: StageRect, b: StageRect) {
  return a.x < b.x + b.w + 1 && a.x + a.w + 1 > b.x && a.y < b.y + b.h + 1 && a.y + a.h + 1 > b.y;
}

export function validateStageLayout(
  widgets: StageWidget[],
  reserved: StageRect[] = [],
  view: StageView = STAGE_OVERVIEW
) {
  if (widgets.length > STAGE_MAX_WIDGETS) throw new StageLayoutError("Too many widgets");
  const ids = new Set<string>();

  for (const widget of widgets) {
    StageWidgetSchema.parse(widget);
    if (ids.has(widget.id)) throw new StageLayoutError("Duplicate widget ID");
    ids.add(widget.id);
  }
  const visible = stageViewWidgets(widgets, view).map((widget) => ({
    ...widget,
    rect: stageWidgetRect(widget, view),
  }));
  for (const widget of visible) {
    const { x, y, w, h } = widget.rect;

    if (
      x < STAGE_CONTENT_RECT.x ||
      y < STAGE_CONTENT_RECT.y ||
      x + w > 32 ||
      y + h > STAGE_CONTENT_RECT.y + STAGE_CONTENT_RECT.h
    )
      throw new StageLayoutError(
        "Widget needs artifact cells between navigation, response, and composer"
      );
    if (stageChromeReservations.some((rect) => touchesWithGap(widget.rect, rect)))
      throw new StageLayoutError("Widget overlaps Stage navigation, response, or composer cells");
    if (reserved.some((rect) => touchesWithGap(widget.rect, rect)))
      throw new StageLayoutError("Widget overlaps active subagents");
    if (touchesWithGap(widget.rect, STAGE_AGENT_RECT)) {
      throw new StageLayoutError("Widget overlaps the central agent");
    }
  }
  for (let i = 0; i < visible.length; i++) {
    for (let j = i + 1; j < visible.length; j++) {
      if (touchesWithGap(visible[i].rect, visible[j].rect)) {
        throw new StageLayoutError("Widgets require a one-cell gap");
      }
    }
  }
}

export function validateStageLayouts(widgets: StageWidget[], reserved: StageRect[] = []) {
  validateStageLayout(widgets, reserved);
  for (const id of new Set(
    widgets.flatMap((widget) => (widget.source ? [widget.source.id] : []))
  )) {
    const view: StageView = { kind: "author", id };
    if (stageViewWidgets(widgets, view).every((widget) => widget.layouts?.author))
      validateStageLayout(widgets, reserved, view);
  }
  for (const widget of widgets)
    validateStageLayout(widgets, reserved, { kind: "piece", id: widget.id });
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
      if (!stageViewWidgets([next[index]], operation.view ?? STAGE_OVERVIEW).length)
        throw new StageLayoutError("Widget does not belong to this view");
      next[index] = placeStageWidget(next[index], operation.view ?? STAGE_OVERVIEW, operation.rect);
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
      // Older clients/designers may not send placements; don't erase another tab's arrangement.
      next[index] = { ...operation.widget, layouts: operation.widget.layouts ?? old.layouts };
    } else {
      // Chat thread IDs are minted server-side by the designer, never accepted from a client mutation.
      if (operation.widget.kind === "chat")
        throw new StageLayoutError("Chat widgets cannot be created here");
      next.push(operation.widget);
    }
  }
  validateStageLayouts(next, reserved);

  return initializeStageViewLayouts(next, reserved);
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
function repairStageOverview(state: StageState): StageState {
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
    const rect =
      findStagePlacement(
        placed,
        Math.min(widget.rect.w, STAGE_CONTENT_RECT.w),
        Math.min(widget.rect.h, STAGE_CONTENT_RECT.h),
        reserved
      ) ??
      findStagePlacement(placed, 4, 4, reserved) ??
      findStagePlacement(placed, 1, 1, reserved);

    if (!rect) {
      // Older snapshots may contain more work than the new frame can show at once.
      // Preserve every piece in valid cells. Rendering must use these saved rectangles as-is.
      const compact: StageWidget[] = [];

      for (const original of state.widgets) {
        const cell = findStagePlacement(compact, 1, 1, reserved);

        if (!cell) throw new StageLayoutError("No free cells for this layout");
        compact.push({ ...original, rect: cell });
      }

      return { ...state, widgets: compact };
    }
    placed.push({ ...widget, rect });
  }

  return {
    ...state,
    widgets: state.widgets.map((widget) => placed.find((item) => item.id === widget.id)!),
  };
}

/** Seed a real saved arrangement on publication/migration, never when a tab is selected. */
export function initializeStageViewLayouts(widgets: StageWidget[], reserved: StageRect[] = []) {
  const compactLegacy = widgets.some(
    (widget) => !widget.layouts?.piece && (widget.rect.w < 4 || widget.rect.h < 4)
  );
  let next = widgets.map((widget, index) => {
    const saved = compactLegacy
      ? { ...widget, rect: packedStageRect(index, widgets.length) }
      : widget;

    return saved.layouts?.piece
      ? saved
      : {
          ...saved,
          layouts: { ...saved.layouts, piece: { ...STAGE_CONTENT_RECT } },
        };
  });
  const authors = new Set(widgets.flatMap((widget) => (widget.source ? [widget.source.id] : [])));

  for (const id of authors) {
    const view: StageView = { kind: "author", id };
    const group = stageViewWidgets(next, view);
    try {
      if (group.every((widget) => widget.layouts?.author)) {
        validateStageLayout(next, reserved, view);
        continue;
      }
    } catch (error) {
      if (!(error instanceof StageLayoutError)) throw error;
    }
    // Membership changed or an old arrangement is invalid. Save a balanced layout for this tab.
    next = next.map((widget) => {
      const index = group.findIndex((piece) => piece.id === widget.id);
      if (index < 0) return widget;

      return placeStageWidget(widget, view, packedStageRect(index, group.length));
    });
  }
  // Restore bad focus placements without touching valid authored cells.
  next = next.map((widget) => {
    try {
      validateStageLayout([widget], reserved, { kind: "piece", id: widget.id });
      return widget;
    } catch (error) {
      if (!(error instanceof StageLayoutError)) throw error;
      return placeStageWidget(widget, { kind: "piece", id: widget.id }, { ...STAGE_CONTENT_RECT });
    }
  });
  validateStageLayouts(next, reserved);

  return next.every((widget, index) => widget === widgets[index]) ? widgets : next;
}

function packedStageRect(index: number, count: number): StageRect {
  const area = STAGE_CONTENT_RECT;
  const columns = Math.min(count, Math.ceil(Math.sqrt((count * area.w) / area.h)));
  const rows = Math.ceil(count / columns);
  const w = Math.floor((area.w - columns + 1) / columns);
  const h = Math.floor((area.h - rows + 1) / rows);

  return {
    x: area.x + (index % columns) * (w + 1),
    y: area.y + Math.floor(index / columns) * (h + 1),
    w,
    h,
  };
}

export function repairStageLayout(state: StageState): StageState {
  const repaired = repairStageOverview(state);
  const widgets = initializeStageViewLayouts(repaired.widgets, stageReservedRects(repaired));

  return widgets === repaired.widgets ? repaired : { ...repaired, widgets };
}
