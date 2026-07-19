import { describe, expect, test } from "bun:test";

import { compileChatTools } from "@/lib/llm/compile-chat-tools";
import { STRATUM_FORM_TOOL_NAME, STRATUM_SPEC_TOOL_NAME } from "@/lib/llm/stratum-tool";
import { appendMainChatPostToolSystemFragments } from "@/lib/api/chat-system-prompt";

const SB_USER_ID = "00000000-0000-4000-8000-000000000042";

describe("stratum chat style tooling", () => {
  test("arcadia + stratum style registers discovery tools with instructions", async () => {
    const { tools, toolInstructions } = await compileChatTools({
      useSearch: false,
      useMemory: false,
      experience: "arcadia",
      chatStyle: "stratum",
      sbUserId: SB_USER_ID,
    });

    expect(tools[STRATUM_FORM_TOOL_NAME]).toBeDefined();
    expect(tools[STRATUM_SPEC_TOOL_NAME]).toBeDefined();
    expect(toolInstructions).toContain("discovery_form");
    expect(toolInstructions).toContain("product_spec");
  });

  test("other styles do not get stratum tools", async () => {
    const { tools } = await compileChatTools({
      useSearch: false,
      useMemory: false,
      experience: "arcadia",
      chatStyle: "default",
      sbUserId: SB_USER_ID,
    });

    expect(tools[STRATUM_FORM_TOOL_NAME]).toBeUndefined();
    expect(tools[STRATUM_SPEC_TOOL_NAME]).toBeUndefined();
  });

  test("non-arcadia experiences do not get stratum tools", async () => {
    const { tools } = await compileChatTools({
      useSearch: false,
      useMemory: false,
      experience: "strata_hub",
      chatStyle: "stratum",
      sbUserId: SB_USER_ID,
    });

    expect(tools[STRATUM_FORM_TOOL_NAME]).toBeUndefined();
  });

  test("stratum style appends the discovery system prompt", () => {
    const out = appendMainChatPostToolSystemFragments({
      systemPromptForRequest: "base",
      hasTools: true,
      toolInstructions: "tools",
      speechFriendly: undefined,
      experience: "arcadia",
      chatStyle: "stratum",
    });

    expect(out).toContain("[Stratum mode — product discovery]");
    expect(out).toContain("discovery_form");
  });

  test("default style does not append the stratum prompt", () => {
    const out = appendMainChatPostToolSystemFragments({
      systemPromptForRequest: "base",
      hasTools: false,
      toolInstructions: "",
      speechFriendly: undefined,
      experience: "arcadia",
      chatStyle: "default",
    });

    expect(out).not.toContain("[Stratum mode — product discovery]");
  });
});
