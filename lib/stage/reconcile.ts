import type { DesignPlan } from "./agent";
import { STAGE_CONTENT_RECT, type StageRect, type StageState, type StageWidget } from "./schema";

import {
  findStagePlacement,
  packedStageRect,
  initializeStageViewLayouts,
  repairStageLayout,
  stageReservedRects,
  StageLayoutError,
  validateStageLayout,
} from "./layout";
import { STAGE_OVERVIEW, placeStageWidget, stageViewWidgets, stageWidgetRect } from "./placements";
import { parseDesignerBlock } from "./block-shapes";
import { isEmbeddableStageUrl } from "./web-url";
import type { StageView } from "./view-schema";

type Upsert = Extract<DesignPlan["operations"][number], { operation: "upsert" }>;
/** The content fields shared by designer upserts and specialist pieces. */
export type StagePieceContent = Pick<
  Upsert,
  "kind" | "title" | "text" | "code" | "ingredients" | "steps"
> &
  // Only block and web pieces carry these; other producers may leave them out.
  Partial<Pick<Upsert, "block" | "url">>;

function dimensions(kind: StageWidget["kind"]) {
  return kind === "chat"
    ? ([11, 16] as const)
    : kind === "recipe" || kind === "block" || kind === "web"
      ? ([11, 16] as const)
      : kind === "mermaid"
        ? ([11, 16] as const)
        : ([11, 12] as const);
}

/** The one place a flat piece (designer or specialist output) becomes a validated widget. */
export function stageWidgetFromPiece(
  item: StagePieceContent,
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
    case "web":
      if (!item.url || !isEmbeddableStageUrl(item.url))
        throw new StageLayoutError("A public https page URL is required");

      return { ...base, kind: "web", url: item.url };
    case "block": {
      const parsed = parseDesignerBlock(item.block);

      if (!parsed.ok) throw new StageLayoutError(parsed.reason);

      return { ...base, kind: "block", block: parsed.block };
    }
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

/**
 * How many pieces the stage shows at once. More than this and each piece is too small to read;
 * the stage becomes a pile of everything ever asked rather than the topic at hand.
 */
export const STAGE_MAX_PIECES = 4;

/**
 * Makes room for `incoming` new pieces by removing the oldest pieces nothing is about to change,
 * so the stage holds at most STAGE_MAX_PIECES. Collections and Recall are the user's curated
 * thoughts and are never removed here. Removed pieces stay in the stage's Activity history.
 */
export function makeRoomForPieces(
  widgets: StageWidget[],
  incoming: number,
  touched: ReadonlySet<string> = new Set()
): StageWidget[] {
  const kept = [...widgets];

  for (let index = 0; kept.length + incoming > STAGE_MAX_PIECES && index < kept.length; ) {
    const widget = kept[index];

    if (touched.has(widget.id) || widget.kind === "collection" || widget.kind === "recall") index++;
    else kept.splice(index, 1);
  }

  return kept;
}

export function mergeStageDesignPlan(
  current: StageState,
  base: StageState,
  plan: DesignPlan,
  chatIds: Map<number, string>,
  widgetIds: Map<number, string> = new Map()
) {
  const touched = new Set(
    plan.operations.flatMap((operation) => (operation.targetId ? [operation.targetId] : []))
  );
  const created = plan.operations.filter(
    (operation) => operation.operation === "upsert" && !operation.targetId
  ).length;
  const removed = plan.operations.filter((operation) => operation.operation === "remove").length;
  // A new topic clears what the plan leaves alone; otherwise older untouched pieces give way
  // only as far as the cap needs, before new pieces look for space.
  const kept = plan.fresh
    ? current.widgets.filter(
        (widget) =>
          touched.has(widget.id) || widget.kind === "collection" || widget.kind === "recall"
      )
    : current.widgets;
  const widgets = makeRoomForPieces(kept, created - removed, touched);
  // Survivors keep cells sized for a crowded stage. Once pieces leave, or a new one finds no
  // room, the whole stage is re-tiled evenly instead of failing or squeezing in a sliver.
  let retile = widgets.length < current.widgets.length;

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
          ...stageWidgetFromPiece(operation, placed.rect),
          id: target.original.id,
          ...(placed.layouts ? { layouts: placed.layouts } : {}),
          ...(target.original.source ? { source: target.original.source } : {}),
        };
      }
      continue;
    }
    const [w, h] = dimensions(operation.kind);
    const reserved = stageReservedRects(current);
    const rect =
      operation.rect ??
      // A framed page reads best wide: it takes the roomier cell whenever the stage has one.
      (operation.kind === "web" ? findStagePlacement(widgets, 16, 18, reserved) : null) ??
      findStagePlacement(widgets, w, h, reserved);

    if (!rect) retile = true;
    widgets.push(
      stageWidgetFromPiece(
        operation,
        rect ?? { ...STAGE_CONTENT_RECT },
        chatIds.get(index),
        widgetIds.get(index)
      )
    );
  }
  if (retile)
    return initializeStageViewLayouts(
      widgets.map((widget, index) => ({ ...widget, rect: packedStageRect(index, widgets.length) })),
      stageReservedRects(current)
    );
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

/** Why one upsert's content can't become a piece, or null when it can. */
export function invalidUpsertReason(item: StagePieceContent): string | null {
  try {
    stageWidgetFromPiece(item, STAGE_CONTENT_RECT, "00000000-0000-4000-8000-000000000000");

    return null;
  } catch (error) {
    if (error instanceof StageLayoutError) return error.message;
    throw error;
  }
}

/**
 * Keeps the operations that can be applied and reports why the rest can't. One malformed block
 * or URL costs that piece, not the whole arrangement.
 */
export function sanitizeDesignPlan(plan: DesignPlan): { plan: DesignPlan; dropped: string[] } {
  const dropped: string[] = [];
  const operations = plan.operations.filter((operation) => {
    if (operation.operation !== "upsert" || operation.kind === "chat") return true;
    const reason = invalidUpsertReason(operation);

    if (reason) dropped.push(`${operation.title}: ${reason}`);

    return !reason;
  });

  return { plan: { ...plan, operations }, dropped };
}
