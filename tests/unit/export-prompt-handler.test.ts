import { describe, expect, mock, test } from "bun:test";

import {
  handleExportPromptPost,
  type HandleExportPromptPostDeps,
} from "@/lib/export/handle-export-prompt-post";

function deps(overrides: Partial<HandleExportPromptPostDeps>): HandleExportPromptPostDeps {
  return {
    checkLlmMessageLimit: async () => ({ success: true }),
    generateTextImpl: mock(async () => ({ text: "  rewritten  ", usage: {} as never })),
    ...overrides,
  };
}

describe("handleExportPromptPost", () => {
  test("returns 200 with deterministic prompt when rate limited", async () => {
    const result = await handleExportPromptPost(
      { presetId: "career-profile-chatgpt", sourceText: "x".repeat(50) },
      "supabase-user-1",
      deps({
        checkLlmMessageLimit: async () => ({ success: false, error: "Too many LLM requests" }),
        generateTextImpl: mock(async () => {
          throw new Error("should not run");
        }),
      }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.status).toBe(200);
    expect(result.body.degraded).toBe(true);
    expect(result.body.reason).toBe("rate_limited");
    expect(result.body.prompt.length).toBeGreaterThan(20);
    expect(result.body.prompt).toContain("career");
  });

  test("returns 400 when preset validation fails", async () => {
    const result = await handleExportPromptPost(
      { presetId: "script-voiceover-chatgpt", sourceText: "too short" },
      "supabase-user-1",
      deps({}),
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.status).toBe(400);
    expect(result.body.code).toBe("validation_failed");
  });

  test("returns 200 with trimmed LLM output when limit passes", async () => {
    const gen = mock(async () => ({ text: "  ai prompt  ", usage: {} as never }));
    const result = await handleExportPromptPost(
      { presetId: "career-profile-chatgpt", sourceText: "y".repeat(60), provider: "claude" },
      "supabase-user-2",
      deps({ generateTextImpl: gen }),
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.prompt).toBe("ai prompt");
    expect(gen).toHaveBeenCalled();
  });
});
