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
  isToolAllowedForSession,
} from "@/lib/llm/compile-speak-tools";
import { buildSpeakRealtimeInstructions } from "@/lib/system-prompt/speak-realtime";
import { DEFAULT_SPEAK_MODALITIES } from "@/lib/schemas/speak-modalities";
import { AMBIENT_LABEL } from "@/lib/speak/ambient-item";

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

  test("instructions mention enabled channels", () => {
    const text = buildSpeakRealtimeInstructions({ text: true, genUi: true, web: false });

    expect(text).toContain("GenUI");
    expect(text).toContain("on-screen text");
    expect(text).not.toContain("web page preview iframes");
  });
});

describe("compileSpeakRealtimeTools memory opt-in", () => {
  test("search_memories appears only when memory is enabled", () => {
    const off = compileSpeakRealtimeTools(DEFAULT_SPEAK_MODALITIES).map((t) => t.name);
    const on = compileSpeakRealtimeTools(DEFAULT_SPEAK_MODALITIES, { memoryEnabled: true }).map(
      (t) => t.name
    );

    expect(off).not.toContain("search_memories");
    expect(on).toContain("search_memories");
    // Capability tools sit before the nanobots so the model reads them first.
    expect(on.indexOf("search_memories")).toBeLessThan(on.indexOf("update_thread_title"));
  });

  test("search_memories is gated by the session flag, not by modalities", () => {
    const voiceOnly = { text: false, genUi: false, web: false };

    expect(isToolAllowedForModalities("search_memories", voiceOnly)).toBe(true);
    expect(
      isToolAllowedForSession("search_memories", { modalities: voiceOnly, memoryEnabled: false })
    ).toBe(false);
    expect(
      isToolAllowedForSession("search_memories", { modalities: voiceOnly, memoryEnabled: true })
    ).toBe(true);
    expect(
      isToolAllowedForSession("render_gen_ui", { modalities: voiceOnly, memoryEnabled: true })
    ).toBe(false);
  });
});

describe("buildSpeakRealtimeInstructions continuity", () => {
  test("memory guidance and the tool line appear only when enabled", () => {
    const off = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES);
    const on = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, { memoryEnabled: true });

    expect(off).not.toContain("search_memories");
    expect(on).toContain("- search_memories:");
    expect(on).toContain("Use search_memories silently");
  });

  test("a resumed session carries the preamble and asks not to recap", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, {
      resumed: true,
      sessionContext: "Conversation so far:\nWe planned a trip.",
    });

    expect(text).toContain("continuing an earlier conversation");
    expect(text).toContain("do not recap");
    expect(text).toContain("We planned a trip.");
  });

  test("a resumed session with no context says so without inventing memory", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, { resumed: true });

    expect(text).toContain("nothing from it is on hand");
  });

  test("a fresh session has no continuity block", () => {
    const text = buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, { resumed: false });

    expect(text).not.toContain("continuing an earlier conversation");
  });
});

describe("Speak Realtime screen awareness", () => {
  // Every session can receive screen items, whatever its modalities, memory or resume state.
  const variants = [
    buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES),
    buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, { memoryEnabled: true }),
    buildSpeakRealtimeInstructions(DEFAULT_SPEAK_MODALITIES, { resumed: true, sessionContext: "x" }),
  ];

  test("every session is told screen updates exist, by the label items carry", () => {
    for (const text of variants) {
      expect(text).toContain("Screen awareness:");
      expect(text).toContain(`${AMBIENT_LABEL} messages describing what the user has open`);
    }
  });

  test("it is told it can see what they describe, so it stops saying it cannot", () => {
    expect(variants[0]).toContain("never claim you cannot see the screen when you have one");
  });

  test("the newest item wins, and items are never announced", () => {
    expect(variants[0]).toContain("The newest [Screen] message is what is in front of them");
    expect(variants[0]).toContain("Never announce, acknowledge, or react to a [Screen] message");
  });

  test("with nothing to go on, it says so rather than guessing", () => {
    expect(variants[0]).toContain("tell the user you cannot see what they have open");
  });
});
