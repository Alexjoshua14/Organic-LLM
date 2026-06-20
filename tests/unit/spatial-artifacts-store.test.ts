import { beforeEach, describe, expect, test } from "bun:test";

import { ensureDom } from "../helpers/render";

import {
  ArtifactSpatialStore,
  createArtifactSpatialStore,
} from "@/lib/spatial-artifacts/artifact-spatial-store";
import { rectFromVector4 } from "@/lib/spatial-artifacts/spatial-types";

ensureDom();

const SAMPLE_RECT = rectFromVector4({ x: 10, y: 20, w: 100, h: 50 });

describe("rectFromVector4 / vector4FromRect", () => {
  test("computes center and corners", async () => {
    const { vector4FromRect } = await import("@/lib/spatial-artifacts/spatial-types");
    const rect = rectFromVector4({ x: 0, y: 0, w: 200, h: 100 });

    expect(rect.center).toEqual({ x: 100, y: 50 });
    expect(rect.corners[0]).toEqual({ x: 0, y: 0 });
    expect(rect.corners[2]).toEqual({ x: 200, y: 100 });
    expect(vector4FromRect(rect)).toEqual({ x: 0, y: 0, w: 200, h: 100 });
  });
});

describe("ArtifactSpatialStore", () => {
  let store: ArtifactSpatialStore;

  beforeEach(() => {
    store = createArtifactSpatialStore();
  });

  test("creates default entry on first access", () => {
    const entry = store.getEntry("artifact-1");

    expect(entry.visible).toBe(false);
    expect(entry.lastRect).toBeNull();
    expect(entry.targetRect).toBeNull();
  });

  test("requestMorph sets target from measured slot", () => {
    store.measureSlot("plan-condensed:a", SAMPLE_RECT);
    store.requestMorph("artifact-1", "plan-condensed:a");

    const entry = store.getEntry("artifact-1");

    expect(entry.visible).toBe(true);
    expect(entry.activeSlotKey).toBe("plan-condensed:a");
    expect(entry.targetRect).toEqual(SAMPLE_RECT);
  });

  test("settle updates lastRect", () => {
    store.settle("artifact-1", SAMPLE_RECT);

    expect(store.getLastRect("artifact-1")).toEqual(SAMPLE_RECT);
  });

  test("hideArtifact clears visibility and active slot", () => {
    store.measureSlot("plan-condensed:a", SAMPLE_RECT);
    store.requestMorph("artifact-1", "plan-condensed:a");
    store.hideArtifact("artifact-1");

    const entry = store.getEntry("artifact-1");

    expect(entry.visible).toBe(false);
    expect(entry.activeSlotKey).toBeNull();
  });

  test("subscribe notifies on artifact changes", () => {
    let calls = 0;
    const unsub = store.subscribe("artifact-1", () => {
      calls += 1;
    });

    store.settle("artifact-1", SAMPLE_RECT);
    expect(calls).toBe(1);

    unsub();
    store.settle("artifact-1", SAMPLE_RECT);
    expect(calls).toBe(1);
  });

  test("commitSlotTargets measures registered slots against stage", () => {
    const stage = document.createElement("div");
    const el = document.createElement("div");

    stage.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 800, height: 600 }) as DOMRect;
    el.getBoundingClientRect = () =>
      ({ left: 50, top: 100, width: 120, height: 40 }) as DOMRect;

    store.setStage(stage);
    store.registerSlot("bookshelf-spine:x", "artifact-x", "bookshelf-spine", el);
    store.commitSlotTargets(ArtifactSpatialStore.measureElement);

    expect(store.getSlotRect("bookshelf-spine:x")).toEqual(
      rectFromVector4({ x: 50, y: 100, w: 120, h: 40 })
    );
  });

  test("unregisterSlot removes slot rect", () => {
    store.measureSlot("audio-tile:a", SAMPLE_RECT);
    store.unregisterSlot("audio-tile:a");

    expect(store.getSlotRect("audio-tile:a")).toBeNull();
  });

  test("setFocusArtifact notifies global subscribers", () => {
    let focus: string | null = null;

    store.subscribeAll(() => {
      focus = store.getFocusArtifact();
    });

    store.setFocusArtifact("artifact-9");
    expect(focus).toBe("artifact-9");
  });
});
