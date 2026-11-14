import { describe, expect, test } from "bun:test";

import type { DesignPlan } from "@/lib/stage/agent";
import { StageLayoutError } from "@/lib/stage/layout";
import { mergeStageDesignPlan } from "@/lib/stage/reconcile";
import { emptyStageState } from "@/lib/stage/schema";
import { isEmbeddableStageUrl } from "@/lib/stage/web-url";

const upsert = (patch: Record<string, unknown>) =>
  ({
    operation: "upsert",
    kind: "web",
    title: "Piece",
    targetId: null,
    rect: null,
    text: null,
    code: null,
    ingredients: null,
    steps: null,
    ...patch,
  }) as DesignPlan["operations"][number];
const merge = (op: DesignPlan["operations"][number]) =>
  mergeStageDesignPlan(emptyStageState(), emptyStageState(), { operations: [op] }, new Map());

describe("stage web and block pieces", () => {
  test("only public https pages are embeddable", () => {
    expect(isEmbeddableStageUrl("https://example.com/a")).toBe(true);
    for (const bad of [
      "http://example.com",
      "https://localhost/x",
      "https://192.168.0.1/",
      "https://user:pw@example.com",
      "javascript:alert(1)",
      "nope",
    ])
      expect(isEmbeddableStageUrl(bad)).toBe(false);
  });

  test("a web piece is placed; a bad URL is a layout error the designer can retry", () => {
    expect(merge(upsert({ url: "https://example.com" }))[0]).toMatchObject({
      kind: "web",
      url: "https://example.com",
    });
    expect(() => merge(upsert({ url: "http://example.com" }))).toThrow(StageLayoutError);
  });

  test("a block piece validates its gen-ui JSON", () => {
    const block = JSON.stringify({
      type: "answer-card",
      version: 1,
      title: "Short answer",
      tldr: "Yes.",
      keyPoints: ["One point"],
    });
    const kind = "block";

    expect(() => merge(upsert({ kind, block: "{not json" }))).toThrow(StageLayoutError);
    expect(() => merge(upsert({ kind, block }))).not.toThrow();
  });
});
