import { describe, expect, test } from "bun:test";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import {
  GEN_UI_BLOCK_TYPES,
  GenUIBlockSchema,
  genUIBlockToMarkdown,
  StateDiagramBlockSchema,
  ProgressTrackBlockSchema,
  safeParseGenUIBlock,
} from "@/lib/schemas/gen-ui";
import {
  FIXTURE_STATE_DIAGRAM,
  FIXTURE_PROMPT_FIELD,
  FIXTURE_PROGRESS_TRACK,
  FIXTURE_CONTEXT_SWITCHBOARD,
  FIXTURE_RIPPLE_PREVIEW,
} from "@/lib/schemas/gen-ui/fixtures";
import { GEN_UI_TOOL_INSTRUCTIONS } from "@/lib/system-prompt/gen-ui";
import { designerBlockShapes } from "@/lib/stage/block-shapes";

const FIXTURES = [
  FIXTURE_STATE_DIAGRAM,
  FIXTURE_PROMPT_FIELD,
  FIXTURE_PROGRESS_TRACK,
  FIXTURE_CONTEXT_SWITCHBOARD,
  FIXTURE_RIPPLE_PREVIEW,
] as const;

describe("state-diagram through ripple-preview", () => {
  test("are registered", () => {
    for (const type of [
      "state-diagram",
      "prompt-field",
      "progress-track",
      "context-switchboard",
      "ripple-preview",
    ] as const) {
      expect(GEN_UI_BLOCK_TYPES).toContain(type);
      expect(GEN_UI_REGISTRY[type]).toBeDefined();
    }
    expect(GEN_UI_REGISTRY["state-diagram"].label).toBe("State diagram");
    expect(GEN_UI_REGISTRY["prompt-field"].label).toBe("Prompt field");
    expect(GEN_UI_REGISTRY["progress-track"].label).toBe("Progress");
    expect(GEN_UI_REGISTRY["context-switchboard"].label).toBe("Context");
    expect(GEN_UI_REGISTRY["ripple-preview"].label).toBe("Ripple");
  });

  test("fixtures pass strict parse and safeParse", () => {
    for (const fixture of FIXTURES) {
      expect(GenUIBlockSchema.safeParse(fixture).success).toBe(true);
      expect(safeParseGenUIBlock(fixture).ok).toBe(true);
    }
  });

  test("state-diagram rejects unknown transition endpoints", () => {
    expect(
      StateDiagramBlockSchema.safeParse({
        ...FIXTURE_STATE_DIAGRAM,
        transitions: [{ from: "draft", to: "missing" }],
      }).success
    ).toBe(false);
  });

  test("progress-track rejects current above total", () => {
    expect(
      ProgressTrackBlockSchema.safeParse({
        type: "progress-track",
        version: 1,
        title: "Over",
        total: 10,
        current: 11,
      }).success
    ).toBe(false);
  });

  test("toMarkdown includes distinctive content", () => {
    expect(genUIBlockToMarkdown(FIXTURE_STATE_DIAGRAM)).toContain("Release gate");
    expect(genUIBlockToMarkdown(FIXTURE_PROMPT_FIELD)).toContain("Shorter");
    expect(genUIBlockToMarkdown(FIXTURE_PROGRESS_TRACK)).toContain("62");
    expect(genUIBlockToMarkdown(FIXTURE_CONTEXT_SWITCHBOARD)).toContain("Budget cap");
    expect(genUIBlockToMarkdown(FIXTURE_RIPPLE_PREVIEW)).toContain("Beta cut");
  });

  test("tool instructions and designer shapes mention the new types", () => {
    const shapes = designerBlockShapes();

    for (const type of [
      "state-diagram",
      "prompt-field",
      "progress-track",
      "context-switchboard",
      "ripple-preview",
    ]) {
      expect(GEN_UI_TOOL_INSTRUCTIONS).toContain(type);
      expect(shapes).toContain(type);
    }
  });
});
