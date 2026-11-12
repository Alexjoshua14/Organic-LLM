import { describe, expect, test } from "bun:test";

import {
  GATEWAY_PROMPT_CACHING,
  promptCacheSessionHeaders,
  promptCacheSessionId,
} from "@/lib/llm/prompt-cache";

describe("prompt cache options", () => {
  test("asks the Gateway to add cache markers automatically", () => {
    expect(GATEWAY_PROMPT_CACHING).toEqual({ caching: "auto" });
  });

  test("session id is stable across turns of one thread", () => {
    const first = promptCacheSessionId({ userId: "user-1", chatId: "chat-1" });
    const second = promptCacheSessionId({ userId: "user-1", chatId: "chat-1" });

    expect(first).toBe(second);
  });

  test("session id differs between threads and between users", () => {
    const base = promptCacheSessionId({ userId: "user-1", chatId: "chat-1" });

    expect(promptCacheSessionId({ userId: "user-1", chatId: "chat-2" })).not.toBe(base);
    expect(promptCacheSessionId({ userId: "user-2", chatId: "chat-1" })).not.toBe(base);
  });

  test("session id is opaque: it carries neither id", () => {
    const id = promptCacheSessionId({ userId: "user-1", chatId: "chat-1" });

    expect(id).toMatch(/^[0-9a-f]{32}$/);
    expect(id).not.toContain("user-1");
    expect(id).not.toContain("chat-1");
  });

  test("header uses the Gateway's session-affinity name", () => {
    const headers = promptCacheSessionHeaders({ userId: "user-1", chatId: "chat-1" });

    expect(Object.keys(headers)).toEqual(["x-session-affinity"]);
    expect(headers["x-session-affinity"]).toBe(
      promptCacheSessionId({ userId: "user-1", chatId: "chat-1" })
    );
  });
});
