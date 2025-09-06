import { describe, test, expect } from "bun:test";
import type { Op } from "@/lib/llm/organicStateProtocol";
import { defaultOrganicState } from "@/lib/schemas/organicStateSchema";
import {
  applyOps,
  extractOpsEnvelopeFromText,
  prettyPrintOpsEnvelope,
  OpsEnvelopeSchema,
} from "@/lib/llm/organicStateProtocol";

describe("organicStateProtocol", () => {
  describe("extractOpsEnvelopeFromText", () => {
    test("should extract ops envelope from basic message", () => {
      const msg = `
Some narrative answer…
\`\`\`json
{
  "ops": [
    { "type": "add_key_insight", "text": "Haptics must be event-aligned <10ms to feel snapped.", "tags": ["Haptics","UX"], "importance": 5 },
    { "type": "add_tech_stack_item", "name": "App Intents", "category": "native", "notes": "Shortcuts + Siri entrypoints" },
    { "type": "update_checkpoint", "checkpointId": "system_surface", "status": "in_progress", "note": "Live Activity prototype started" }
  ]
}
\`\`\`
`;

      const env = extractOpsEnvelopeFromText(msg);

      expect(env).not.toBeNull();
      expect(env!.ops).toHaveLength(3);
      expect(env!.ops[0].type).toBe("add_key_insight");
      expect(env!.ops[1].type).toBe("add_tech_stack_item");
      expect(env!.ops[2].type).toBe("update_checkpoint");
    });

    test("should handle text with diagram category (real-world case)", () => {
      const problematicText = `Pick one or tell me what you want:
1) Generate a Mermaid diagram you can paste into a renderer.
2) Run a quick connectivity/check simulation (ping, DNS, HTTP steps).
3) Small utility (timer, quick calculation, random password).
4) Something else — describe it.

\`\`\`json
{
  "ops": [
    { "type": "add_key_insight", "text": "User repeatedly sending short 'test' messages to confirm responsiveness", "tags": ["test","responsiveness"], "importance": 1 },
    { "type": "add_tech_stack_item", "name": "Mermaid.js", "category": "diagram", "notes": "Common quick-response tool offered to user" }
  ]
}
\`\`\`...`;

      const env = extractOpsEnvelopeFromText(problematicText);

      expect(env).not.toBeNull();
      expect(env!.ops).toHaveLength(2);
      expect(env!.ops[0].type).toBe("add_key_insight");
      expect(env!.ops[1].type).toBe("add_tech_stack_item");
      const techStackOp = env!.ops[1] as Extract<
        Op,
        { type: "add_tech_stack_item" }
      >;
      expect(techStackOp.name).toBe("Mermaid.js");
      expect(techStackOp.category).toBe("diagram");
    });

    test("should return null for text without JSON blocks", () => {
      const textWithoutJson =
        "This is just plain text without any JSON blocks.";

      const env = extractOpsEnvelopeFromText(textWithoutJson);

      expect(env).toBeNull();
    });

    test("should return null for text with invalid JSON", () => {
      const textWithInvalidJson = `
Some text...
\`\`\`json
{
  "ops": [
    { "type": "add_key_insight", "text": "Missing closing quote }
  ]
}
\`\`\`
`;

      const env = extractOpsEnvelopeFromText(textWithInvalidJson);

      expect(env).toBeNull();
    });

    test("should return null for JSON that doesn't match schema", () => {
      const textWithInvalidSchema = `
\`\`\`json
{
  "ops": [
    { "type": "invalid_type", "text": "This type doesn't exist" }
  ]
}
\`\`\`
`;

      const env = extractOpsEnvelopeFromText(textWithInvalidSchema);

      expect(env).toBeNull();
    });

    test("should extract the last JSON block when multiple exist", () => {
      const textWithMultipleBlocks = `
First block:
\`\`\`json
{
  "ops": [
    { "type": "add_key_insight", "text": "First insight", "importance": 1 }
  ]
}
\`\`\`

Some text in between...

Second block:
\`\`\`json
{
  "ops": [
    { "type": "add_key_insight", "text": "Second insight", "importance": 2 }
  ]
}
\`\`\`
`;

      const env = extractOpsEnvelopeFromText(textWithMultipleBlocks);

      expect(env).not.toBeNull();
      expect(env!.ops).toHaveLength(1);
      const insightOp = env!.ops[0] as Extract<Op, { type: "add_key_insight" }>;
      expect(insightOp.text).toBe("Second insight");
      expect(insightOp.importance).toBe(2);
    });
  });

  describe("applyOps", () => {
    test("should apply ops to organic state", async () => {
      const initialState = defaultOrganicState();
      const env = {
        ops: [
          {
            type: "add_key_insight" as const,
            text: "Test insight",
            tags: ["test"],
            importance: 3,
          },
          {
            type: "add_tech_stack_item" as const,
            name: "React",
            category: "frontend" as const,
            notes: "UI framework",
          },
        ],
      };

      const newState = await applyOps(initialState, env);

      expect(newState.keyInsights).toHaveLength(1);
      expect(newState.keyInsights[0].text).toBe("Test insight");
      expect(newState.techStack).toHaveLength(1);
      expect(newState.techStack[0].name).toBe("React");
    });

    test("should not add duplicate tech stack items", async () => {
      const initialState = defaultOrganicState();
      const env = {
        ops: [
          {
            type: "add_tech_stack_item" as const,
            name: "React",
            category: "frontend" as const,
          },
          {
            type: "add_tech_stack_item" as const,
            name: "react", // lowercase version
            category: "frontend" as const,
          },
        ],
      };

      const newState = await applyOps(initialState, env);

      expect(newState.techStack).toHaveLength(1);
      expect(newState.techStack[0].name).toBe("React");
    });

    test("should update checkpoint status", async () => {
      const initialState = defaultOrganicState();
      const env = {
        ops: [
          {
            type: "update_checkpoint" as const,
            checkpointId: "system_surface" as const,
            status: "in_progress" as const,
            note: "Started working on this",
          },
        ],
      };

      const newState = await applyOps(initialState, env);

      const checkpoint = newState.checkpoints.find(
        (c) => c.id === "system_surface"
      );
      expect(checkpoint?.status).toBe("in_progress");
      expect(checkpoint?.evidence).toContain("Started working on this");
    });
  });

  describe("prettyPrintOpsEnvelope", () => {
    test("should format ops envelope nicely", () => {
      const env = {
        ops: [
          {
            type: "add_key_insight" as const,
            text: "Test insight",
            importance: 3,
          },
          {
            type: "add_tech_stack_item" as const,
            name: "React",
            category: "frontend" as const,
          },
          {
            type: "update_checkpoint" as const,
            checkpointId: "system_surface" as const,
            status: "in_progress" as const,
          },
        ],
      };

      const formatted = prettyPrintOpsEnvelope(env);

      expect(formatted).toContain("Insights: 1");
      expect(formatted).toContain("Tech: 1");
      expect(formatted).toContain("Checkpoints updated: 1");
      expect(formatted).toContain("Other ops: 0");
    });
  });

  describe("OpsEnvelopeSchema validation", () => {
    test("should validate correct ops envelope", () => {
      const validEnvelope = {
        ops: [
          {
            type: "add_key_insight",
            text: "Valid insight",
            importance: 3,
          },
        ],
      };

      expect(() => OpsEnvelopeSchema.parse(validEnvelope)).not.toThrow();
    });

    test("should reject envelope with too many ops", () => {
      const invalidEnvelope = {
        ops: Array(6).fill({
          type: "add_key_insight",
          text: "Too many ops",
          importance: 1,
        }),
      };

      expect(() => OpsEnvelopeSchema.parse(invalidEnvelope)).toThrow();
    });

    test("should validate all supported tech categories", () => {
      const categories = [
        "frontend",
        "backend",
        "devops",
        "ai",
        "native",
        "data",
        "design",
        "diagram",
      ];

      categories.forEach((category) => {
        const envelope = {
          ops: [
            {
              type: "add_tech_stack_item",
              name: "Test Tool",
              category,
            },
          ],
        };

        expect(() => OpsEnvelopeSchema.parse(envelope)).not.toThrow();
      });
    });
  });
});
