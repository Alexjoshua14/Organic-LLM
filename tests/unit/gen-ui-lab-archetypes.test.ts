import { describe, expect, test } from "bun:test";

import { GEN_UI_REGISTRY } from "@/components/chat/gen-ui/registry";
import { GEN_UI_BLOCK_TYPES } from "@/lib/schemas/gen-ui/shared";
import {
  buildDefaultBlockMap,
  GEN_UI_LAB_AION_SYSTEM,
  GEN_UI_LAB_ARCHETYPE_HINTS,
} from "@/lib/sandbox/gen-ui-lab";

describe("Gen UI Lab archetypes", () => {
  test("default block map covers every registered type", () => {
    const map = buildDefaultBlockMap();

    for (const type of GEN_UI_BLOCK_TYPES) {
      expect(map[type]?.type).toBe(type);
      expect(GEN_UI_REGISTRY[type]).toBeDefined();
    }
  });

  test("Aion system prompt lists every archetype hint", () => {
    for (const type of GEN_UI_BLOCK_TYPES) {
      expect(GEN_UI_LAB_ARCHETYPE_HINTS[type].length).toBeGreaterThan(0);
      expect(GEN_UI_LAB_AION_SYSTEM).toContain(`- ${type} —`);
      expect(GEN_UI_LAB_AION_SYSTEM).toContain(GEN_UI_LAB_ARCHETYPE_HINTS[type]);
    }
  });

  test("includes the newest lab archetypes", () => {
    for (const type of [
      "state-diagram",
      "prompt-field",
      "progress-track",
      "context-switchboard",
      "ripple-preview",
      "hyp-graph",
      "audit-line",
      "preview-blob",
    ] as const) {
      expect(GEN_UI_BLOCK_TYPES).toContain(type);
      expect(buildDefaultBlockMap()[type].type).toBe(type);
      expect(GEN_UI_LAB_AION_SYSTEM).toContain(type);
    }
  });
});
