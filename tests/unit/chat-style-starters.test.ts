import { describe, expect, test } from "bun:test";

import {
  encodeChatStarterKey,
  parseChatStarterKey,
  resolveChatStarterByKey,
  resolveChatStarterPromptByKey,
} from "@/lib/chat/chat-style-starters";

describe("chat-style-starters keys", () => {
  test("encodeChatStarterKey produces style:id format", () => {
    expect(encodeChatStarterKey("scribe", "stitch-this-together")).toBe(
      "scribe:stitch-this-together"
    );
  });

  test("parseChatStarterKey round-trips valid keys", () => {
    const key = "ergon:setup-kanban";
    expect(parseChatStarterKey(key)).toEqual({ style: "ergon", id: "setup-kanban" });
  });

  test("parseChatStarterKey rejects malformed keys", () => {
    expect(parseChatStarterKey("")).toBeNull();
    expect(parseChatStarterKey("invalid")).toBeNull();
    expect(parseChatStarterKey(":missing-style")).toBeNull();
  });

  test("resolveChatStarterByKey finds known starter", () => {
    const starter = resolveChatStarterByKey("scribe:stitch-this-together");
    expect(starter?.label).toBe("Stitch This Together");
  });

  test("resolveChatStarterPromptByKey returns priming text", () => {
    const prompt = resolveChatStarterPromptByKey("scribe:stitch-this-together");
    expect(prompt).toContain("directly stitch my pieces together");
    expect(prompt).toContain("Do not scope creep");
  });

  test("resolveChatStarterPromptByKey returns undefined for unknown key", () => {
    expect(resolveChatStarterPromptByKey("scribe:unknown-id")).toBeUndefined();
  });
});
