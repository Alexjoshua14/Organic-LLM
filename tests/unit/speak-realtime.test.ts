import { describe, expect, test } from "bun:test";

import {
  computeUsageCostUsd,
  costUnitsFromUsd,
  estimateRealtimeMinuteCostUsd,
  normalizeRealtimeModelId,
} from "@/lib/rate-limit/llm-cost";
import {
  compileSpeakRealtimeTools,
  isToolAllowedForModalities,
} from "@/lib/llm/compile-speak-tools";
import { buildSpeakRealtimeInstructions } from "@/lib/system-prompt/speak-realtime";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";

describe("speak realtime cost helpers", () => {
  test("normalizeRealtimeModelId prefixes openai/", () => {
    expect(normalizeRealtimeModelId("gpt-realtime-mini")).toBe("openai/gpt-realtime-mini");
    expect(normalizeRealtimeModelId("openai/gpt-realtime-mini")).toBe("openai/gpt-realtime-mini");
  });

  test("estimateRealtimeMinuteCostUsd is positive for mini", () => {
    const usd = estimateRealtimeMinuteCostUsd("gpt-realtime-mini");

    expect(usd).toBeGreaterThan(0);
    expect(usd).toBeLessThan(0.5);
  });

  test("audio tokens contribute to cost", () => {
    const textOnly = computeUsageCostUsd("openai/gpt-realtime-mini", {
      inputTokens: 100,
      outputTokens: 100,
    });
    const withAudio = computeUsageCostUsd("openai/gpt-realtime-mini", {
      inputTokens: 100,
      outputTokens: 100,
      audioInputTokens: 300,
      audioOutputTokens: 600,
    });

    expect(withAudio).toBeGreaterThan(textOnly);
  });

  test("costUnitsFromUsd uses 10k units per dollar", () => {
    expect(costUnitsFromUsd(20)).toBe(200_000);
    expect(costUnitsFromUsd(0.00005)).toBe(1);
  });
});

describe("compileSpeakRealtimeTools modality gate", () => {
  test("voice-only modalities still include nanobot tools", () => {
    const tools = compileSpeakRealtimeTools({ text: false, genUi: false, web: false });
    const names = tools.map((t) => t.name);

    expect(names).toContain("update_thread_title");
    expect(names).toContain("summarize_thread");
    expect(names).not.toContain("update_display_text");
    expect(names).not.toContain("render_gen_ui");
    expect(names).not.toContain("show_web_preview");
  });

  test("all modalities enable full tool set", () => {
    const tools = compileSpeakRealtimeTools({ text: true, genUi: true, web: true });
    const names = tools.map((t) => t.name);

    expect(names).toContain("update_display_text");
    expect(names).toContain("render_gen_ui");
    expect(names).toContain("refresh_component");
    expect(names).toContain("upsert_ui_state");
    expect(names).toContain("show_web_preview");
  });

  test("isToolAllowedForModalities respects ceiling", () => {
    expect(isToolAllowedForModalities("render_gen_ui", DEFAULT_SPEAK_MODALITIES)).toBe(false);
    expect(isToolAllowedForModalities("update_display_text", DEFAULT_SPEAK_MODALITIES)).toBe(true);
    expect(
      isToolAllowedForModalities("show_web_preview", { text: true, genUi: false, web: true })
    ).toBe(true);
  });

  test("search_memories is always available regardless of modalities", () => {
    const voiceOnly = compileSpeakRealtimeTools({ text: false, genUi: false, web: false });

    expect(voiceOnly.map((t) => t.name)).toContain("search_memories");
    expect(isToolAllowedForModalities("search_memories", { text: false, genUi: false, web: false })).toBe(
      true
    );
  });

  test("instructions mention enabled channels", () => {
    const text = buildSpeakRealtimeInstructions({ text: true, genUi: true, web: false });

    expect(text).toContain("GenUI");
    expect(text).toContain("on-screen text");
    expect(text).not.toContain("web page preview iframes");
  });

  test("instructions always advertise search_memories with filler guidance", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES);

    expect(text).toContain("search_memories");
    expect(text.toLowerCase()).toContain("filler");
    expect(text.toLowerCase()).toContain("never sit in silence");
  });
});

describe("buildSpeakRealtimeInstructions with primed context", () => {
  test("resumed context injects memory, continuity, and a time-aware greeting", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, {
      memoryDump: "- Prefers concise answers\n- Working on Organic LLM",
      overview: "A builder focused on AI memory systems.",
      recap: "We were debugging the Speak voice agent.",
      recentTurns: "User: hey\nYou: welcome back",
      elapsedPhrase: "a few days ago",
      resumed: true,
    });

    expect(text).toContain("Prefers concise answers");
    expect(text).toContain("A builder focused on AI memory systems.");
    expect(text).toContain("We were debugging the Speak voice agent.");
    expect(text).toContain("a few days ago");
    // Resumed → greet reflecting elapsed time / where you left off.
    expect(text).toContain("Open the conversation yourself");
    expect(text).toContain("time that's passed");
  });

  test("new-thread context uses a light cold-open greeting and omits empty sections", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, {
      memoryDump: null,
      overview: null,
      recap: null,
      recentTurns: null,
      elapsedPhrase: null,
      resumed: false,
    });

    expect(text).toContain("new voice thread");
    expect(text).not.toContain("Where you left off");
    expect(text).not.toContain("You last spoke with them");
  });

  test("omitting context keeps the base instructions unchanged", () => {
    const base = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES);

    expect(base).not.toContain("Open the conversation yourself");
  });

  test("a supplied personality leads the instructions", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, undefined, "You are Soren.");

    expect(text.startsWith("You are Soren.")).toBe(true);
  });

  test("omitting personality falls back to the default identity", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES);

    expect(text).toContain("easy to talk to");
  });
});
