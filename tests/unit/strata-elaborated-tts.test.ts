import { describe, expect, test } from "bun:test";

import {
  STRATA_ELABORATED_TTS_JSON_KEY,
  buildElaboratedContentJsonAfterModel,
  clampTtsPlainText,
  estimateStrataElaboratedTtsDurations,
  formatTtsDurationLabel,
  markdownToTtsPlainText,
  mergeStrataElaboratedTtsIntoContentJson,
  parseStrataElaboratedTts,
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

  test("drops reserved TTS key from model artifacts", () => {
    const out = buildElaboratedContentJsonAfterModel({
      kind: "notes",
      [STRATA_ELABORATED_TTS_JSON_KEY]: { stale: true },
    });
    expect(out).toEqual({ kind: "notes" });
    expect(out?.[STRATA_ELABORATED_TTS_JSON_KEY]).toBeUndefined();
  });
});

describe("merge / parse elaborated TTS", () => {
  test("round-trips payload on contentJson", async () => {
    const fp = await sha256HexUtf8("hello world");
    const payload = {
      version: 1 as const,
      mediaType: "audio/mpeg",
      audioBase64: "abcd",
      generatedAt: "2026-01-01T00:00:00.000Z",
      sourceContentSha256: fp,
    };
    const merged = mergeStrataElaboratedTtsIntoContentJson({ kind: "x" }, payload);
    expect(merged.kind).toBe("x");
    const read = parseStrataElaboratedTts(merged);
    expect(read?.audioBase64).toBe("abcd");
    expect(read?.sourceContentSha256).toBe(fp);
  });

  test("parse returns null for invalid blob", () => {
    expect(parseStrataElaboratedTts({ [STRATA_ELABORATED_TTS_JSON_KEY]: { bad: true } })).toBe(null);
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
