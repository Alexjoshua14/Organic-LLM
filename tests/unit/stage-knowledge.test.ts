import { describe, expect, test } from "bun:test";
import { z } from "zod";

import {
  boundCollectionItems,
  fileStageCaptures,
  placeStageRecall,
  StageCaptureSchema,
  stageKnowledgeContext,
} from "@/lib/stage/knowledge";
import { applyStageOperations, validateStageLayouts } from "@/lib/stage/layout";
import {
  emptyStageState,
  STAGE_MAX_COLLECTION_ITEMS,
  StageStateSchema,
  type StageState,
  type StageWidget,
} from "@/lib/stage/schema";

const capture = (text: string, collection = "Ideas", collectionId: string | null = null) => ({
  collectionId,
  collection,
  text,
});
const AT = "2026-11-13T08:00:00.000Z";

describe("stage collections", () => {
  test("creates a placed collection, then files by id and by title without duplicates", () => {
    const first = fileStageCaptures(
      emptyStageState(),
      [capture("Stage is the thinking surface")],
      AT
    );
    const collection = first.state.widgets[0] as Extract<StageWidget, { kind: "collection" }>;

    expect(collection).toMatchObject({ kind: "collection", title: "Ideas" });
    expect(collection.items).toHaveLength(1);
    expect(() => validateStageLayouts(first.state.widgets)).not.toThrow();
    expect(() => StageStateSchema.parse(first.state)).not.toThrow();

    const second = fileStageCaptures(
      first.state,
      [
        capture("Recall without rereading threads", "Wrong title", collection.id),
        capture("recall   WITHOUT rereading threads", "ideas"),
        capture("Organize while I talk", " IDEAS "),
      ],
      AT
    );
    const updated = second.state.widgets as Extract<StageWidget, { kind: "collection" }>[];

    expect(updated).toHaveLength(1);
    expect(updated[0].items.map((item) => item.text)).toEqual([
      "Stage is the thinking surface",
      "Recall without rereading threads",
      "Organize while I talk",
    ]);
    expect(second.filed).toHaveLength(2);
  });

  test("returns captures it cannot place instead of dropping them", () => {
    const full: StageState = {
      ...emptyStageState(),
      widgets: [
        {
          id: crypto.randomUUID(),
          kind: "note",
          title: "Big",
          text: "Fills the canvas",
          rect: { x: 8, y: 4, w: 24, h: 18 },
        },
      ],
    };
    const result = fileStageCaptures(full, [capture("Nowhere to go")]);

    expect(result.state).toBe(full);
    expect(result.unfiled).toEqual([capture("Nowhere to go")]);
  });

  test("caps new collections per turn", () => {
    const result = fileStageCaptures(
      emptyStageState(),
      ["A", "B", "C", "D"].map((name) => capture(`Thought ${name}`, name))
    );

    expect(result.state.widgets.filter((w) => w.kind === "collection")).toHaveLength(3);
    expect(result.unfiled).toHaveLength(1);
  });

  test("a full list lets checked-off items go first", () => {
    const items = Array.from({ length: STAGE_MAX_COLLECTION_ITEMS + 1 }, (_, index) => ({
      id: crypto.randomUUID(),
      text: `Item ${index}`,
      at: AT,
      ...(index === 5 ? { done: true } : {}),
    }));
    const bounded = boundCollectionItems(items);

    expect(bounded).toHaveLength(STAGE_MAX_COLLECTION_ITEMS);
    expect(bounded.some((item) => item.text === "Item 5")).toBe(false);
    expect(bounded[0].text).toBe("Item 0");
  });

  test("the user can curate items through an ordinary upsert, but not change its kind", () => {
    const { state } = fileStageCaptures(emptyStageState(), [capture("One"), capture("Two")]);
    const collection = state.widgets[0] as Extract<StageWidget, { kind: "collection" }>;
    const curated = applyStageOperations(state.widgets, [
      {
        type: "upsert",
        widget: { ...collection, items: [{ ...collection.items[1], done: true }] },
      },
    ]);

    expect(curated[0]).toMatchObject({ items: [{ text: "Two", done: true }] });
    expect(() =>
      applyStageOperations(state.widgets, [
        { type: "upsert", widget: { ...collection, kind: "note", text: "" } as StageWidget },
      ])
    ).toThrow();
  });
});

describe("stage recall", () => {
  test("keeps one Recall piece and refreshes it in place", () => {
    const first = placeStageRecall(emptyStageState(), "second brain", [
      { text: "Wants Stage as the primary surface", at: AT },
    ]);
    const second = placeStageRecall(first, "privacy", [{ text: "Keys stay with me", at: null }]);
    const recalls = second.widgets.filter((widget) => widget.kind === "recall");

    expect(recalls).toHaveLength(1);
    expect(recalls[0]).toMatchObject({
      id: first.widgets[0].id,
      query: "privacy",
      items: [{ text: "Keys stay with me", at: null }],
    });
    expect(() => StageStateSchema.parse(second)).not.toThrow();
  });

  test("the agent sees bounded collection context to file by id", () => {
    const { state } = fileStageCaptures(emptyStageState(), [capture("x".repeat(400))]);
    const context = stageKnowledgeContext(placeStageRecall(state, "q", []));

    expect(context.collections[0].recent[0].text).toHaveLength(160);
    expect(context.recall?.query).toBe("q");
  });

  test("captures keep a strict-output compatible provider schema", () => {
    expect(JSON.stringify(z.toJSONSchema(StageCaptureSchema))).not.toContain('"oneOf"');
  });
});
