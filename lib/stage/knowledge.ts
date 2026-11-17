import { z } from "zod";

import { findStagePlacement, initializeStageViewLayouts, stageReservedRects } from "./layout";
import {
  STAGE_MAX_COLLECTION_ITEMS,
  STAGE_MAX_RECALL_ITEMS,
  STAGE_MAX_WIDGETS,
  type StageCollectionItem,
  type StageRect,
  type StageState,
  type StageWidget,
} from "./schema";

export const STAGE_MAX_CAPTURES = 12;
const MAX_NEW_COLLECTIONS_PER_TURN = 3;

// Flat, required-nullable fields keep the provider schema strict-output compatible.
export const StageCaptureSchema = z.object({
  collectionId: z.string().uuid().nullable(),
  collection: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(500),
});
export type StageCapture = z.infer<typeof StageCaptureSchema>;

export type StageRecallMemory = { text: string; at: string | null };

type Collection = Extract<StageWidget, { kind: "collection" }>;
type Recall = Extract<StageWidget, { kind: "recall" }>;

const normalize = (text: string) => text.trim().toLowerCase().replace(/\s+/g, " ");

// Compact list cards: six fit the 24×18 artifact area beside larger pieces. A shorter card
// beats dropping the thought; the user or designer can give a list more room later.
function place(widgets: StageWidget[], state: StageState): StageRect | null {
  const reserved = stageReservedRects(state);

  return findStagePlacement(widgets, 7, 8, reserved) ?? findStagePlacement(widgets, 7, 6, reserved);
}

/** Keep the newest open thoughts; checked-off items leave first when a list is full. */
export function boundCollectionItems(items: StageCollectionItem[]): StageCollectionItem[] {
  const next = [...items];

  while (next.length > STAGE_MAX_COLLECTION_ITEMS) {
    const done = next.findIndex((item) => item.done);

    next.splice(done >= 0 ? done : 0, 1);
  }

  return next;
}

/**
 * File captured thoughts into collections, by id first, then by title, else a new placed collection.
 * Captures that find no room are returned so the reply can say so instead of silently losing them.
 */
export function fileStageCaptures(
  state: StageState,
  captures: StageCapture[],
  now = new Date().toISOString()
): { state: StageState; filed: StageCapture[]; unfiled: StageCapture[] } {
  const widgets = [...state.widgets];
  const filed: StageCapture[] = [];
  const unfiled: StageCapture[] = [];
  let created = 0;

  for (const capture of captures.slice(0, STAGE_MAX_CAPTURES)) {
    let index = widgets.findIndex(
      (widget) => widget.kind === "collection" && widget.id === capture.collectionId
    );

    if (index < 0)
      index = widgets.findIndex(
        (widget) =>
          widget.kind === "collection" && normalize(widget.title) === normalize(capture.collection)
      );
    if (index < 0) {
      const rect =
        widgets.length < STAGE_MAX_WIDGETS && created < MAX_NEW_COLLECTIONS_PER_TURN
          ? place(widgets, state)
          : null;

      if (!rect) {
        unfiled.push(capture);
        continue;
      }
      created++;
      widgets.push({
        id: crypto.randomUUID(),
        kind: "collection",
        title: capture.collection.trim(),
        rect,
        items: [],
      });
      index = widgets.length - 1;
    }
    const collection = widgets[index] as Collection;

    if (collection.items.some((item) => normalize(item.text) === normalize(capture.text))) continue;
    widgets[index] = {
      ...collection,
      items: boundCollectionItems([
        ...collection.items,
        { id: crypto.randomUUID(), text: capture.text.trim(), at: now },
      ]),
    };
    filed.push(capture);
  }

  if (!filed.length) return { state, filed, unfiled };
  const next = { ...state, widgets };

  return {
    state: { ...next, widgets: initializeStageViewLayouts(widgets, stageReservedRects(next)) },
    filed,
    unfiled,
  };
}

/** One Recall piece, refreshed in place, so remembering never piles up cards. */
export function placeStageRecall(
  state: StageState,
  query: string,
  memories: StageRecallMemory[],
  now = new Date().toISOString()
): StageState {
  const items = memories
    .map((memory) => ({
      text: memory.text.trim().slice(0, 600),
      at: memory.at?.slice(0, 40) ?? null,
    }))
    .filter((memory) => memory.text)
    .slice(0, STAGE_MAX_RECALL_ITEMS);
  const content = { query: query.trim().slice(0, 300), at: now, items };
  const index = state.widgets.findIndex((widget) => widget.kind === "recall");

  if (index >= 0) {
    const widgets = [...state.widgets];

    widgets[index] = { ...(widgets[index] as Recall), ...content };

    return { ...state, widgets };
  }
  if (state.widgets.length >= STAGE_MAX_WIDGETS) return state;
  const rect = place(state.widgets, state);

  if (!rect) return state;
  const widgets: StageWidget[] = [
    ...state.widgets,
    { id: crypto.randomUUID(), kind: "recall", title: "Recall", rect, ...content },
  ];
  const next = { ...state, widgets };

  return { ...next, widgets: initializeStageViewLayouts(widgets, stageReservedRects(next)) };
}

/** Bounded view of what Stage already holds, so the agent files by id instead of duplicating. */
export function stageKnowledgeContext(state: StageState) {
  return {
    collections: state.widgets.flatMap((widget) =>
      widget.kind === "collection"
        ? [
            {
              id: widget.id,
              title: widget.title,
              count: widget.items.length,
              recent: widget.items.slice(-6).map((item) => ({
                text: item.text.slice(0, 160),
                ...(item.done ? { done: true } : {}),
              })),
            },
          ]
        : []
    ),
    recall:
      state.widgets.flatMap((widget) =>
        widget.kind === "recall" ? [{ id: widget.id, query: widget.query }] : []
      )[0] ?? null,
  };
}

/** Plain text for Mem0, so filed thoughts outlive the stage itself. */
export function stageCaptureMemoryText(captures: StageCapture[]): string {
  return captures
    .map((capture) => `${capture.collection.trim()}: ${capture.text.trim()}`)
    .join("\n");
}
