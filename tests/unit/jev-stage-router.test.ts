import { describe, expect, test } from "bun:test";

import { JEV_STAGE_CONFIDENCE_FLOOR } from "@/lib/jev-stage/constants";
import { pickJevStageAction, routeJevStage } from "@/lib/jev-stage/router";
import type { JevGenerate } from "@/lib/llm/jev";

describe("jev-stage router", () => {
  test("picks the highest confidence above the floor", () => {
    const picked = pickJevStageAction({
      candidates: [
        { kind: "respond", confidence: 0.4, reason: "chat", args: {} },
        { kind: "view_switch", confidence: 0.82, reason: "show overview", args: {} },
        { kind: "web_search", confidence: 0.6, reason: "lookup", args: {} },
      ],
    });

    expect(picked.fellBack).toBe(false);
    expect(picked.selected.kind).toBe("view_switch");
    expect(picked.ranked[0]?.kind).toBe("view_switch");
  });

  test("falls back to respond below the confidence floor", () => {
    const picked = pickJevStageAction({
      candidates: [
        { kind: "orchestrate", confidence: JEV_STAGE_CONFIDENCE_FLOOR - 0.01, reason: "maybe", args: {} },
      ],
    });

    expect(picked.fellBack).toBe(true);
    expect(picked.selected.kind).toBe("respond");
  });

  test("routeJevStage uses injected generate and falls back on failure", async () => {
    const generate: JevGenerate = async () => {
      throw new Error("timeout");
    };
    const routed = await routeJevStage({
      message: "hello",
      summary: "",
      knowledgeHint: "",
      generate,
    });

    expect(routed.source).toBe("fallback");
    expect(routed.selected.kind).toBe("respond");
    expect(routed.fellBack).toBe(true);
  });

  test("routeJevStage accepts a structured Jev object", async () => {
    const generate: JevGenerate = async () => ({
      object: {
        candidates: [
          { kind: "captures", confidence: 0.91, reason: "brain dump", args: { captures: [] } },
          { kind: "respond", confidence: 0.2, reason: "maybe chat", args: {} },
        ],
      },
    });
    const routed = await routeJevStage({
      message: "dump these ideas",
      summary: "",
      knowledgeHint: "",
      generate,
    });

    expect(routed.source).toBe("jev");
    expect(routed.selected.kind).toBe("captures");
  });
});
