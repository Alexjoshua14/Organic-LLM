import { describe, expect, test } from "bun:test";

import { CHAT_STYLES } from "@/lib/chat/chat-style";
import {
  CHAT_STYLE_STARTERS,
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

describe("chat-style-starters catalogue", () => {
  test("every style has three starters with unique, key-safe ids that round-trip", () => {
    for (const style of CHAT_STYLES) {
      const starters = CHAT_STYLE_STARTERS[style.id];
      const ids = starters.map((starter) => starter.id);

      expect(starters).toHaveLength(3);
      expect(new Set(ids).size).toBe(ids.length);

      for (const starter of starters) {
        expect(starter.id).toMatch(/^[a-z0-9-]+$/);
        expect(starter.label.trim().length).toBeGreaterThan(0);
        expect(starter.prompt.trim().length).toBeGreaterThan(0);
        expect(resolveChatStarterByKey(encodeChatStarterKey(style.id, starter.id))).toBe(starter);
      }
    }
  });

  test("Jev starters prime thread preferences", () => {
    expect(CHAT_STYLE_STARTERS.jev.map((starter) => starter.id)).toEqual([
      "away-from-screen",
      "artifacts-first",
      "thinking-out-loud",
    ]);

    expect(resolveChatStarterPromptByKey("jev:away-from-screen")).toBe(
      "I'm often away from the screen in this thread. When a reply works as speech, keep it short and spoken."
    );
    expect(resolveChatStarterPromptByKey("jev:artifacts-first")).toBe(
      "Prefer artifacts over prose in this thread: diagrams, structured blocks, and rabbit holes. Keep any text to a line."
    );
    expect(resolveChatStarterPromptByKey("jev:thinking-out-loud")).toBe(
      "I'm thinking out loud in this thread. Many messages are notes to myself; only reply when I ask a question or request something."
    );
  });

  test("Jev starter keys parse to the jev style", () => {
    expect(parseChatStarterKey("jev:artifacts-first")).toEqual({
      style: "jev",
      id: "artifacts-first",
    });
    expect(resolveChatStarterByKey("jev:stitch-this-together")).toBeUndefined();
  });
});
