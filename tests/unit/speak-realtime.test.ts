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

  test("instructions mention enabled channels", () => {
    const text = buildSpeakRealtimeInstructions({ text: true, genUi: true, web: false });

    expect(text).toContain("GenUI");
    expect(text).toContain("on-screen text");
    expect(text).not.toContain("web page preview iframes");
  });
});
