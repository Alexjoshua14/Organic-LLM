import { describe, expect, test } from "bun:test";

import type { JevGenerate } from "@/lib/llm/jev";
import { decidePersonaResponse } from "@/lib/personas/unified/response-gate";

// No rule settles this one, so it reaches Jev.
const input = { text: "the lower edge looks muddy" };

describe("persona response gate via Jev decisions", () => {
  test("asks a boolean for reply and a choice for kind", async () => {
    let questions: Parameters<JevGenerate>[0]["questions"] = {};
    const decision = await decidePersonaResponse(input, {
      generate: async (args) => {
        questions = args.questions;

        return {
          answers: {
            respond: { type: "boolean", probability: 0.7 },
            kind: { type: "choice", choice: "request", probabilities: { request: 0.6 } },
          },
        };
      },
    });

    expect(questions.respond).toMatchObject({ type: "boolean" });
    expect(questions.kind).toMatchObject({ type: "choice" });
    expect(decision).toEqual({
      respond: true,
      kind: "request",
      reason: "Jev P(reply) 0.70",
      source: "jev",
    });
  });

  test("a low reply probability stays quiet; an unknown kind uses the default", async () => {
    const decision = await decidePersonaResponse(input, {
      generate: async () => ({
        answers: {
          respond: { type: "boolean", probability: 0.2 },
          kind: { type: "choice", choice: "mumble" },
        },
      }),
    });

    expect(decision.respond).toBe(false);
    expect(decision.kind).toBe("self_talk");
    expect(decision.source).toBe("jev");
  });

  test("a missing probability or a failed call leans toward answering", async () => {
    const missing = await decidePersonaResponse(input, {
      generate: async () => ({ answers: {} }),
    });
    const failed = await decidePersonaResponse(input, {
      generate: async () => {
        throw new Error("down");
      },
    });

    for (const decision of [missing, failed]) {
      expect(decision.respond).toBe(true);
      expect(decision.source).toBe("fallback");
    }
  });
});
