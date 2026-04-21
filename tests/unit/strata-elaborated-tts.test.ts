import { describe, expect, test } from "bun:test";

import {
  STRATA_ELABORATED_TTS_FULL_KEY,
  STRATA_ELABORATED_TTS_JSON_KEY,
  STRATA_ELABORATED_TTS_SUMMARY_KEY,
  buildElaboratedContentJsonAfterModel,
  clampTtsPlainText,
  estimateStrataElaboratedTtsDurations,
  formatTtsDurationLabel,
  markdownToTtsPlainText,
  mergeStrataElaboratedTtsIntoContentJson,
  mergeStrataElaboratedTtsSlotIntoContentJson,
  parseStrataElaboratedTts,
  parseStrataElaboratedTtsFull,
  parseStrataElaboratedTtsSummary,
  sha256HexUtf8,
} from "@/lib/strata/elaborated-tts";

describe("markdownToTtsPlainText", () => {
  test("strips headings and emphasis", () => {
    const md = "## Hello\n\nThis is **bold** and a [link](https://x.com).";
    expect(markdownToTtsPlainText(md)).toBe("Hello This is bold and a link.");
  });
});

describe("clampTtsPlainText", () => {
  test("does not truncate short text", () => {
    const s = "a".repeat(100);
    expect(clampTtsPlainText(s, 200)).toEqual({ text: s, truncated: false });
  });

  test("truncates long text", () => {
    const s = "b".repeat(10);
    expect(clampTtsPlainText(s, 4)).toEqual({ text: "bbbb", truncated: true });
  });
});

describe("buildElaboratedContentJsonAfterModel", () => {
  test("returns null for empty artifacts", () => {
    expect(buildElaboratedContentJsonAfterModel(null)).toBe(null);
    expect(buildElaboratedContentJsonAfterModel({})).toBe(null);
  });

  test("drops all reserved TTS keys from model artifacts", () => {
    const out = buildElaboratedContentJsonAfterModel({
      kind: "notes",
      [STRATA_ELABORATED_TTS_JSON_KEY]: { stale: true },
      [STRATA_ELABORATED_TTS_SUMMARY_KEY]: { stale: true },
      [STRATA_ELABORATED_TTS_FULL_KEY]: { stale: true },
    });
    expect(out).toEqual({ kind: "notes" });
    expect(out?.[STRATA_ELABORATED_TTS_JSON_KEY]).toBeUndefined();
    expect(out?.[STRATA_ELABORATED_TTS_SUMMARY_KEY]).toBeUndefined();
    expect(out?.[STRATA_ELABORATED_TTS_FULL_KEY]).toBeUndefined();
  });
});

describe("merge / parse elaborated TTS slots", () => {
  test("round-trips summary slot", async () => {
    const fp = await sha256HexUtf8("hello world");
    const payload = {
      version: 1 as const,
      mediaType: "audio/mpeg",
      audioBase64: "abcd",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceContentSha256: fp,
      ttsPlainText: "hello world",
    };
    const merged = mergeStrataElaboratedTtsSlotIntoContentJson({ kind: "x" }, "summary", payload);
    expect(merged.kind).toBe("x");
    expect(parseStrataElaboratedTtsSummary(merged)?.audioBase64).toBe("abcd");
    expect(parseStrataElaboratedTtsFull(merged)).toBe(null);
  });

  test("round-trips full slot", async () => {
    const fp = await sha256HexUtf8("full text");
    const payload = {
      version: 1 as const,
      mediaType: "audio/mpeg",
      audioBase64: "eeee",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceContentSha256: fp,
      ttsPlainText: "full text",
    };
    const merged = mergeStrataElaboratedTtsSlotIntoContentJson({ kind: "y" }, "full", payload);
    expect(merged.kind).toBe("y");
    expect(parseStrataElaboratedTtsFull(merged)?.audioBase64).toBe("eeee");
    expect(parseStrataElaboratedTtsSummary(merged)).toBe(null);
  });

  test("legacy key is read as full slot", async () => {
    const fp = await sha256HexUtf8("legacy");
    const payload = {
      version: 1 as const,
      mediaType: "audio/mpeg",
      audioBase64: "legacy",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceContentSha256: fp,
    };
    const merged = { [STRATA_ELABORATED_TTS_JSON_KEY]: payload };
    expect(parseStrataElaboratedTtsFull(merged)?.audioBase64).toBe("legacy");
    expect(parseStrataElaboratedTts(merged)?.audioBase64).toBe("legacy");
  });

  test("merging full slot removes legacy key from stored json", async () => {
    const fp = await sha256HexUtf8("x");
    const payload = {
      version: 1 as const,
      mediaType: "audio/mpeg",
      audioBase64: "qqqq",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceContentSha256: fp,
      ttsPlainText: "x",
    };
    const merged = mergeStrataElaboratedTtsSlotIntoContentJson(
      { [STRATA_ELABORATED_TTS_JSON_KEY]: payload },
      "full",
      payload
    );
    expect(merged[STRATA_ELABORATED_TTS_JSON_KEY]).toBeUndefined();
    expect(parseStrataElaboratedTtsFull(merged)?.audioBase64).toBe("qqqq");
  });

  test("parse returns null for invalid blob", () => {
    expect(parseStrataElaboratedTtsFull({ [STRATA_ELABORATED_TTS_FULL_KEY]: { bad: true } })).toBe(null);
    expect(parseStrataElaboratedTtsSummary({ [STRATA_ELABORATED_TTS_SUMMARY_KEY]: { bad: true } })).toBe(
      null
    );
  });

  test("deprecated mergeStrataElaboratedTtsIntoContentJson writes full slot", async () => {
    const fp = await sha256HexUtf8("z");
    const payload = {
      version: 1 as const,
      mediaType: "audio/mpeg",
      audioBase64: "z",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceContentSha256: fp,
    };
    const merged = mergeStrataElaboratedTtsIntoContentJson({}, payload);
    expect(merged[STRATA_ELABORATED_TTS_FULL_KEY]).toEqual(payload);
    expect(merged[STRATA_ELABORATED_TTS_JSON_KEY]).toBeUndefined();
  });
});

describe("sha256HexUtf8", () => {
  test("matches known vector for empty string", async () => {
    const out = await sha256HexUtf8("");
    expect(out).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  });
});

describe("formatTtsDurationLabel", () => {
  test("formats sub-minute and minute-plus", () => {
    expect(formatTtsDurationLabel(45)).toBe("45s");
    expect(formatTtsDurationLabel(65)).toBe("1m 05s");
  });
});

describe("estimateStrataElaboratedTtsDurations", () => {
  test("returns nulls for blank input", () => {
    expect(estimateStrataElaboratedTtsDurations("   ")).toEqual({
      estimatedPlaybackSeconds: null,
      estimatedGenerationSeconds: null,
    });
  });

  test("derives playback from word count and at least 2s generation estimate", () => {
    const oneWord = estimateStrataElaboratedTtsDurations("hello");
    expect(oneWord.estimatedPlaybackSeconds).toBe(1);
    expect(oneWord.estimatedGenerationSeconds).toBe(2);
  });
});
