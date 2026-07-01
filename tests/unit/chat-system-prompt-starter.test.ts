import { describe, expect, test, mock } from "bun:test";

mock.module("server-only", () => ({}));
mock.module("@/data/supabase/strata", () => ({
  getStrataPageById: async () => ({ data: null, error: null }),
}));

const { appendMainChatPostToolSystemFragments } = await import("@/lib/api/chat-system-prompt");

describe("appendMainChatPostToolSystemFragments Arcadia starter", () => {
  test("appends starter priming for Arcadia experience", () => {
    const out = appendMainChatPostToolSystemFragments({
      systemPromptForRequest: "Base prompt",
      hasTools: false,
      toolInstructions: "",
      speechFriendly: false,
      experience: "arcadia",
      chatStyle: "scribe",
      arcadiaStarterPriming: "Stitch my pieces together.",
    });

    expect(out).toContain("[Arcadia starter prompt]");
    expect(out).toContain("Stitch my pieces together.");
    expect(out).toContain("[Arcadia mode — keep replies short]");
  });

  test("does not append starter priming outside Arcadia experience", () => {
    const out = appendMainChatPostToolSystemFragments({
      systemPromptForRequest: "Base prompt",
      hasTools: false,
      toolInstructions: "",
      speechFriendly: false,
      experience: "strata_hub",
      arcadiaStarterPriming: "Should not appear.",
    });

    expect(out).not.toContain("[Arcadia starter prompt]");
    expect(out).not.toContain("Should not appear.");
  });

  test("ignores blank starter priming", () => {
    const out = appendMainChatPostToolSystemFragments({
      systemPromptForRequest: "Base prompt",
      hasTools: false,
      toolInstructions: "",
      speechFriendly: false,
      experience: "arcadia",
      arcadiaStarterPriming: "   ",
    });

    expect(out).not.toContain("[Arcadia starter prompt]");
  });
});
