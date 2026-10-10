/**
 * Pure helpers only: `chat-system-prompt` and `compile-chat-tools` pull `server-only`
 * transitively, so they are not imported from Bun unit tests here.
 */
import { describe, expect, test } from "bun:test";

import {
  MAIN_CHAT_CONTEXT_FAILURE_NOTE,
  mainChatSystemPromptWhenContextFailed,
} from "@/lib/api/chat-context-fallbacks";
import { computeMainChatMaxSteps, MAX_TOOL_STEPS } from "@/lib/api/chat-max-steps";

describe("computeMainChatMaxSteps", () => {
  test("no tools caps at 8", () => {
    expect(computeMainChatMaxSteps({ experience: undefined, hasTools: false })).toBe(8);
  });

  test("tools use MAX_TOOL_STEPS", () => {
    expect(MAX_TOOL_STEPS).toBe(16);
    expect(computeMainChatMaxSteps({ experience: undefined, hasTools: true })).toBe(MAX_TOOL_STEPS);
  });

  test("strata_hub caps at 8 when tools", () => {
    expect(computeMainChatMaxSteps({ experience: "strata_hub", hasTools: true })).toBe(8);
  });

  test("strata_hub also caps at 8 without tools", () => {
    expect(computeMainChatMaxSteps({ experience: "strata_hub", hasTools: false })).toBe(8);
  });
});

describe("chat-context-fallbacks", () => {
  test("failure note is stable substring", () => {
    expect(MAIN_CHAT_CONTEXT_FAILURE_NOTE).toContain("get_more_chat_history");
  });

  test("mainChatSystemPromptWhenContextFailed includes base and note", () => {
    const s = mainChatSystemPromptWhenContextFailed();
    expect(s.length).toBeGreaterThan(MAIN_CHAT_CONTEXT_FAILURE_NOTE.length);
    expect(s).toContain(MAIN_CHAT_CONTEXT_FAILURE_NOTE);
  });
});
