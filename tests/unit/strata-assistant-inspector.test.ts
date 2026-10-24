import { describe, expect, test } from "bun:test";

import {
  STRATA_ASSISTANT_PERSONA_IDS,
  buildStrataAssistantPersonaInspectorSnapshot,
} from "@/lib/personas/strata-assistant";

describe("buildStrataAssistantPersonaInspectorSnapshot", () => {
  test("remy includes augmentation, model, tools, routing", () => {
    const s = buildStrataAssistantPersonaInspectorSnapshot("remy");
    expect(s.id).toBe("remy");
    expect(s.label.length).toBeGreaterThan(0);
    expect(s.shortLabel).toBe("Remy");
    expect(s.systemPromptAugmentation).toContain("Persona: Remy");
    expect(s.defaultModel.id.length).toBeGreaterThan(0);
    expect(s.defaultModel.name.length).toBeGreaterThan(0);
    expect(typeof s.defaultToolDefaults.toolMemory).toBe("boolean");
    expect(typeof s.defaultToolDefaults.toolWebSearch).toBe("boolean");
    expect(typeof s.defaultToolDefaults.toolMessageSearch).toBe("boolean");
    expect(typeof s.defaultToolDefaults.toolKnowledgeSearch).toBe("boolean");
    expect(s.routingNote).toContain("POST /api/chat");
    expect(s.routingNote).toContain("strataAssistantPersona");
  });

  test("all builtin ids produce valid snapshots", () => {
    for (const id of STRATA_ASSISTANT_PERSONA_IDS) {
      const s = buildStrataAssistantPersonaInspectorSnapshot(id);
      expect(s.id).toBe(id);
      expect(s.systemPromptAugmentation.length).toBeGreaterThan(10);
    }
  });
});
